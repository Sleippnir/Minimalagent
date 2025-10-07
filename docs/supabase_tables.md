# Supabase Tables

Reference for the tables that underpin the interview workflow. Column lists and constraints mirror the schema currently in use.

---

## 1. `candidates`

Stores candidate information.

| Column       | Type  | Constraints                         | Description                          |
| ------------ | ----- | ----------------------------------- | ------------------------------------ |
| candidate_id | uuid  | PK, default `gen_random_uuid()`     | Unique identifier                    |
| first_name   | text  |                                     |                                      |
| last_name    | text  |                                     |                                      |
| email        | citext| NOT NULL, UNIQUE                    | Case-insensitive unique email        |
| phone        | text  | NULLABLE                            |                                      |
| linkedin_url | text  | NULLABLE                            |                                      |
| resume_path  | text  | NULLABLE                            | Path to Supabase Storage file        |
| user_id      | uuid  | FK → `auth.users(id)`               | Optional Supabase Auth link          |

---

## 2. `jobs`

Job descriptions and metadata.

| Column        | Type   | Constraints                     | Description                        |
| ------------- | ------ | ------------------------------- | ---------------------------------- |
| job_id        | uuid   | PK, default `gen_random_uuid()` | Unique identifier                  |
| title         | text   | NOT NULL                        |                                    |
| description   | text   |                                 |                                    |
| required_tags | text[] | NULLABLE                        | Tags for auto-matching questions *(current schema; slated for replacement)* |

---

## 3. `questions`

Master question bank.

| Column       | Type   | Constraints                     | Description                           |
| ------------ | ------ | ------------------------------- | ------------------------------------- |
| question_id  | uuid   | PK, default `gen_random_uuid()` | Unique identifier                     |
| text         | citext | NOT NULL, UNIQUE                | Question text (case-insensitive)      |
| ideal_answer | text   |                                 | Answer key for evaluator              |
| category     | text   |                                 | e.g. `Behavioral`, `Technical`        |
| tags         | text[] | NULLABLE                        | Tags for job matching *(current schema; slated for replacement)* |

---

## 4. `prompts` & `prompt_versions`

Version-controlled LLM instructions.

### `prompts`

| Column    | Type | Constraints                     | Description                |
| --------- | ---- | ------------------------------- | -------------------------- |
| prompt_id | uuid | PK, default `gen_random_uuid()` | Abstract prompt identifier |
| name      | text | NOT NULL, UNIQUE                | Human-friendly name        |
| purpose   | enum | NOT NULL                        | `interviewer` or `evaluator` |

### `prompt_versions`

| Column            | Type  | Constraints                                   | Description           |
| ----------------- | ----- | --------------------------------------------- | --------------------- |
| prompt_version_id | uuid  | PK, default `gen_random_uuid()`               | Specific version id   |
| prompt_id         | uuid  | FK → `prompts(prompt_id)`                     | Parent prompt link    |
| content           | text  | NOT NULL                                      | Prompt body           |
| version           | int   | NOT NULL, UNIQUE (`prompt_id`, `version`)     | Version number        |

---

## 5. `rubrics` & `rubric_versions`

Version-controlled evaluation criteria.

### `rubrics`

| Column    | Type | Constraints                     | Description                |
| --------- | ---- | ------------------------------- | -------------------------- |
| rubric_id | uuid | PK, default `gen_random_uuid()` | Abstract rubric identifier |
| name      | text | NOT NULL, UNIQUE                | Human-friendly name        |

### `rubric_versions`

| Column            | Type  | Constraints                                   | Description              |
| ----------------- | ----- | --------------------------------------------- | ------------------------ |
| rubric_version_id | uuid  | PK, default `gen_random_uuid()`               | Specific version id      |
| rubric_id         | uuid  | FK → `rubrics(rubric_id)`                     | Parent rubric link       |
| version           | int   | NOT NULL, UNIQUE (`rubric_id`, `version`)     | Version number           |
| rubric_json       | jsonb | NOT NULL                                      | Structured rubric payload|

---

## 6. `job_questions`

Junction table for approved job questions.

| Column      | Type | Constraints                                | Description              |
| ----------- | ---- | ------------------------------------------ | ------------------------ |
| job_id      | uuid | PK, FK → `jobs(job_id)`                    | Composite primary key    |
| question_id | uuid | PK, FK → `questions(question_id)`          | Composite primary key    |

---

## 7. `applications`

Links candidates to jobs.

| Column         | Type | Constraints                                      | Description                          |
| -------------- | ---- | ------------------------------------------------ | ------------------------------------ |
| application_id | uuid | PK, default `gen_random_uuid()`                  | Unique identifier                    |
| candidate_id   | uuid | FK → `candidates(candidate_id)`                  |                                      |
| job_id         | uuid | FK → `jobs(job_id)`, UNIQUE (`candidate_id`, `job_id`) | Prevents duplicate applications |

---

## 8. `interviews`

Central workflow table for interview sessions.

