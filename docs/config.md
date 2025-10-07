# Configuration & Environment Reference

Central checklist for the settings that must be present across local development, Supabase Edge Functions, and background services.

---

## 1. Root `.env`

Used by the FastAPI server (`interview_api.py`), bots in `interview/bots/`, and helper scripts. Copy `.env.example` and supply real values.

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `SUPABASE_URL` | ✔ | Base URL of your Supabase project (used by REST clients). |
| `SUPABASE_ANON_KEY` | ✔ | Anonymous key for client-side access (QueueService/TranscriptService). |
| `DEEPGRAM_API_KEY` | ✔ | Speech-to-text provider for bots. |
| `ELEVENLABS_API_KEY` | ✔ | Text-to-speech provider for bots. |
| `ELEVENLABS_VOICE_ID` | ✔ | Desired ElevenLabs voice. |
| `GOOGLE_API_KEY` | ✔ | Google Gemini key (LLM + STT fallback). |
| `SIMLI_API_KEY` | ✔ | Simli avatar video service. |
| `SIMLI_FACE_ID` | ✔ | Avatar face identifier. |
| `AUTH_TOKEN` | ✱ | Convenience token for local bot/testing (`ff1d...` default works in dev). |

✱ Optional in production, but the bots expect something when launched manually.

### Additional LLM Keys (Background Evaluator)

Declared in `interview/config.py`; populate when running the evaluation worker.

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `OPENAI_API_KEY` | Recommended | Needed for OpenAI evaluation path. |
| `DEEPSEEK_API_KEY` | Optional | Enables DeepSeek model scoring. |
| `OPENROUTER_API_KEY` | Optional | Required if routing through OpenRouter. |
| `PERPLEXITY_API_KEY` | Optional | Reserved for future use. |
| `OPENAI_MODEL` | Optional | Overrides default `gpt-4o`. |
| `GEMINI_MODEL` | Optional | Overrides default `gemini-2.5-flash`. |
| `DEEPSEEK_MODEL` | Optional | Overrides default `deepseek/deepseek-chat`. |

> The evaluator falls back gracefully if one of the providers is missing, but full scoring coverage assumes the keys above are present.

### Directory Settings

- Transcripts are written to `storage/` (see `config.py::TRANSCRIPT_BASE_DIR`). Ensure the directory exists and is writable before running bots or API uploads.
- Bots launch on port `7861` by default (`launch_interview_bot`), while the FastAPI server listens on port `8000`.

---

## 2. Supabase Edge Function Secrets

Configure these via `supabase secrets set ...` or the project dashboard.

| Function | Variables | Notes |
| -------- | --------- | ----- |
| `schedule-interview` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Service role key is required to insert rows and send follow-up requests. |
| `send-login-links` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` | Mail provider can be swapped, but the environment variable must match the implementation. |
| `reprocess-interview` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Used to rebuild interviewer payloads. |

> All edge functions assume service-role access because they write to privileged tables (`interviews`, queues, storage).

---

## 3. Background Evaluator / Worker Processes

To run `interview/evaluator/background_evaluator.py` locally or in a worker container:

1. Inherit the root `.env` contents (API keys & Supabase config).
2. Add the LLM keys listed above.
3. Ensure outbound HTTPS access to OpenAI, Google, DeepSeek, etc.

The worker polls every 30 seconds by default. Adjust cadence or logging via environment variables **before** wrapping it for deployment.

---

## 4. Supabase Service Configuration

- **Database functions** expect `app.service_role_key` to be populated (used by `reprocess_stuck_interviews()`).
- Ensure pg_net extension is enabled for HTTP calls (`reprocess_stuck_interviews` uses `net.http_post`).
- Storage: resumes are downloaded from the `resumes` bucket in the `schedule-interview` function. Grant appropriate `storage.objects` permissions to the service role key.

---

## 5. Quick Setup Checklist

1. `cp .env.example .env` and fill in Supabase + API provider keys.
2. Store the same Supabase URL/service role key in the Edge Function secrets.
3. Provide `RESEND_API_KEY` (or your mail provider equivalent) to send magic links.
4. Create and chmod the local `storage/` directory if running bots on the same machine.
5. When deploying the background evaluator, confirm OpenAI/Google/DeepSeek keys are reachable from that environment.

With these values in place, the FastAPI API, bots, and evaluator should operate against the Supabase project referenced by `SUPABASE_URL`.
