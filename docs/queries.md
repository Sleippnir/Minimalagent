# Database Operations Reference

End-to-end list of every database call that powers the interview and evaluation pipeline, grouped in execution order. Each section cites the owning code so you can jump straight to the call site.

## 1. Scheduling & Queue Seeding (Edge Function)

```ts
// supabase/functions/schedule-interview/index.ts:80-118
const promptIdsToFetch = [];
if (interviewer_prompt_version_id) promptIdsToFetch.push(interviewer_prompt_version_id);
if (evaluator_prompt_version_id) promptIdsToFetch.push(evaluator_prompt_version_id);

if (promptIdsToFetch.length > 0) {
  const { data: specificPrompts } = await supabaseAdmin
    .from('prompt_versions')
    .select('prompt_version_id, content, prompts(purpose)')
    .in('prompt_version_id', promptIdsToFetch);
}

const promptRes = await supabaseAdmin
  .from('prompt_versions')
  .select('prompt_version_id, content, prompts(purpose)')
  .order('version', { ascending: false });

const rubricRes = await supabaseAdmin
  .from('rubric_versions')
  .select('rubric_version_id')
  .order('version', { ascending: false })
  .limit(1)
  .single();
```

```ts
// supabase/functions/schedule-interview/index.ts:125-138
const { data: interviewData } = await supabaseAdmin
  .from('interviews')
  .insert({
    application_id,
    interviewer_prompt_version_id: interviewerPrompt.prompt_version_id,
    evaluator_prompt_version_id: evaluatorPrompt.prompt_version_id,
    rubric_version_id: rubricRes.data.rubric_version_id,
    resume_text_cache: resumeText,
    auth_token: crypto.randomUUID(),
    status: 'scheduled'
  })
  .select()
  .single();
```

```ts
// supabase/functions/schedule-interview/index.ts:150-167
const { data: questionsData } = await supabaseAdmin
  .from('questions')
  .select('question_id, text, category')
  .in('question_id', question_ids);

const { data: appData } = await supabaseAdmin
  .from('applications')
  .select('candidates(*), jobs(*)')
  .eq('application_id', application_id)
  .single();
```

```ts
// supabase/functions/schedule-interview/index.ts:170-181
const scriptToInsert = questionsData.map((question, index) => ({
  interview_id: newInterviewId,
  question_id: question.question_id,
  position: index + 1,
  asked_text: question.text || ''
}));

if (scriptToInsert.length > 0) {
  await supabaseAdmin.from('interview_questions').insert(scriptToInsert);
}
```

```ts
// supabase/functions/schedule-interview/index.ts:208-214
await supabaseAdmin
  .from('interviewer_queue')
  .insert({
    interview_id: newInterviewId,
    auth_token: authToken,
    payload: payloadForQueue,
  });
```

```ts
// supabase/functions/schedule-interview/index.ts:219-225
await supabaseAdmin
  .from('login_link_outbox')
  .insert({
    interview_id: newInterviewId,
    candidate_email: appData.candidates.email,
    status: 'pending',
  });
```

## 2. Login Link Fulfilment (Edge Function)

```ts
// supabase/functions/send-login-links/index.ts:73-84
const { data, error } = await admin
  .from("interviews")
  .select("application_id, applications:application_id ( jobs:job_id ( title ), candidates:candidate_id ( first_name, last_name ) )")
  .eq("interview_id", interviewId)
  .single();
```

```ts
// supabase/functions/send-login-links/index.ts:88-121
const { data: rows } = await admin
  .from("login_link_outbox")
  .select("*")
  .eq("status", "pending")
  .order("created_at", { ascending: true })
  .limit(limit);

await admin.from("login_link_outbox").update({
  status: "sent",
  action_link: actionLink,
  token_expires_at: expiresAt,
  tries: r.tries + 1,
  updated_at: new Date().toISOString()
}).eq("id", r.id);

await admin.from("login_link_outbox").update({
  status: r.tries + 1 >= 5 ? "failed" : "pending",
  tries: r.tries + 1,
  last_error: String(e),
  updated_at: new Date().toISOString()
}).eq("id", r.id);
```

## 3. Interview Context Retrieval (API + Bot)

```python
# interview/context_service/services.py:34-75
results = await self.client.get("interviewer_queue", {"auth_token": auth_token})
results = await self.client.get("evaluator_queue", {"auth_token": auth_token})
results = await self.client.get("evaluator_queue", {"limit": 1, "order": "created_at"})
results = await self.client.get("evaluator_queue", {"interview_id": interview_id})
```

```python
# interview/context_service/client.py:24-66
response = await client.get(url, headers=self.headers, params=params)   # REST GET /rest/v1/{table}
response = await client.post(url, headers=self.headers, json=data)      # REST POST /rest/v1/{table}
response = await client.patch(url, headers=self.headers, params=params, json=data)  # REST PATCH /rest/v1/{table}
```

## 4. Transcript Persistence Paths

