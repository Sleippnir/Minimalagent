# Minimalagent Interview Pipeline

## 1. Scheduling & Queue Seeding (Supabase)
- `serve` handler in `supabase/functions/schedule-interview/index.ts:13-233` receives `RequestPayload` (`application_id`, `question_ids`, optional `resume_path`, `interviewer_prompt_version_id`, `evaluator_prompt_version_id`).
- Handler fetches prompt versions and latest rubric, inserts a new `interviews` row (returns `interview_id`, `auth_token`) and appends ordered rows to `interview_questions`.
- Builds `payloadForQueue` with:
  - `candidate`: `{candidate_id, first_name, last_name, email}`
  - `job`: `{job_id, title, description}`
  - `questions`: list of `{question_id, text, type}`
  - `interviewer_prompt`: prompt content
  - `evaluation_materials`: `{resume_text, job_description}`
- Inserts `{interview_id, auth_token, payload}` into `interviewer_queue` and `{interview_id, candidate_email, status:'pending'}` into `login_link_outbox`. Email edge function later sends the magic-link that embeds the `auth_token`.

## 2. Candidate Startup Token Entry (FastAPI)
- `GET /interviews/{jwt_token}` implemented in `interview_api.py:330-365`.
- Flow:
  1. Lazily instantiates `ContextService` (wrapper around Supabase clients).
  2. Calls `ContextService.get_interview_context(jwt_token)` → `QueueService.get_interview_context_from_queue(auth_token)` (`interview/context_service/services.py:37-48`), which issues `GET /rest/v1/interviewer_queue?auth_token=eq.{token}` via `SupabaseClient`.
  3. Returns `{"status": "success", "payload": <queue payload>, "bot_launched": launch_bot}`.
- Optional `launch_bot=true` triggers `launch_interview_bot(room_url=jwt_token, interview_id=payload.get("interview_id"))` (`interview_api.py:352-356`). The helper sets environment variables: `AUTH_TOKEN`, `TRANSPORT=webrtc`, `PORT=7861`, `PIPECAT_PORT=7861`, `HOST=0.0.0.0`, and spawns `python -m interview.bots.simlibot --host 0.0.0.0 --port 7861`.

## 3. Bot Context Hydration & Conversation
- `run_bot` in `interview/bots/simlibot.py:116-227` determines `auth_token` (`os.getenv("AUTH_TOKEN")` fallback to transport room name) and instantiates `QueueService`.
- Retrieves interviewer context through `QueueService.get_interview_context_from_queue(auth_token)`; wraps result with `InterviewContext.from_supabase_record` (`interview/context_service/models.py:44-79`) to expose helpers like `.candidate_name`, `.job_title`, `.format_full_context()`.
- Pipecat pipeline is configured using Deepgram STT, OpenAI/Google LLM services, ElevenLabs TTS, optional Simli video. Transcripts are mirrored to `storage/transcripts/<interview_id>/transcript.md`.
- When Pipecat finishes, the `on_client_disconnected` handler invokes `shutdown_services()` and persists the transcript (see next section).

## 4. Transcript Persistence Paths
- **Bot-driven path**: `TranscriptService.write_transcript` (`interview/context_service/services.py:81-145`) is called from `simlibot`’s shutdown hook (`interview/bots/simlibot.py:234-256`).
  - Arguments: `interview_id`, `full_text` (string), `transcript_json` (metadata dict), optional `audio_path`.
  - Steps: `POST /rest/v1/transcripts` with `{interview_id, full_text, transcript_json[, audio_path]}` then `PATCH /rest/v1/interviews?interview_id=eq.{id}` to set `status='completed'`.
  - Returns `True` on transcript insert success (status update best-effort).
- **API-driven path**: `POST /interviews/{interview_id}/transcript` (`interview_api.py:373-407`) accepts `TranscriptSubmission` (`List[TranscriptTurn]`). Builds newline-joined `full_text` and forwards `{interview_id, transcript_json, full_text}` to `ContextService.save_transcript`.
  - `ContextService.save_transcript` → `InterviewRepository.save_transcript` (`interview/context_service/interview_repository.py:53-108`) which inserts into `transcripts` via Supabase Python client and sets `status='completed'`/`completed_at=now()`.

Both paths guarantee the interview is marked `completed` once transcript storage succeeds.

