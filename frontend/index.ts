import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import pdf from 'https://esm.sh/pdf-parse@1.1.1';
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
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from('resumes')
      .download(resume_path);

    if (downloadError) throw new Error(`Failed to download resume: ${downloadError.message}`);

    const pdfBuffer = await fileData.arrayBuffer();
    const pdfParsed = await pdf(pdfBuffer);
    const resumeText = pdfParsed.text;

    // --- 2. Fetch Latest Prompt & Rubric Versions ---
    const [promptRes, rubricRes] = await Promise.all([
        supabaseAdmin.from('prompt_versions').select('prompt_version_id, prompts(purpose)').order('version', { ascending: false }),
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
    // This isn't a true transaction, but a sequence of awaits. If one fails, the function will throw.
    
    // a. Create the main interview record
    const { data: interviewData, error: interviewError } = await supabaseAdmin
      .from('interviews')
      .insert({
        application_id: application_id,
        interviewer_prompt_version_id: interviewerPrompt.prompt_version_id,
        evaluator_prompt_version_id: evaluatorPrompt.prompt_version_id,
        rubric_version_id: rubricRes.data.rubric_version_id,
        resume_text_cache: resumeText,
        auth_token: crypto.randomUUID() // Generate a simple UUID as the token
      })
      .select()
      .single();

    if (interviewError) throw new Error(`Failed to create interview: ${interviewError.message}`);
    const newInterviewId = interviewData.interview_id;

    // b. Create the interview script
    const scriptToInsert = question_ids.map((id, index) => ({
      interview_id: newInterviewId,
      question_id: id,
      position: index + 1
    }));
    
    const { error: scriptError } = await supabaseAdmin
        .from('interview_questions')
        .insert(scriptToInsert);

    if (scriptError) throw new Error(`Failed to create interview script: ${scriptError.message}`);

    // --- 4. Call the PG Function to Generate the Payload ---
    const { error: rpcError } = await supabaseAdmin.rpc('generate_interview_payload', {
      p_interview_id: newInterviewId
    });

    if (rpcError) throw new Error(`Failed to generate payload: ${rpcError.message}`);

    // --- 5. Queue Email Notification ---
    // Get candidate email for the login link
    const { data: candidateData, error: candidateError } = await supabaseAdmin
      .from('applications')
      .select('candidates(email)')
      .eq('application_id', application_id)
      .single();

    if (candidateError) throw new Error(`Failed to fetch candidate email: ${candidateError.message}`);

    // Insert into login_link_outbox to trigger email sending
    const { error: emailQueueError } = await supabaseAdmin
      .from('login_link_outbox')
      .insert({
        interview_id: newInterviewId,
        candidate_email: candidateData.candidates.email,
        redirect_url: null, // Will use default in send-login-links function
        status: 'pending',
        tries: 0
      });

    if (emailQueueError) throw new Error(`Failed to queue email notification: ${emailQueueError.message}`);

    // --- 6. Trigger Email Sending ---
    // Call the send-login-links function to process the queued email immediately
    try {
      const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-login-links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!emailResponse.ok) {
        console.warn('Email sending may have failed:', await emailResponse.text());
      } else {
        // Email notification triggered successfully
      }
    } catch (emailErr) {
      console.warn('Failed to trigger email sending:', emailErr);
      // Don't fail the entire interview creation if email fails
    }

    // --- 7. Return Success Response ---
    return new Response(JSON.stringify({ success: true, interview_id: newInterviewId, message: "Interview scheduled, payload queued, and email notification queued successfully." }), {
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

