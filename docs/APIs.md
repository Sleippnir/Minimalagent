# Minimalagent Runtime APIs

Live interfaces that move an interview from token redemption to completed evaluation. All shapes and flows are traced from the current codebase—no other docs referenced.

---

## 1. FastAPI Server (`interview_api.py`)

### GET `/interviews/{jwt_token}`
- **Purpose**: Exchange the single-use startup token for the interviewer payload and optionally spawn the Pipecat bot.
- **Query string**: `launch_bot: bool = False`
- **Processing steps**:
  1. Resolve `ContextService` → `QueueService.get_interview_context_from_queue(jwt_token)`
     - Supabase REST: `GET /rest/v1/interviewer_queue?auth_token=eq.{token}`
  2. On `launch_bot=true`, call `launch_interview_bot(jwt_token, payload.interview_id)` which sets `AUTH_TOKEN`, `TRANSPORT=webrtc`, `PORT=7861` and spawns `python -m interview.bots.simlibot ...`.
  3. Return payload without mutating the database.
- **Response** (`200`):
  ```jsonc
  {
    "status": "success",
    "payload": {
      "interview_id": "uuid",
      "candidate": {...},
      "job": {...},
      "questions": [...],
      "interviewer_prompt": "...",
      "evaluation_materials": {...}
    },
    "bot_launched": false
  }
  ```
- **Errors**:
  - `404`: token missing/expired (queue lookup returned nothing)
  - `500`: Supabase or bot-launch failure (details surfaced in `detail`)

### POST `/interviews/{interview_id}/transcript`
- **Purpose**: Persist a finished transcript and mark the interview as complete (triggering evaluator payload generation downstream).
- **Body model**:
  ```jsonc
  {
    "turns": [
      {"speaker": "interviewer", "text": "...", "timestamp": 1701234567.0},
      {"speaker": "candidate", "text": "..."}
    ]
  }
  ```
- **Processing steps**:
  1. Build `full_text` by joining `{speaker}: {text}`.
  2. Invoke `ContextService.save_transcript(interview_id, {...})`.
     - `InterviewRepository.save_transcript` inserts into `transcripts` and patches `interviews.status='completed'`.
  3. Return success on write confirmation.
- **Response** (`200`):
  ```jsonc
  {
    "status": "success",
    "message": "Transcript submitted successfully. Evaluation will be triggered automatically.",
    "interview_id": "uuid"
  }
  ```
- **Errors**:
  - `404`: never raised by API (missing interview surfaces as DB error → 500)
  - `500`: transcript save failure (Supabase error, validation issue, etc.)

### Admin Utilities
- `GET /admin/bot-processes`: returns tracked bot PIDs + metadata.
- `POST /admin/cleanup/{interview_id}`: terminates the tracked bot for an interview.
- Additional admin endpoints (`/admin/content/...`) manipulate tagging metadata (outside the interview pipeline).

### Health Check
- `GET /health` → `{ "status": "healthy", "service": "interview-api" }`

---

## 2. Pipecat Bot Contract (`interview/bots/simlibot.py`)

Although launched out-of-band, the bot behaves like an API consumer:

1. Reads `AUTH_TOKEN` from env / room URL.
2. Calls `QueueService.get_interview_context_from_queue(auth_token)` (same Supabase REST GET as the FastAPI endpoint).
3. Streams audio/video via Pipecat transports; transcripts mirrored to `storage/transcripts/...`.
4. On disconnect:
   - Reads the Markdown transcript.
   - Calls `TranscriptService.write_transcript(...)`:
     - `POST /rest/v1/transcripts`
     - `PATCH /rest/v1/interviews?interview_id=eq.{id}` → `status='completed'`

This mirrors the REST semantics of `POST /interviews/{interview_id}/transcript` for automated sessions.

---

## 3. Supabase Edge Functions

### `POST /functions/v1/schedule-interview`
- **Purpose**: Authoritative entrypoint for scheduling.
- **Request body** (`RequestPayload`):
  ```jsonc
  {
    "application_id": "uuid",
    "question_ids": ["uuid", "..."],
    "resume_path": "optional/storage/path.pdf",
    "interviewer_prompt_version_id": "optional",
    "evaluator_prompt_version_id": "optional"
  }
  ```
