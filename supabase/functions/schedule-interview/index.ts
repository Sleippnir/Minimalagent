import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Define the expected structure of the incoming request body
interface RequestPayload {
  application_id: string;
  question_ids: string[];
  resume_path?: string;
  interviewer_prompt_version_id?: string;
  evaluator_prompt_version_id?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }});
  }

  try {
    const payload: RequestPayload = await req.json();
    const { application_id, question_ids, resume_path, interviewer_prompt_version_id, evaluator_prompt_version_id } = payload;

    // Input validation
    if (!application_id || !question_ids || question_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields: application_id and question_ids are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- 1. Resume Handling ---
    let resumeText = "No resume provided - interview will proceed without resume analysis";

    if (resume_path) {
      try {
        // Try to download the resume - decode URL-encoded path if necessary
        const decodedPath = decodeURIComponent(resume_path);
        const { data: resumeData, error: downloadError } = await supabaseAdmin.storage
          .from('resumes')
          .download(decodedPath);

        if (downloadError) {
          console.warn(`Failed to download resume from path "${decodedPath}": ${JSON.stringify(downloadError)}`);
          // Try with original path if decoding failed
          if (decodedPath !== resume_path) {
            const { data: resumeData2, error: downloadError2 } = await supabaseAdmin.storage
              .from('resumes')
              .download(resume_path);
            if (!downloadError2) {
              console.log('Successfully downloaded resume with original path');
              // Note: In a real implementation, you'd process resumeData2 here
            }
          }
        } else {
          console.log(`Successfully downloaded resume from path: ${decodedPath}`);
          // Note: In a real implementation, you'd process resumeData here
          resumeText = "Resume downloaded successfully - PDF parsing not yet implemented for Deno";
        }
      } catch (err) {
        console.warn(`Error during resume download: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // --- 2. Fetch Prompts & Rubric ---
    let interviewerPrompt, evaluatorPrompt;

    const promptIdsToFetch = [];
    if (interviewer_prompt_version_id) promptIdsToFetch.push(interviewer_prompt_version_id);
    if (evaluator_prompt_version_id) promptIdsToFetch.push(evaluator_prompt_version_id);

    if (promptIdsToFetch.length > 0) {
      // Fetch specific prompt versions
      const { data: specificPrompts, error: specificError } = await supabaseAdmin
        .from('prompt_versions')
        .select('prompt_version_id, content, prompts(purpose)')
        .in('prompt_version_id', promptIdsToFetch);

      if (specificError) throw new Error(`Failed to fetch specific prompts: ${specificError.message}`);
      if (!specificPrompts || specificPrompts.length !== promptIdsToFetch.length) {
        throw new Error('Could not find the specified prompt versions.');
      }

      interviewerPrompt = interviewer_prompt_version_id ? specificPrompts.find(p => p.prompt_version_id === interviewer_prompt_version_id) : null;
      evaluatorPrompt = evaluator_prompt_version_id ? specificPrompts.find(p => p.prompt_version_id === evaluator_prompt_version_id) : null;
    }

    // Fetch any missing prompts (latest versions)
    if (!interviewerPrompt || !evaluatorPrompt) {
      const promptRes = await supabaseAdmin
        .from('prompt_versions')
        .select('prompt_version_id, content, prompts(purpose)')
        .order('version', { ascending: false });

      if (promptRes.error) throw new Error(`Failed to fetch prompts: ${promptRes.error.message}`);

      if (!interviewerPrompt) {
        interviewerPrompt = promptRes.data.find(p => p.prompts?.purpose === 'interviewer');
      }
      if (!evaluatorPrompt) {
        evaluatorPrompt = promptRes.data.find(p => p.prompts?.purpose === 'evaluator');
      }
    }

    const rubricRes = await supabaseAdmin
      .from('rubric_versions')
      .select('rubric_version_id')
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (rubricRes.error) throw new Error(`Failed to fetch rubric: ${rubricRes.error.message}`);

    if (!interviewerPrompt || !evaluatorPrompt || !rubricRes.data) {
        throw new Error('Could not find required prompt or rubric versions in the database.');
    }

    // --- 3. Create Interview Record ---
    const { data: interviewData, error: interviewError } = await supabaseAdmin
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

    if (interviewError) {
      // Check for duplicate key constraint violation
      if (interviewError.message.includes('duplicate key value violates unique constraint "interviews_application_id_key"')) {
        throw new Error('An interview has already been scheduled for this candidate and position. Please check existing interviews.');
      }
      throw new Error(`Failed to create interview: ${interviewError.message}`);
    }
    const newInterviewId = interviewData.interview_id;
    const authToken = interviewData.auth_token;

    // --- 4. Fetch Details for Payload ---
    const { data: questionsData, error: questionsError } = await supabaseAdmin
        .from('questions')
        .select('question_id, text, category')
        .in('question_id', question_ids);

    if (questionsError) throw new Error(`Failed to fetch questions: ${questionsError.message}`);

    // CORRECTED: Added a more robust check for related data.
    const { data: appData, error: appError } = await supabaseAdmin
      .from('applications')
      .select('candidates(*), jobs(*)')
      .eq('application_id', application_id)
      .single();

    if (appError) throw new Error(`Failed to fetch application details: ${appError.message}`);
    if (!appData || !appData.candidates || !appData.jobs) {
      throw new Error(`Could not find a valid candidate or job linked to application_id: ${application_id}. The record may be orphaned or deleted.`);
    }
    
    // --- 5. Create Interview Script ---
    const scriptToInsert = questionsData.map((question, index) => ({
        interview_id: newInterviewId,
        question_id: question.question_id,
        position: index + 1,
        asked_text: question.text || ''
    }));

    if (scriptToInsert.length > 0) {
        const { error: scriptError } = await supabaseAdmin.from('interview_questions').insert(scriptToInsert);
        if (scriptError) throw new Error(`Failed to create interview script: ${scriptError.message}`);
    }

    // --- 6. Generate and Queue Interview Payload ---
    const payloadForQueue = {
      candidate: {
        candidate_id: appData.candidates.candidate_id,
        first_name: appData.candidates.first_name,
        last_name: appData.candidates.last_name,
        email: appData.candidates.email,
      },
      job: {
        job_id: appData.jobs.job_id,
        title: appData.jobs.title,
        description: appData.jobs.description,
      },
      questions: questionsData.map(q => ({
        question_id: q.question_id,
        text: q.text,
        type: q.category?.toLowerCase()
      })),
      interviewer_prompt: interviewerPrompt.content,
      evaluation_materials: {
        resume_text: resumeText,
        job_description: appData.jobs.description,
      }
    };

    const { error: queueError } = await supabaseAdmin
      .from('interviewer_queue')
      .insert({
        interview_id: newInterviewId,
        auth_token: authToken,
        payload: payloadForQueue,
      });
      
    if (queueError) throw new Error(`Failed to insert payload into queue: ${queueError.message}`);

    // --- 7. Queue and Trigger Email Notification ---
    const { error: emailQueueError } = await supabaseAdmin
      .from('login_link_outbox')
      .insert({
        interview_id: newInterviewId,
        candidate_email: appData.candidates.email,
        status: 'pending',
      });

    if (emailQueueError) throw new Error(`Failed to queue email notification: ${emailQueueError.message}`);

    // Asynchronously trigger the email sending function without waiting for it to complete
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-login-links`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`},
    }).catch(console.error);

    // --- 8. Return Success ---
    return new Response(JSON.stringify({ success: true, interview_id: newInterviewId, message: "Interview scheduled, payload queued, and email notification sent." }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 200,
    });

  } catch (err) {
    console.error('Error in Edge Function:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 500,
    });
  }
});

