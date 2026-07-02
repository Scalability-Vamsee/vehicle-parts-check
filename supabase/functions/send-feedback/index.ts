// send-feedback — saves technician feedback to DB and emails vamsee@bounceshare.com
// verify_jwt: false  (called with anon key from incentive.html)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SB_URL         = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY     = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL     = Deno.env.get('NUDGE_FROM_EMAIL') ?? 'incentive@bounceops.online';
const FEEDBACK_TO    = 'vamsee@bounceshare.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    const { tech_name, email, hub_name, message } = await req.json();

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const sb = createClient(SB_URL, SB_SERVICE_KEY);

    // 1. Persist to DB
    const { error: dbErr } = await sb.from('incentive_feedback').insert({
      tech_name: tech_name || null,
      email:     email     || null,
      hub_name:  hub_name  || null,
      message:   message.trim(),
    });
    if (dbErr) console.error('DB insert error:', dbErr.message);

    // 2. Email Vamsee via Resend
    const displayName = tech_name || email || 'Unknown';
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to:   FEEDBACK_TO,
        subject: `💬 Incentive Feedback — ${displayName}`,
        html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
<table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <tr><td style="background:#E8191C;padding:20px 24px;">
    <p style="margin:0;color:#fff;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Bounce Fleet · Technician Feedback</p>
    <h2 style="margin:6px 0 0;color:#fff;font-size:20px;">💬 New Feedback</h2>
  </td></tr>

  <tr><td style="padding:24px;">
    <table width="100%" style="font-size:13px;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:6px 0;color:#6B7280;font-weight:700;width:80px;">Name</td>
          <td style="padding:6px 0;color:#111827;">${tech_name || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#6B7280;font-weight:700;">Email</td>
          <td style="padding:6px 0;color:#111827;">${email || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#6B7280;font-weight:700;">Hub</td>
          <td style="padding:6px 0;color:#111827;">${hub_name || '—'}</td></tr>
    </table>
    <div style="padding:16px;background:#FEF2F2;border-left:4px solid #E8191C;border-radius:0 8px 8px 0;">
      <p style="margin:0;font-size:14px;color:#111827;line-height:1.7;">${message.trim().replace(/\n/g, '<br>')}</p>
    </div>
  </td></tr>

  <tr><td style="background:#F9FAFB;padding:12px 24px;border-top:1px solid #E5E7EB;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9CA3AF;">Bounce Fleet Operations · bounceops.online</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error('Resend error:', errBody);
      // Feedback is already saved to DB — still return ok to the tech
    }

    console.log(`send-feedback: saved + emailed for ${displayName}`);
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    console.error('send-feedback fatal:', e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
