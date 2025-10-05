#### 1. candidates

Stores candidate information.



| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| candidate_id | uuid | PK, default gen_random_uuid() | Unique identifier |

| first_name | text | | |

| last_name | text | | |

| email | citext | NOT NULL, UNIQUE | Case-insensitive unique contact |

| phone | text | NULLABLE | |

| linkedin_url | text | NULLABLE | |

| resume_path | text | NULLABLE | Path to Supabase Storage file |

| user_id | uuid | FK -> auth.users(id) | Link to Supabase Auth (optional) |



#### 2. jobs

Stores job descriptions and metadata.



| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| job_id | uuid | PK, default gen_random_uuid() | Unique identifier |

| title | text | NOT NULL | |

| description | text | | |

| required_tags | text[] | NULLABLE | Tags for auto-matching questions |



#### 3. questions

Master bank of interview questions.



| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| question_id | uuid | PK, default gen_random_uuid() | Unique identifier |

| text | citext | NOT NULL, UNIQUE | Question text (case-insensitive) |

| ideal_answer | text | | Answer key for evaluator |

| category | text | | E.g., 'Behavioral', 'Technical' |

| tags | text[] | NULLABLE | Tags for job matching |



#### 4. prompts & prompt_versions

Version-controlled LLM instructions.



**prompts**

| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| prompt_id | uuid | PK, default gen_random_uuid() | Abstract prompt ID |

| name | text | NOT NULL, UNIQUE | Human-readable name |

| purpose | enum | NOT NULL | 'interviewer' or 'evaluator' |



**prompt_versions**

| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| prompt_version_id | uuid | PK, default gen_random_uuid() | Specific version ID |

| prompt_id | uuid | FK -> prompts(prompt_id) | Parent prompt link |

| content | text | NOT NULL | Actual prompt text |

| version | integer | NOT NULL, UNIQUE(prompt_id, version) | Version number |



#### 5. rubrics & rubric_versions

Version-controlled evaluation criteria.



**rubrics**

| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| rubric_id | uuid | PK, default gen_random_uuid() | Abstract rubric ID |

| name | text | NOT NULL, UNIQUE | Human-readable name |



**rubric_versions**

| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| rubric_version_id | uuid | PK, default gen_random_uuid() | Specific version ID |

| rubric_id | uuid | FK -> rubrics(rubric_id) | Parent rubric link |

| rubric_json | jsonb | NOT NULL | Structured evaluation criteria |

| version | integer | NOT NULL, UNIQUE(rubric_id, version) | Version number |



### B. Workflow & Relationship Tables



#### 6. job_questions

Junction table for approved job questions.



| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| job_id | uuid | PK, FK -> jobs(job_id) | Composite primary key |

| question_id | uuid | PK, FK -> questions(question_id) | Composite primary key |



#### 7. applications

Links candidates to jobs.



| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| application_id | uuid | PK, default gen_random_uuid() | |

| candidate_id | uuid | FK -> candidates(candidate_id) | |

| job_id | uuid | FK -> jobs(job_id) | UNIQUE(candidate_id, job_id) |



#### 8. interviews

Central workflow table for interview sessions.



| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| interview_id | uuid | PK, default gen_random_uuid() | |

| application_id | uuid | FK -> applications(application_id) | UNIQUE |

| interviewer_prompt_version_id | uuid | FK -> prompt_versions | Locks interviewer prompt |

| evaluator_prompt_version_id | uuid | FK -> prompt_versions | Locks evaluator prompt |

| rubric_version_id | uuid | FK -> rubric_versions | Locks rubric |

| status | enum | NOT NULL | 'scheduled', 'completed', 'evaluated' |

| auth_token | text | NULLABLE, UNIQUE | Single-use JWT for candidate access |

| resume_text_cache | text | NULLABLE | Raw text from resume file |



#### 9. interview_questions

Definitive, ordered script for interviews.



| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| interview_question_id | uuid | PK, default gen_random_uuid() | |

| interview_id | uuid | FK -> interviews(interview_id) | |

| question_id | uuid | FK -> questions(question_id) | |

| position | smallint | NOT NULL | Question order (1, 2, 3...) |

| asked_text | text | NOT NULL | Snapshot of question text |



#### 10. transcripts

Stores completed interview output.



| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| interview_id | uuid | PK, FK -> interviews(interview_id) | One-to-one relationship |

| full_text | text | | |

| transcript_json | jsonb | | |



#### 11. evaluations

Stores evaluator LLM results.



| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| evaluation_id | uuid | PK, default gen_random_uuid() | |

| interview_id | uuid | FK -> interviews(interview_id) | Multiple rows per interview |

| evaluator_llm_model | text | NOT NULL | e.g., 'gpt-4-turbo' |

| score | numeric(5,2) | | |

| reasoning | text | | |

| raw_llm_response | jsonb | | Full JSON response for auditing |



### C. Performance / Queue Tables



#### 12. interviewer_queue

"To-do" list for interviewer AI.



| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| interview_id | uuid | PK, FK -> interviews(interview_id) | |

| auth_token | text | NOT NULL, UNIQUE | Candidate access token for fast lookup |

| payload | jsonb | NOT NULL | Pre-computed data for AI |



#### 13. evaluator_queue

"To-do" list for evaluator AIs.



| Column | Type | Constraints | Description |

|--------|------|-------------|-------------|

| interview_id | uuid | PK, FK -> interviews(interview_id) | |

| payload | jsonb | NOT NULL | Pre-computed data for AI |