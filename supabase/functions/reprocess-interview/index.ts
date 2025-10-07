// supabase/functions/reprocess-interview/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RequestPayload {
  interview_id: string;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }});
  }

  try {
    const { interview_id }: RequestPayload = await req.json();
    if (!interview_id) {
      throw new Error("Missing required field: interview_id");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch all necessary data for the given interview_id
    const { data: interviewData, error: interviewError } = await supabaseAdmin
      .from('interviews')
      .select(`
        auth_token,
        resume_text_cache,
        interviewer_prompt_version_id,
        application:applications (
          candidate:candidates (*),
          job:jobs (*)
        ),
        script:interview_questions (
          position,
          question:questions (question_id, text, category)
        )
      `)
      .eq('interview_id', interview_id)
      .single();

    if (interviewError) throw new Error(`Failed to fetch interview details: ${interviewError.message}`);
    if (!interviewData?.application?.candidate || !interviewData?.application?.job) {
        throw new Error(`Orphaned interview found: ${interview_id}. Missing candidate or job link.`);
    }

    // 2. Fetch the interviewer prompt content
    const { data: promptData, error: promptError } = await supabaseAdmin
      .from('prompt_versions')
      .select('content')
      .eq('prompt_version_id', interviewData.interviewer_prompt_version_id)
      .single();

    if (promptError) throw new Error(`Failed to fetch prompt content: ${promptError.message}`);

    // 3. Reconstruct the payload for the queue
    const payloadForQueue = {
      candidate: {
        candidate_id: interviewData.application.candidate.candidate_id,
        first_name: interviewData.application.candidate.first_name,
        last_name: interviewData.application.candidate.last_name,
        email: interviewData.application.candidate.email,
      },
      job: {
        job_id: interviewData.application.job.job_id,
        title: interviewData.application.job.title,
        description: interviewData.application.job.description,
      },
      questions: interviewData.script.map(item => ({
        question_id: item.question.question_id,
        text: item.question.text,
        type: item.question.category?.toLowerCase(),
      })).sort((a, b) => a.position - b.position), // Ensure order is correct
      interviewer_prompt: promptData.content,
      evaluation_materials: {
        resume_text: interviewData.resume_text_cache,
        job_description: interviewData.application.job.description,
      }
    };

    // 4. Safely UPSERT the payload into the interviewer_queue
    const { error: queueError } = await supabaseAdmin
      .from('interviewer_queue')
      .upsert({
        interview_id: interview_id,
        auth_token: interviewData.auth_token,
        payload: payloadForQueue,
      });

    if (queueError) throw new Error(`Failed to upsert payload into queue: ${queueError.message}`);

    return new Response(JSON.stringify({ success: true, message: `Successfully reprocessed and queued interview ${interview_id}.` }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    });

  } catch (err) {
    console.error('Error in reprocess-interview function:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 500,
    });
  }
});