- **Key operations**:
  - Fetch latest prompts/rubric when versions not supplied.
  - Insert `interviews` row (`status='scheduled'`, random `auth_token`).
  - Populate `interview_questions`.
  - Build interviewer payload and `INSERT` into `interviewer_queue`.
  - Seed `login_link_outbox` and `fetch` the email function asynchronously.
- **Response**:
  ```jsonc
  {
    "success": true,
    "interview_id": "uuid",
    "message": "Interview scheduled, payload queued, and email notification sent."
  }
  ```
- **Errors**: all surfaced as `500` JSON messages; duplicate application guarded explicitly.

### `POST /functions/v1/send-login-links`
- Processes pending `login_link_outbox` rows.
- Generates Supabase magic links and updates row status (`sent`, `failed`, or retried `pending`).
- Typically invoked via scheduler or the async `fetch` issued by the scheduler function.

### `POST /functions/v1/reprocess-interview`
- Rehydrates the interviewer payload for a given `interview_id`.
- Rebuilds payload from `interviews`, `applications`, `interview_questions`, `prompt_versions`.
- `UPSERT` into `interviewer_queue`, reset `interviews.status='scheduled'`.
- Returns `{ success: true, message: ... }` or `{ error: ... }`.

---

## 4. Database Triggers & SQL Helpers

### `generate_interview_payload(p_interview_id UUID)`
- PL/pgSQL function (invoked manually or by triggers) that:
  - Selects interview, candidate, job, prompt, rubric, and question data.
  - Inserts/updates the row in `interviewer_queue`.

### Transcript → Evaluator Trigger (Supabase console)
- Not versioned in repo, but its logic (from Supabase dashboard) executes when:
  - An interview has a transcript (`transcripts` row) and `status='completed'`.
  - It composes the evaluator payload (`candidate`, `job`, `evaluation_materials`, `transcript_data`, `questions_and_answers`) and inserts into `evaluator_queue`, then deletes the stale `interviewer_queue` record.

### `reprocess_stuck_interviews()`
- Cron-friendly PL/pgSQL:
  - Finds interviews older than 5 minutes missing from `interviewer_queue`.
  - Resets status to `scheduled` and POSTs to `/functions/v1/reprocess-interview` via `pg_net`.

---

## 5. Background Evaluator Agent

### Worker Loop (`interview/evaluator/background_evaluator.py`)
1. Polls `QueueService.get_next_evaluation_task()` → `GET /rest/v1/evaluator_queue?limit=1&order=created_at.asc`.
2. Converts payload to `Interview` domain object.
3. Evaluates via `EvaluationHelper.run_full_evaluation(...)` (fan-out to OpenAI, Google, DeepSeek).
4. Persists each provider’s result with `EvaluationRepository.create(...)` → `POST /rest/v1/evaluations`.
5. Marks interview `status='evaluated'` using the synchronous Supabase client (`supabase-python`).

Failures leave the queue item untouched for retry on the next polling interval.

---

## 6. High-Level Call Graph

```
schedule-interview (edge) ─┬─> inserts interviews/interview_questions
                           ├─> interviewer_queue payload
                           └─> login_link_outbox (→ send-login-links)
                                  ↓ candidate receives token
GET /interviews/{token} ─────┬─> returns interviewer payload
                             └─> optional bot launch (AUTH_TOKEN env)
simlibot session ────────────┬─> QueueService GET interviewer_queue
                             └─> TranscriptService POST transcripts + PATCH interviews
trigger (Supabase) ──────────┬─> INSERT evaluator_queue payload
BackgroundEvaluatorAgent ────┬─> GET evaluator_queue
                             ├─> POST evaluations (per provider)
                             └─> UPDATE interviews.status='evaluated'
```

Keep this doc close when tracing or modifying runtime behavior—the endpoints above encompass every external touchpoint involved in the interview evaluation pipeline.
