-- PostgreSQL function to generate interview payload for the interviewer_queue
-- This function should be run in your Supabase SQL editor

CREATE OR REPLACE FUNCTION generate_interview_payload(p_interview_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_interview_record RECORD;
    v_candidate_id UUID;
    v_candidate_first_name TEXT;
    v_candidate_last_name TEXT;
    v_candidate_email TEXT;
    v_job_id UUID;
    v_job_title TEXT;
    v_job_description TEXT;
    v_questions_data JSONB := '[]'::jsonb;
    v_technical_questions JSONB := '[]'::jsonb;
    v_behavioral_questions JSONB := '[]'::jsonb;
BEGIN
    -- Get interview details
    SELECT
        i.interview_id,
        i.auth_token,
        i.resume_text_cache,
        i.application_id,
        i.interviewer_prompt_version_id,
        i.evaluator_prompt_version_id,
        i.rubric_version_id,
        ip.prompt as interviewer_prompt,
        ep.prompt as evaluator_prompt
    INTO v_interview_record
    FROM interviews i
    LEFT JOIN prompt_versions ipv ON i.interviewer_prompt_version_id = ipv.prompt_version_id
    LEFT JOIN prompts ip ON ipv.prompt_id = ip.prompt_id
    LEFT JOIN prompt_versions epv ON i.evaluator_prompt_version_id = epv.prompt_version_id
    LEFT JOIN prompts ep ON epv.prompt_id = ep.prompt_id
    WHERE i.interview_id = p_interview_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Interview not found: %', p_interview_id;
    END IF;

    -- Get candidate and job details
    SELECT
        c.candidate_id,
        c.first_name,
        c.last_name,
        c.email,
        j.job_id,
        j.title,
        j.description
    INTO
        v_candidate_id,
        v_candidate_first_name,
        v_candidate_last_name,
        v_candidate_email,
        v_job_id,
        v_job_title,
        v_job_description
    FROM applications a
    JOIN candidates c ON a.candidate_id = c.candidate_id
    JOIN jobs j ON a.job_id = j.job_id
    WHERE a.application_id = v_interview_record.application_id;

    -- Get technical questions
    SELECT jsonb_agg(
        jsonb_build_object(
            'question_id', q.question_id,
            'text', q.question_text,
            'type', 'technical'
        )
    )
    INTO v_technical_questions
    FROM interview_questions iq
    JOIN questions q ON iq.question_id = q.question_id
    WHERE iq.interview_id = p_interview_id
    AND q.category = 'Technical'
    ORDER BY iq.position;

    -- Get behavioral questions
    SELECT jsonb_agg(
        jsonb_build_object(
            'question_id', q.question_id,
            'text', q.question_text,
            'type', 'behavioral'
        )
    )
    INTO v_behavioral_questions
    FROM interview_questions iq
    JOIN questions q ON iq.question_id = q.question_id
    WHERE iq.interview_id = p_interview_id
    AND q.category = 'Behavioral'
    ORDER BY iq.position;

    -- Combine questions
    v_questions_data := v_technical_questions || v_behavioral_questions;

    -- Insert into interviewer_queue
    INSERT INTO interviewer_queue (
        interview_id,
        auth_token,
        candidate,
        job,
        questions,
        interviewer_prompt,
        evaluation_materials,
        created_at
    ) VALUES (
        v_interview_record.interview_id,
        v_interview_record.auth_token,
        jsonb_build_object(
            'candidate_id', v_candidate_id,
            'first_name', v_candidate_first_name,
            'last_name', v_candidate_last_name,
            'email', v_candidate_email
        ),
        jsonb_build_object(
            'job_id', v_job_id,
            'title', v_job_title,
            'description', v_job_description
        ),
        v_questions_data,
        v_interview_record.interviewer_prompt,
        jsonb_build_object(
            'resume_text', v_interview_record.resume_text_cache,
            'job_description', v_job_description
        ),
        NOW()
    )
    ON CONFLICT (auth_token) DO UPDATE SET
        interview_id = EXCLUDED.interview_id,
        candidate = EXCLUDED.candidate,
        job = EXCLUDED.job,
        questions = EXCLUDED.questions,
        interviewer_prompt = EXCLUDED.interviewer_prompt,
        evaluation_materials = EXCLUDED.evaluation_materials,
        updated_at = NOW();

END;
$$;