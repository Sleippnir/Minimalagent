-- Function to automatically detect and reprocess stuck interviews
-- This function finds interviews that are missing from queues or evaluations
-- and calls the reprocess-interview edge function to fix them

CREATE OR REPLACE FUNCTION reprocess_stuck_interviews()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stuck_interview record;
    edge_function_url text := 'https://bbnbrwpkvjncdgcaoiyp.supabase.co/functions/v1/reprocess-interview';
    service_role_key text := current_setting('app.service_role_key', true);
    request_body json;
    response_status integer;
BEGIN
    -- Find interviews created more than 5 minutes ago that are missing from queues
    FOR stuck_interview IN
        SELECT i.interview_id, i.created_at
        FROM public.interviews i
        LEFT JOIN public.interviewer_queue iq ON i.interview_id = iq.interview_id
        WHERE
            i.created_at < now() - interval '5 minutes' AND
            iq.interview_id IS NULL  -- Missing from interviewer_queue
    LOOP
        -- Log the reprocessing attempt
        RAISE NOTICE 'Reprocessing stuck interview_id: % (created: %)', stuck_interview.interview_id, stuck_interview.created_at;

        -- Update interview status back to 'scheduled'
        UPDATE public.interviews
        SET status = 'scheduled', updated_at = NOW()
        WHERE interview_id = stuck_interview.interview_id;

        -- Prepare the request payload
        request_body := json_build_object('interview_id', stuck_interview.interview_id);

        -- Call the edge function using pg_net extension
        PERFORM
            net.http_post(
                url := edge_function_url,
                body := request_body,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || service_role_key
                )
            );

        -- Add a small delay between calls to avoid overwhelming the system
        PERFORM pg_sleep(1);
    END LOOP;

    -- Log completion
    RAISE NOTICE 'Completed reprocessing stuck interviews';
END;
$$;