| Column                       | Type | Constraints                                   | Description                                |
| ---------------------------- | ---- | --------------------------------------------- | ------------------------------------------ |
| interview_id                 | uuid | PK, default `gen_random_uuid()`               |                                            |
| application_id               | uuid | FK → `applications(application_id)`, UNIQUE   | One interview per application              |
| interviewer_prompt_version_id| uuid | FK → `prompt_versions(prompt_version_id)`     | Locks interviewer prompt                   |
| evaluator_prompt_version_id  | uuid | FK → `prompt_versions(prompt_version_id)`     | Locks evaluator prompt                     |
| rubric_version_id            | uuid | FK → `rubric_versions(rubric_version_id)`     | Locks rubric                               |
| status                       | enum | NOT NULL                                      | `scheduled`, `completed`, `evaluated`      |
| auth_token                   | text | NULLABLE, UNIQUE                              | Single-use candidate token                 |
| resume_text_cache            | text | NULLABLE                                      | Raw text extracted from resume             |

---

## 9. `interview_questions`

Definitive, ordered script for interviews.

| Column                | Type    | Constraints                     | Description                      |
| --------------------- | ------- | ------------------------------- | -------------------------------- |
| interview_question_id | uuid    | PK, default `gen_random_uuid()` |                                  |
| interview_id          | uuid    | FK → `interviews(interview_id)` |                                  |
| question_id           | uuid    | FK → `questions(question_id)`   |                                  |
| position              | smallint| NOT NULL                        | Order (1, 2, 3, …)               |
| asked_text            | text    | NOT NULL                        | Snapshot of question wording     |

---

## 10. `transcripts`

Stores completed interview output.

| Column         | Type | Constraints                                | Description                 |
| -------------- | ---- | ------------------------------------------ | --------------------------- |
| interview_id   | uuid | PK, FK → `interviews(interview_id)`        | One-to-one relationship     |
| full_text      | text |                                            |                             |
| transcript_json| jsonb|                                            | Structured transcript data  |

---

## 11. `evaluations`

Evaluator LLM results.

| Column             | Type          | Constraints                     | Description                              |
| ------------------ | ------------- | ------------------------------- | ---------------------------------------- |
| evaluation_id      | uuid          | PK, default `gen_random_uuid()` |                                          |
| interview_id       | uuid          | FK → `interviews(interview_id)` | Multiple rows per interview              |
| evaluator_llm_model| text          | NOT NULL                        | e.g. `gpt-4-turbo`                       |
| score              | numeric(5,2)  |                                 |                                          |
| reasoning          | text          |                                 |                                          |
| raw_llm_response   | jsonb         |                                 | Full provider response                   |

---

## 12. `interviewer_queue`

Work queue for the interviewer bot.

| Column       | Type | Constraints                                | Description                         |
| ------------ | ---- | ------------------------------------------ | ----------------------------------- |
| interview_id | uuid | PK, FK → `interviews(interview_id)`        |                                     |
| auth_token   | text | NOT NULL, UNIQUE                           | Candidate access token              |
| payload      | jsonb| NOT NULL                                   | Pre-computed context for the bot    |

---

## 13. `evaluator_queue`

Work queue for evaluator bots.

| Column       | Type | Constraints                                | Description                         |
| ------------ | ---- | ------------------------------------------ | ----------------------------------- |
| interview_id | uuid | PK, FK → `interviews(interview_id)`        |                                     |
| payload      | jsonb| NOT NULL                                   | Pre-computed evaluation payload     |

---

For tables not listed here (outbox tables, audit logs, etc.), consult the Supabase dashboard or migrations directory and append new sections using the same format.

---

## Normalization Notes (3NF Target)

The live schema above still stores tag data inside array columns (`jobs.required_tags`, `questions.tags`). To migrate toward third normal form without losing the reference:

- Introduce a canonical `tags` table (`tag_id`, `name`, `scope`) and bridge tables `job_tags(job_id, tag_id)` and `question_tags(question_id, tag_id)` rather than `text[]` columns. Keep the current arrays documented here until the migration lands.
- If you add those bridge tables, update this document with the additional sections while leaving the historical layout intact so older data loads remain auditable.
- Outbox/auxiliary tables (e.g., `login_link_outbox`) can be appended using the same format once they’re stable enough to document.

This section exists so we can track normalization goals without erasing the current production layout.

### Planned Tables (Post-Normalization)

#### `tags` *(planned)*

| Column | Type | Constraints | Description |
| ------ | ---- | ----------- | ----------- |
| tag_id | uuid | PK, default `gen_random_uuid()` | Unique tag identifier |
| name   | text | NOT NULL, UNIQUE | Human-readable label |
| scope  | enum | NOT NULL | `job`, `question`, or `global` |

#### `job_tags` *(planned bridge)*

| Column | Type | Constraints | Description |
| ------ | ---- | ----------- | ----------- |
| job_id | uuid | PK, FK → `jobs(job_id)` | Composite key |
| tag_id | uuid | PK, FK → `tags(tag_id)` | Composite key |

#### `question_tags` *(planned bridge)*

| Column     | Type | Constraints | Description |
| ---------- | ---- | ----------- | ----------- |
| question_id| uuid | PK, FK → `questions(question_id)` | Composite key |
| tag_id     | uuid | PK, FK → `tags(tag_id)`         | Composite key |