## 5. Supabase Evaluator Payload Trigger
- PostgreSQL trigger (body excerpt in user-supplied snippet) fires once an interview satisfies **has transcript** and **status = 'completed'**.
- Function responsibilities:
  1. Query joins across `interviews`, `applications`, `candidates`, `jobs`, `prompt_versions`, `rubric_versions`, `rubrics`, and the freshly inserted `transcripts` row to assemble `evaluator_payload`.
  2. Includes `transcript_data`: `{full_text_transcript, structured_transcript}` (structure matches the JSON saved in `transcripts.transcript_json`), plus `questions_and_answers` aggregated from `interview_questions`/`questions`.
  3. Inserts `{interview_id, payload}` into `evaluator_queue`.
  4. Deletes the stale `interviewer_queue` entry for the same interview.
- Because this logic lives in the database, any transcript ingestion path that fulfills the status update automatically queues the evaluation payload without additional application code.

## 6. Background Evaluation Service
- `BackgroundEvaluatorAgent` (`interview/evaluator/background_evaluator.py`) runs as an async worker:
  - `get_evaluation_task` (line 63) fetches the oldest pending row via `QueueService.get_next_evaluation_task()` (`interview/context_service/services.py:50-66` → `GET /rest/v1/evaluator_queue?limit=1&order=created_at.asc`).
  - `_create_interview_from_payload` (lines 138-236) converts queue payload into `Interview` domain object (`interview/evaluator/interview.py`), mapping transcript, rubric, evaluator prompt, and optional question/answer set.
  - `_run_llm_evaluation` (lines 238-282) calls `EvaluationHelper.run_full_evaluation` (`interview/evaluator/helpers.py:268-325`) with `{"interview_id", "transcript", "job_description", "rubric", "evaluator_prompt"}`.
    - `EvaluationHelper` orchestrates async calls to `RealLLMEvaluator.evaluate_with_openai`, `.evaluate_with_google`, `.evaluate_with_deepseek`, capturing scores, reasoning, and raw JSON.
  - `_store_evaluation_results` (lines 284-334) persists each provider’s response via `EvaluationRepository.create` (`interview/context_service/evaluator_repository.py:255-285`) and then updates `interviews` status to `evaluated`.
- On success the worker logs completion; failures leave the queue row untouched for retry on the next polling cycle.

## 7. Recovery & Reprocessing Utilities
- `supabase/functions/reprocess-interview/index.ts` rebuilds the interviewer payload for a specific `interview_id` by rehydrating candidate/job/script data and upserting into `interviewer_queue`.
- `supabase/reprocess_stuck_interviews_updated.sql` scans for interviews older than five minutes missing from `interviewer_queue`, resets their status to `scheduled`, and HTTP-POSTs the edge function above via `net.http_post`.
- These jobs ensure the pipeline can self-heal if the trigger or edge insertions fail.

## 8. Payload Reference
- **Interviewer queue (`interviewer_queue.payload`)** – produced by the scheduler or by `generate_interview_payload(p_interview_id UUID)` (`supabase/generate_interview_payload.sql`). Keys:
  - `candidate`: `{candidate_id, first_name, last_name, email}`
  - `job`: `{job_id, title, description}`
  - `questions`: array of `{question_id, text, type}` (technical + behavioral merged)
  - `interviewer_prompt`: string with `[first_name]`/`[job_title]` placeholders
  - `evaluation_materials`: `{resume_text, job_description}`
- **Evaluator queue (`evaluator_queue.payload`)** – produced by the trigger in §5. Keys:
  - `interview_id`: UUID
  - `candidate`: `{first_name, last_name, email}`
  - `job`: `{title, description}`
  - `evaluation_materials`: `{evaluator_prompt, rubric:{name, version, criteria}}`
  - `transcript_data`: `{full_text_transcript, structured_transcript}`
  - `questions_and_answers`: ordered array `{position, question_text, ideal_answer}`

### Key API Models
- `TranscriptTurn` (`interview_api.py:280-284`): `{speaker: str, text: str, timestamp?: float}`
- `TranscriptSubmission` (`interview_api.py:286-287`): `{turns: List[TranscriptTurn]}`

## End-to-End Summary
1. Edge function schedules the interview and seeds `interviewer_queue` with an `auth_token`.
2. Candidate hits `GET /interviews/{token}`, optionally spins up `simlibot`, and the bot fetches the same queue payload.
3. Conversation ends → transcript saved → interview status becomes `completed`.
4. Supabase trigger notices transcript + completed status, generates evaluator payload, moves record to `evaluator_queue`.
5. Background evaluator polls `evaluator_queue`, runs multi-provider LLM grading, stores per-provider results in `evaluations`, and marks interview `evaluated`.
6. Reprocessing scripts keep the pipeline healthy if any stage stalls.
