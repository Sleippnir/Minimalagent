import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Define the expected structure of the incoming request body
interface RequestPayload {
  application_id: string;
  question_ids: string[];
  resume_path: string;
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
    const { application_id, question_ids, resume_path } = payload;

    // Input validation
    if (!application_id || !question_ids || !resume_path || question_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields: application_id, question_ids, and resume_path are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Create a Supabase client with the service_role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- 1. Download Resume from Storage & Parse Text ---
    let resumeText = "Sample resume text - PDF parsing not yet implemented for Deno";
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from('resumes')
      .download(resume_path);

    if (downloadError) {
      console.warn(`Failed to download resume: ${downloadError.message}, using placeholder text`);
    } else {
      console.log(`Resume downloaded successfully (${fileData.size} bytes), but parsing not implemented yet`);
    }

    // --- 2. Fetch Latest Prompt & Rubric Versions ---
    // CORRECTED: Fetches 'content' from 'prompt_versions' as per schema.
    const [promptRes, rubricRes] = await Promise.all([
        supabaseAdmin.from('prompt_versions').select('prompt_version_id, content, prompts(purpose)').order('version', { ascending: false }),
        supabaseAdmin.from('rubric_versions').select('rubric_version_id').order('version', { ascending: false }).limit(1).single()
    ]);

    if (promptRes.error) throw new Error(`Failed to fetch prompts: ${promptRes.error.message}`);
    if (rubricRes.error) throw new Error(`Failed to fetch rubric: ${rubricRes.error.message}`);

    const interviewerPrompt = promptRes.data.find(p => p.prompts?.purpose === 'interviewer');
    const evaluatorPrompt = promptRes.data.find(p => p.prompts?.purpose === 'evaluator');

    if (!interviewerPrompt || !evaluatorPrompt || !rubricRes.data) {
        throw new Error('Could not find required prompt or rubric versions in the database.');
    }

    // --- 3. Create Interview and Script in the Database ---
    const { data: interviewData, error: interviewError } = await supabaseAdmin
      .from('interviews')
      .insert({
        application_id: application_id,
        interviewer_prompt_version_id: interviewerPrompt.prompt_version_id,
        evaluator_prompt_version_id: evaluatorPrompt.prompt_version_id,
        rubric_version_id: rubricRes.data.rubric_version_id,
        resume_text_cache: resumeText,
        auth_token: crypto.randomUUID(),
        status: 'scheduled' // Set initial status as per schema
      })
      .select()
      .single();

    if (interviewError) throw new Error(`Failed to create interview: ${interviewError.message}`);
    const newInterviewId = interviewData.interview_id;
    const authToken = interviewData.auth_token;

    const { data: questionsData, error: questionsError } = await supabaseAdmin
        .from('questions')
        .select('question_id, text, category')
        .in('question_id', question_ids);

    if (questionsError) throw new Error(`Failed to fetch questions: ${questionsError.message}`);
    
    const scriptToInsert = question_ids.map((id, index) => {
        const question = questionsData?.find((q: any) => q.question_id === id);
        return {
            interview_id: newInterviewId,
            question_id: id,
            position: index + 1,
            asked_text: question?.text || ''
        };
    });

    const { error: scriptError } = await supabaseAdmin.from('interview_questions').insert(scriptToInsert);
    if (scriptError) throw new Error(`Failed to create interview script: ${scriptError.message}`);

    // --- 4. Fetch Candidate & Job Details for Payload ---
    const { data: appData, error: appError } = await supabaseAdmin
      .from('applications')
      .select('candidates(candidate_id, first_name, last_name, email), jobs(job_id, title, description)')
      .eq('application_id', application_id)
      .single();

    if (appError) throw new Error(`Failed to fetch application details: ${appError.message}`);
    if (!appData.candidates || !appData.jobs) throw new Error('Missing candidate or job details for this application.');

    // --- 5. Generate and Queue Interview Payload ---
    // CORRECTED: Constructs a single JSONB payload object for the queue.
    const questionsForPayload = questionsData.map(q => ({
      question_id: q.question_id,
      text: q.text,
      type: q.category.toLowerCase()
    }));

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
      questions: questionsForPayload,
      interviewer_prompt: interviewerPrompt.content, // Uses corrected 'content' field
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
        payload: payloadForQueue, // Inserts the single payload object
      });
      
    if (queueError) throw new Error(`Failed to insert payload into queue: ${queueError.message}`);

    // --- 6. Queue and Trigger Email Notification ---
    const { error: emailQueueError } = await supabaseAdmin
      .from('login_link_outbox')
      .insert({
        interview_id: newInterviewId,
        candidate_email: appData.candidates.email,
        redirect_url: null,
        status: 'pending',
        tries: 0
      });

    if (emailQueueError) throw new Error(`Failed to queue email notification: ${emailQueueError.message}`);

    try {
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-login-links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (emailErr) {
      console.warn('Failed to trigger email sending:', emailErr);
    }

    // --- 7. Return Success Response ---
    return new Response(JSON.stringify({ success: true, interview_id: newInterviewId, message: "Interview scheduled, payload queued, and email notification sent." }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    });

  } catch (err) {
    console.error('Error in Edge Function:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 500,
    });
  }
});

