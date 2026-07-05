// incentive-nudge — daily personalized email to active technicians
// Cron: 02:30 UTC daily = 08:00 IST
// Reads incentive_weekly_stats → jc_name_aliases → hr_employees for email
// Sends via Resend API (set RESEND_API_KEY in Supabase vault)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SB_URL        = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE_KEY= Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY    = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL    = Deno.env.get('NUDGE_FROM_EMAIL') ?? 'incentive@bounceops.online';
const APP_URL       = 'https://bounceops.online/v8/incentive.html';

// ── IST helpers ──────────────────────────────────────────────────────────────
function istNow()       { return new Date(Date.now() + 5.5 * 3600_000); }
function getWeekStart() {
  const d = istNow();
  const day = d.getUTCDay();                        // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;           // back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ── Tier logic (incremental / bracket-based) ─────────────────────────────────
interface TierInfo {
  tier: number;
  rate: number;
  label: string;
  nextRate: number | null;
  nextAt: number | null;
  needMore: number;
}
function getTierInfo(jcs: number): TierInfo {
  if (jcs <  51) return { tier: 0, rate:   0, label: 'Not yet earning', nextRate:  25, nextAt:  51, needMore: 51 - jcs };
  if (jcs <= 60) return { tier: 1, rate:  25, label: 'Tier 1',          nextRate:  50, nextAt:  61, needMore: 61 - jcs };
  if (jcs <= 80) return { tier: 2, rate:  50, label: 'Tier 2',          nextRate:  75, nextAt:  81, needMore: 81 - jcs };
  if (jcs <= 90) return { tier: 3, rate:  75, label: 'Tier 3',          nextRate: 100, nextAt:  91, needMore: 91 - jcs };
  return           { tier: 4, rate: 100, label: 'Tier 4 (Max)',     nextRate: null, nextAt: null, needMore: 0 };
}

// ── Cumulative payout calc (for display) ────────────────────────────────────
function calcPayout(jcs: number): number {
  if (jcs <  51) return 0;
  let pay = 0;
  pay += Math.min(jcs, 60) - 50;           // T1 bracket: JCs 51-60
  if (jcs > 60) pay += (Math.min(jcs, 80) - 60) * 2;  // T2: ₹50 = 2× base
  if (jcs > 80) pay += (Math.min(jcs, 90) - 80) * 3;  // T3: ₹75 = 3× base
  if (jcs > 90) pay += (jcs - 90) * 4;                // T4: ₹100 = 4× base
  return Math.min(pay * 25, 5000);          // base unit = ₹25
}

// ── Subject line ─────────────────────────────────────────────────────────────
function subject(name: string, jcs: number, ti: TierInfo): string {
  const first = name.split(' ')[0];
  if (ti.tier === 0) return `${first}, ${ti.needMore} more JCs to start earning this week 💪`;
  if (ti.tier === 4) return `${first}, you're at the top tier! Keep it going 🏆`;
  return `${first}, ${ti.needMore} more JCs to unlock ₹${ti.nextRate}/JC this week 🔥`;
}

// ── HTML email ───────────────────────────────────────────────────────────────
function buildHtml(name: string, jcs: number, payout: number, hub: string, ti: TierInfo): string {
  const first    = name.split(' ')[0];
  const fmt      = (n: number) => n.toLocaleString('en-IN');

  const tierBadge = ti.tier === 0
    ? `<span style="background:#F3F4F6;color:#6B7280;padding:4px 12px;border-radius:20px;font-size:13px;">No tier yet</span>`
    : `<span style="background:#FEF3C7;color:#92400E;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:700;">${ti.label} — ₹${ti.rate}/JC</span>`;

  const nudge = ti.tier === 0
    ? `<p style="font-size:15px;color:#374151;">You need <strong>${ti.needMore} more JCs</strong> to start earning (₹${ti.nextRate}/JC at Tier 1).</p>`
    : ti.tier === 4
    ? `<p style="font-size:15px;color:#15803D;font-weight:600;">You're at the top tier! Every JC earns you ₹100. Max payout is ₹5,000 — keep pushing!</p>`
    : `<p style="font-size:15px;color:#374151;">Just <strong>${ti.needMore} more JCs</strong> to reach the next tier and earn <strong>₹${ti.nextRate}/JC</strong> instead of ₹${ti.rate}/JC.</p>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
<table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <tr><td style="background:#E8191C;padding:24px;text-align:center;">
    <p style="margin:0;color:#fff;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Bounce Fleet · Technician Incentive</p>
    <h1 style="margin:8px 0 0;color:#fff;font-size:26px;">Hi ${first} 👋</h1>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:24px;">

    <!-- Stats row -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:#F9FAFB;border-radius:12px;padding:16px;text-align:center;width:48%;">
          <p style="margin:0;font-size:32px;font-weight:800;color:#E8191C;">${jcs}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;">JCs This Week</p>
        </td>
        <td style="width:4%;"></td>
        <td style="background:#F9FAFB;border-radius:12px;padding:16px;text-align:center;width:48%;">
          <p style="margin:0;font-size:32px;font-weight:800;color:#15803D;">₹${fmt(payout)}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;">Earned So Far</p>
        </td>
      </tr>
    </table>

    <!-- Tier badge -->
    <p style="margin:0 0 6px;text-align:center;">${tierBadge}</p>

    <!-- Nudge message -->
    <div style="background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:0 8px 8px 0;padding:12px 16px;margin:16px 0;">
      ${nudge}
    </div>

    <!-- Tier mini-table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:13px;margin-bottom:20px;">
      <tr style="background:#1F2937;color:#fff;">
        <td style="padding:8px 12px;font-weight:700;">JCs / Week</td>
        <td style="padding:8px 12px;font-weight:700;">Rate</td>
        <td style="padding:8px 12px;font-weight:700;">Total Earn</td>
      </tr>
      ${[
        ['1–50',   '—',        '—',          jcs <  51],
        ['51–60',  '₹25/JC',  'Up to ₹250', jcs >= 51 && jcs <= 60],
        ['61–80',  '₹50/JC',  'Up to ₹1,250', jcs >= 61 && jcs <= 80],
        ['81–90',  '₹75/JC',  'Up to ₹2,000', jcs >= 81 && jcs <= 90],
        ['91+',    '₹100/JC', 'Up to ₹5,000', jcs >= 91],
      ].map(([range, rate, earn, active]) =>
        `<tr style="background:${active ? '#FEF3C7' : '#fff'};border-top:1px solid #E5E7EB;">
          <td style="padding:7px 12px;${active ? 'font-weight:700;' : ''}">${range}</td>
          <td style="padding:7px 12px;color:${active ? '#92400E' : '#374151'};${active ? 'font-weight:700;' : ''}">${rate}</td>
          <td style="padding:7px 12px;color:${active ? '#15803D' : '#374151'};${active ? 'font-weight:700;' : ''}">${earn}</td>
        </tr>`
      ).join('')}
    </table>

    <!-- CTA -->
    <a href="${APP_URL}" style="display:block;background:#E8191C;color:#fff;text-align:center;padding:16px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;margin-bottom:16px;">
      Check My Full Dashboard →
    </a>

    <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:0;">
      ${hub} · Week resets every Monday · Quality JCs only
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#F9FAFB;padding:16px;text-align:center;border-top:1px solid #E5E7EB;">
    <p style="margin:0;font-size:11px;color:#9CA3AF;">Bounce Fleet Operations · bounceops.online</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async () => {
  try {
    const sb         = createClient(SB_URL, SB_SERVICE_KEY);
    const week_start = getWeekStart();

    // Join: incentive_weekly_stats → jc_name_aliases → hr_employees
    const { data: techs, error } = await sb.rpc('get_nudge_targets', { p_week_start: week_start });
    if (error) throw new Error(`DB error: ${error.message}`);
    if (!techs?.length) return new Response(JSON.stringify({ sent: 0, week_start }), { status: 200 });

    let sent = 0, skipped = 0;
    const errors: string[] = [];

    for (const t of techs) {
      if (!t.email) { skipped++; continue; }

      const ti     = getTierInfo(t.eligible_jcs);
      const payout = calcPayout(t.eligible_jcs);
      const sub    = subject(t.employee_name ?? t.tech_name, t.eligible_jcs, ti);
      const html   = buildHtml(t.employee_name ?? t.tech_name, t.eligible_jcs, payout, t.hub_name ?? '', ti);

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to: t.email, subject: sub, html }),
      });

      if (res.ok) { sent++; }
      else {
        const body = await res.text();
        errors.push(`${t.email}: ${body}`);
      }

      // 550ms gap — Resend free tier allows 2 req/sec; 550ms = ~1.8/sec safely under limit
      await new Promise(r => setTimeout(r, 550));
    }

    console.log(`incentive-nudge: sent=${sent} skipped=${skipped} errors=${errors.length} week=${week_start}`);

    // ── Summary email to vamsee@bounceshare.com ──────────────────────────────
    const istTime = istNow().toISOString().replace('T', ' ').slice(0, 16) + ' IST';
    const errorLines = errors.length
      ? `<p style="color:#DC2626;font-size:13px;">⚠️ ${errors.length} error(s):<br>${errors.slice(0,5).map(e=>`• ${e}`).join('<br>')}</p>`
      : `<p style="color:#16A34A;font-size:13px;">✅ No errors</p>`;
    const summaryHtml = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:24px;color:#1F2937;">
<h2 style="margin:0 0 16px;">📨 Incentive Nudge — Batch Summary</h2>
<table style="border-collapse:collapse;width:100%;max-width:420px;">
  <tr><td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;">Week</td><td style="padding:8px 12px;border:1px solid #E5E7EB;"><b>${week_start}</b></td></tr>
  <tr><td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;">Run at</td><td style="padding:8px 12px;border:1px solid #E5E7EB;">${istTime}</td></tr>
  <tr><td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;">Targets</td><td style="padding:8px 12px;border:1px solid #E5E7EB;">${techs.length}</td></tr>
  <tr><td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;">Sent</td><td style="padding:8px 12px;border:1px solid #E5E7EB;color:#15803D;"><b>${sent}</b></td></tr>
  <tr><td style="padding:8px 12px;background:#F9FAFB;border:1px solid #E5E7EB;">Skipped (no email)</td><td style="padding:8px 12px;border:1px solid #E5E7EB;">${skipped}</td></tr>
</table>
${errorLines}
</body></html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: 'vamsee@bounceshare.com',
        subject: `Incentive nudge sent: ${sent}/${techs.length} techs — ${week_start}`,
        html: summaryHtml,
      }),
    });

    return new Response(JSON.stringify({ sent, skipped, errors: errors.slice(0, 5), week_start }), { status: 200 });

  } catch (e) {
    console.error('incentive-nudge fatal:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