```python
# interview/context_service/services.py:115-150
await self.client.post("transcripts", transcript_data)
await self.client.patch("interviews", {"interview_id": interview_id}, {"status": "completed"})
```

```python
# interview/context_service/interview_repository.py:84-103
self.supabase.table("transcripts").insert({
    "interview_id": interview_id,
    "transcript_json": transcript_data["transcript_json"],
    "full_text": transcript_data["full_text"],
}).execute()

self.supabase.table("interviews").update(
    {"status": "completed", "completed_at": "now()"}
).eq("interview_id", interview_id).execute()
```

## 5. Supabase Payload Builders & Recovery Jobs

```sql
-- supabase/generate_interview_payload.sql:22-137
SELECT ... FROM interviews
JOIN applications ... JOIN candidates ... JOIN jobs ...
JOIN prompt_versions ... JOIN questions ...

INSERT INTO interviewer_queue (interview_id, auth_token, candidate, job, questions, interviewer_prompt, evaluation_materials, created_at)
VALUES (... JSONB payload ...)
ON CONFLICT (auth_token) DO UPDATE SET ...;
```

```ts
// supabase/functions/reprocess-interview/index.ts:30-105
const { data: interviewData } = await supabaseAdmin
  .from('interviews')
  .select(`auth_token, resume_text_cache, interviewer_prompt_version_id, application:applications (...), script:interview_questions (...)`)
  .eq('interview_id', interview_id)
  .single();

const { data: promptData } = await supabaseAdmin
  .from('prompt_versions')
  .select('content')
  .eq('prompt_version_id', interviewData.interviewer_prompt_version_id)
  .single();

await supabaseAdmin
  .from('interviewer_queue')
  .upsert({ interview_id, auth_token: interviewData.auth_token, payload: payloadForQueue });

await supabaseAdmin
  .from('interviews')
  .update({ status: 'scheduled' })
  .eq('interview_id', interview_id);
```

```sql
-- supabase/reprocess_stuck_interviews_updated.sql:17-53
FOR stuck_interview IN
    SELECT i.interview_id
    FROM public.interviews i
    LEFT JOIN public.interviewer_queue iq ON i.interview_id = iq.interview_id
    WHERE i.created_at < now() - interval '5 minutes' AND iq.interview_id IS NULL
LOOP
    UPDATE public.interviews
    SET status = 'scheduled', updated_at = NOW()
    WHERE interview_id = stuck_interview.interview_id;

    PERFORM net.http_post(... 'reprocess-interview' ...);
END LOOP;
```

```sql
-- Supabase trigger (provided via Supabase console, not versioned here)
SELECT jsonb_build_object(...) INTO evaluator_payload FROM interviews
JOIN applications ... JOIN candidates ... JOIN jobs ...
JOIN transcripts ... JOIN prompt_versions ... JOIN rubric_versions ... JOIN rubrics ...
JOIN interview_questions ... JOIN questions ...

INSERT INTO public.evaluator_queue (interview_id, payload) VALUES (NEW.interview_id, evaluator_payload);
DELETE FROM public.interviewer_queue WHERE interview_id = NEW.interview_id;
```

## 6. Evaluation Queue Consumption

```python
# interview/evaluator/background_evaluator.py:304-337
await evaluation_repo.create(evaluation_1)  # inserts into evaluations via SupabaseBaseRepository
await evaluation_repo.create(evaluation_2)
await evaluation_repo.create(evaluation_3)

self.context_service.interview_repo.supabase.table("interviews").update(
    {"status": "evaluated"}
).eq("interview_id", interview_id).execute()
```

```python
# interview/context_service/evaluator_repository.py:205-360
self.supabase.table("evaluator_payloads").select("*").eq("evaluator_id", evaluator_id).execute()
self.supabase.table("evaluator_results").select("*").eq("interview_id", interview_id).execute()
await self.create(result)  # inserts into evaluator_results via Supabase REST
self.supabase.table("evaluations").select("*").eq("interview_id", interview_id).execute()
self.supabase.table("evaluations").select("*").eq("interview_id", interview_id).eq("evaluator_llm_model", model).limit(1).execute()
```

```python
# interview/context_service/services.py:162-212
await self.client.post("evaluations", evaluation_data)
existing_evaluations = await self.client.get("evaluations", {"interview_id": interview_id})
await self.client.patch("interviews", {"interview_id": interview_id}, {"status": "evaluated"})
```

## 7. Optional Repository Helpers

```python
# interview/context_service/interview_repository.py:25-73
self.supabase.table("interviews").select("*").eq("interview_id", interview_id).execute()
self.supabase.table("transcripts").select("*").eq("interview_id", interview_id).execute()
self.supabase.table("interviews").update(data).eq("interview_id", interview.interview_id).execute()
```

These snippets cover every SELECT, INSERT, UPDATE, UPSERT, and DELETE executed across the pipeline so you can audit or adapt the underlying data flow quickly.***
