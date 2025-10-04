import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY"); // or SENDGRID_API_KEY, etc.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: {
    persistSession: false
  }
});
async function ensureUser(email) {
  const { data: list } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    email
  });
  const existing = list?.users?.[0];
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      role: "candidate"
    }
  });
  if (error) throw error;
  return data.user?.id;
}
async function genMagicLink(email, interviewId, redirect) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${redirect}?interview_id=${encodeURIComponent(interviewId)}`
    }
  });
  if (error) throw error;
  // data contains action_link and hashed token metadata
  return {
    actionLink: data.action_link,
    expiresAt: data?.hashed_token?.expires_at ?? null
  };
}
async function sendEmail(to, name, link, jobTitle) {
  const subject = jobTitle ? `Your interview login for ${jobTitle}` : "Your interview login";
  const html = `
    <p>Hi ${name || ""},</p>
    <p>Your interview is ready. Click the secure link to start:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link is single-use and time-limited.</p>
  `;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Hiring <no-reply@yourdomain.com>",
      to: [
        to
      ],
      subject,
      html
    })
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Email send failed: ${resp.status} ${t}`);
  }
}
async function fetchJobTitleAndName(interviewId) {
  const { data, error } = await admin.from("interviews").select("application_id, applications:application_id ( jobs:job_id ( title ), candidates:candidate_id ( first_name, last_name ) )").eq("interview_id", interviewId).single();
  if (error) return {
    job: undefined,
    name: undefined
  };
  const job = data?.applications?.jobs?.title;
  const cand = data?.applications?.candidates;
  const name = cand ? `${cand.first_name ?? ""} ${cand.last_name ?? ""}`.trim() : undefined;
  return {
    job,
    name
  };
}
async function processBatch(limit = 20) {
  // pull pending outbox rows
  const { data: rows, error } = await admin.from("login_link_outbox").select("*").eq("status", "pending").order("created_at", {
    ascending: true
  }).limit(limit);
  if (error) throw error;
  if (!rows?.length) return {
    processed: 0
  };
  for (const r of rows){
    try {
      // ensure user exists
      await ensureUser(r.candidate_email);
      // build redirect
      const redirect = r.redirect_url ?? "http://localhost:8080/auth.html";
      // generate one-time magic link
      const { actionLink, expiresAt } = await genMagicLink(r.candidate_email, r.interview_id, redirect);
      // fetch extras for email copy (optional)
      const { job, name } = await fetchJobTitleAndName(r.interview_id);
      // send email
      await sendEmail(r.candidate_email, name ?? "", actionLink, job);
      // mark sent
      await admin.from("login_link_outbox").update({
        status: "sent",
        action_link: actionLink,
        token_expires_at: expiresAt,
        tries: r.tries + 1,
        updated_at: new Date().toISOString()
      }).eq("id", r.id);
    } catch (e) {
      await admin.from("login_link_outbox").update({
        status: r.tries + 1 >= 5 ? "failed" : "pending",
        tries: r.tries + 1,
        last_error: String(e),
        updated_at: new Date().toISOString()
      }).eq("id", r.id);
    }
  }
  return {
    processed: rows.length
  };
}
serve(async (req)=>{
  // Allow manual trigger or scheduled cron
  if (req.method !== "POST") return new Response("Use POST", {
    status: 405
  });
  const result = await processBatch();
  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json"
    }
  });
});
