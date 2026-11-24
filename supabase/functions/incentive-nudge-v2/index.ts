// incentive-nudge-v2: personal emails to technicians for the incentive v2 scheme (rules of the 5 Nov 2026 mail).
// Written 24 Nov 2026 (Shivani's request: automatic mails like the old incentive-nudge, which was switched off on 16 Nov).
//
// Who: technicians in incentive_technicians (Technician Nomenclature Map) with an email and a billed job card in the last 21 days.
// When (cron, suggested 02:30 UTC = 08:00 IST on Mon, Wed, Fri: '30 2 * * 1,3,5'):
//   Monday    - last week's result (points, target, above/below, rate, earned) and this week's target
//   Wednesday - points so far this week, target so far, points still needed
//   Friday    - final push: how far they are and what is needed before Sunday
// Until a technician has opened My Incentive once (no row in incentive_login_lock), they get ONLY the login mail (24 Nov, Shivani); after that the mails above.
//
// Query options (for testing):  ?dry=1      -> no mail is sent; returns the subjects and a preview of the first mails
//                               ?type=mon|wed|fri|login  -> force a mail type (default: by IST weekday; other days send nothing)
//                               ?to=a@b.com -> send every mail to this one address instead of the technicians (test run)
//                               ?only=Name  -> only this technician (Normalized Name)
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, NUDGE_FROM_EMAIL (default incentive@bounceops.online),
//      NUDGE_SUMMARY_TO (optional, comma-separated: who gets the batch summary).
// Data: incentive_jc_points (points, def_7d), incentive_day_points (days present), incentive_technicians, incentive_login_lock.
// Rate and pay are worked out like the dashboard page (v8/incentive-v2.html): target per day by city and week, 7-day defect rate on the
// job cards of the week and the week before, the city's cut-offs from the 5 Nov mail. Freelancer job cards are not in incentive_jc_points.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = Deno.env.get('NUDGE_FROM_EMAIL') ?? 'incentive@bounceops.online';
const SUMMARY_TO = (Deno.env.get('NUDGE_SUMMARY_TO') ?? '').split(',').map(s => s.trim()).filter(Boolean);
const APP = 'https://www.bounceops.online';
const ACTIVE_DAYS = 21;

// Caller check (24 Nov 2026, Vamsee's window): only the service role may run this. The public anon key also passes verify_jwt, and this
// function returns technician emails with ?dry=1 and can mail any address with ?to=. Deploy with verify_jwt = true; the cron sends the
// service-role key (from Vault, not copied from another job's command).
function isServiceRole(req: Request): boolean {
  const tok = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return !!SB_KEY && tok === SB_KEY;
}

// same as the page: cut-offs (5 Nov mail) and target per day present by week start
const CUTS: Record<string, number[]> = { Bangalore: [3.5, 5.5, 7, 9.5], NCR: [3, 5, 7, 8.5], 'Hyderabad+Mumbai': [1.5, 4, 5, 6.5] };
const TARGET_STEPS: Record<string, [string, number][]> = {
  Bangalore: [['2026-11-02', 7], ['2026-11-30', 7.5], ['2026-12-28', 8]],
  other: [['2026-11-02', 6], ['2026-11-30', 6.5], ['2026-12-28', 7]],
};
const grp = (city: string) => city === 'Bangalore' ? 'Bangalore' : city === 'NCR' ? 'NCR' : 'Hyderabad+Mumbai';
function targetFor(city: string, ws: string): number {
  const steps = TARGET_STEPS[city === 'Bangalore' ? 'Bangalore' : 'other']; let t = steps[0][1];
  for (const [d, v] of steps) if (ws >= d) t = v; return t;
}
function rateFor(city: string, pct: number): number {
  const c = CUTS[grp(city)]; return pct <= c[0] ? 40 : pct <= c[1] ? 30 : pct <= c[2] ? 20 : pct <= c[3] ? 10 : 0;
}

// IST dates
const ist = () => new Date(Date.now() + 5.5 * 3600_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);
function addDays(s: string, n: number) { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
function mondayOf(s: string) { const d = new Date(s + 'T00:00:00Z'); return addDays(s, -((d.getUTCDay() + 6) % 7)); }
const fmt = (n: number, d = 2) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: d });
const rs = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const dayLbl = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

type Week = { ws: string; points: number; days: number; jcs: number; defects: number; target: number; above: number; pct: number | null; rate: number; pay: number };

function week(ws: string, city: string, jcs: any[], days: any[]): Week {
  const inW = (d: string) => d >= ws && d < addDays(ws, 7);
  const prevWs = addDays(ws, -7); const inP = (d: string) => d >= prevWs && d < ws;
  const wj = jcs.filter(j => inW(j.billed_date)); const pj = jcs.filter(j => inP(j.billed_date));
  const points = wj.reduce((a, j) => a + Number(j.points || 0), 0);
  const dp = days.filter(d => inW(d.d)).reduce((a, d) => a + Number(d.present || 0), 0);
  const tpd = targetFor(city, ws); const target = tpd * dp; const above = Math.max(0, points - target);
  const J = wj.length + pj.length; const D = wj.filter(j => j.def_7d).length + pj.filter(j => j.def_7d).length;
  const pct = J ? 100 * D / J : null; const rate = pct === null ? 0 : rateFor(city, pct);
  return { ws, points, days: dp, jcs: wj.length, defects: wj.filter(j => j.def_7d).length, target, above, pct, rate, pay: above * rate };
}

function loginBlock() {
  return `<div style="background:#EEF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px 16px;margin:0 0 18px">
  <p style="margin:0 0 6px;font-weight:700;color:#1E3A8A">How to log in (one time)</p>
  <ol style="margin:0;padding-left:20px;color:#1F2937;font-size:14px;line-height:1.6">
   <li>Open <a href="${APP}" style="color:#1D4ED8">www.bounceops.online</a> on your phone</li>
   <li>Enter <b>this email ID</b> and tap Send link</li>
   <li>Open the link FleetPro sends to this email</li>
   <li>Tap <b>My Incentive (NEW)</b></li></ol></div>`;
}
function box(label: string, value: string, color = '#111827') {
  return `<td style="background:#F9FAFB;border-radius:12px;padding:12px;text-align:center;width:33%"><p style="margin:0;font-size:22px;font-weight:800;color:${color}">${value}</p><p style="margin:4px 0 0;font-size:11px;color:#6B7280;text-transform:uppercase">${label}</p></td>`;
}

function buildMail(type: string, t: any, cur: Week, last: Week, loggedIn: boolean, asOf: string) {
  const first = String(t.name).split(' ')[0];
  const tpd = targetFor(t.city, cur.ws);
  let subject = '', main = '';
  if (type === 'login') {
    subject = `${first}, log in to FleetPro to see your incentive`;
    main = `<p style="font-size:15px;color:#374151;margin:0 0 12px">Your incentive is now on <b>My Incentive</b> in FleetPro. Please log in once using the steps above. After that you can <b>track your incentives here every day</b>: points, target and earnings.</p>`;
  } else if (type === 'mon') {
    const ok = last.above > 0;
    subject = ok ? `${first}, last week you earned ${rs(last.pay)}. This week's target: ${tpd} points a day`
                 : `${first}, last week ${fmt(Math.max(0, last.target - last.points))} points short. This week: ${tpd} points a day`;
    main = `<p style="margin:0 0 8px;font-weight:700">Last week (${dayLbl(last.ws)} to ${dayLbl(addDays(last.ws, 6))})</p>
      <table width="100%" cellpadding="0" cellspacing="6"><tr>${box('Points', fmt(last.points))}${box('Target', fmt(last.target))}${box(ok ? 'Earned (provisional)' : 'Earned', rs(last.pay), ok ? '#15803D' : '#6B7280')}</tr></table>
      <p style="font-size:14px;color:#374151">${ok ? `You were <b>${fmt(last.above)} points above target</b> at <b>${rs(last.rate)} a point</b>${last.pct !== null ? ` (defect rate ${fmt(last.pct, 1)}%)` : ''}.`
        : `You were below target, so last week pays nothing. Nothing carries over: <b>this week is a fresh start</b>.`}</p>
      <p style="font-size:14px;color:#374151;margin:12px 0 0"><b>This week's target:</b> ${tpd} points for every day you are present.</p>`;
  } else {
    const need = Math.max(0, cur.target - cur.points);
    const fri = type === 'fri';
    const fresh = cur.days === 0 && cur.points === 0;                // nothing billed or present yet this week
    subject = fresh ? `${first}, this week's target: ${tpd} points a day`
            : need > 0 ? `${first}, ${fmt(need)} more points to reach your target${fri ? ' before Sunday' : ''}`
            : cur.points > cur.target ? `${first}, you are ${fmt(cur.points - cur.target)} points above target. Keep going!`
            : `${first}, you have reached your target. Every point from now on is paid!`;
    main = `<p style="margin:0 0 8px;font-weight:700">This week so far (to ${dayLbl(asOf)})</p>
      <table width="100%" cellpadding="0" cellspacing="6"><tr>${box('Points', fmt(cur.points))}${box('Target so far', fmt(cur.target))}${box(need > 0 ? 'Still needed' : 'Above target', fmt(need > 0 ? need : cur.points - cur.target), need > 0 ? '#B45309' : '#15803D')}</tr></table>
      <p style="font-size:14px;color:#374151">${need > 0 ? `You need <b>${fmt(need)} more points</b> to cross your target${fri ? ' <b>before Sunday</b>' : ''}. Only points above the target are paid, up to <b>₹40 a point</b>.`
        : `Every point above target is paid at your rate (now <b>${rs(cur.rate)}</b> a point). Fewer bikes coming back in 7 days = a higher rate.`}</p>
      <p style="font-size:12px;color:#6B7280">Target = ${tpd} points × ${fmt(cur.days, 1)} days present so far. A job card = 0.25 + the standard time of the parts fitted.</p>`;
  }
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 12px">
<table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#E8191C;padding:18px 20px"><p style="margin:0;color:#fff;font-size:12px;letter-spacing:1px;text-transform:uppercase">Bounce · Technician Incentive</p>
<p style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:700">Hi ${esc(first)} 👋</p><p style="margin:2px 0 0;color:#FEE2E2;font-size:12px">${esc(t.hub || '')}${t.hub && t.city ? ' · ' : ''}${esc(t.city || '')}</p></td></tr>
<tr><td style="padding:20px">${loggedIn ? '' : loginBlock()}${main}
<a href="${APP}" style="display:block;background:#E8191C;color:#fff;text-align:center;padding:14px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;margin-top:16px">Track your incentives here →</a>
<p style="font-size:11px;color:#9CA3AF;text-align:center;margin:12px 0 0">Points are updated every morning. Week = Monday to Sunday. Rate is final 7 days after the week ends.</p></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

Deno.serve(async (req) => {
  if (!isServiceRole(req)) return new Response(JSON.stringify({ error: 'service role only' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const u = new URL(req.url);
    const dry = u.searchParams.get('dry') === '1';
    const testTo = u.searchParams.get('to');
    const only = u.searchParams.get('only');
    const today = iso(ist());
    const wd = ist().getUTCDay();                                   // 1 Mon, 3 Wed, 5 Fri
    const type = u.searchParams.get('type') ?? (wd === 1 ? 'mon' : wd === 3 ? 'wed' : wd === 5 ? 'fri' : '');
    if (!type) return new Response(JSON.stringify({ sent: 0, note: 'no mail on this weekday' }), { status: 200 });

    const sb = createClient(SB_URL, SB_KEY);
    const curWs = mondayOf(today); const lastWs = addDays(curWs, -7); const from = addDays(curWs, -14);
    const asOf = addDays(today, -1);                                // data is filled to yesterday

    const [techR, jcR, dayR, lockR] = await Promise.all([
      sb.from('incentive_technicians').select('name_normalized,email,hub_name,city'),
      sb.from('incentive_jc_points').select('technician,billed_date,points,def_7d').gte('billed_date', from < addDays(today, -ACTIVE_DAYS) ? from : addDays(today, -ACTIVE_DAYS)).limit(20000),
      sb.from('incentive_day_points').select('technician,d,present').gte('d', from).limit(20000),
      sb.from('incentive_login_lock').select('technician'),
    ]);
    for (const r of [techR, jcR, dayR, lockR]) if (r.error) throw new Error(r.error.message);
    const jcBy = new Map<string, any[]>(); for (const j of jcR.data!) (jcBy.get(j.technician) ?? jcBy.set(j.technician, []).get(j.technician))!.push(j);
    const dayBy = new Map<string, any[]>(); for (const d of dayR.data!) (dayBy.get(d.technician) ?? dayBy.set(d.technician, []).get(d.technician))!.push(d);
    const locked = new Set(lockR.data!.map((x: any) => x.technician));
    const activeFrom = addDays(today, -ACTIVE_DAYS);

    // one entry per technician with a valid email and a billed job card in the last 21 days
    const seen = new Set<string>(); const targets: any[] = [];
    for (const t of techR.data!) {
      const name = t.name_normalized; const email = String(t.email ?? '').trim().toLowerCase();
      if (!name || seen.has(name) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      if (only && name !== only) continue;
      const js = jcBy.get(name) ?? []; if (!js.some(j => j.billed_date >= activeFrom)) continue;
      seen.add(name); targets.push({ name, email, hub: t.hub_name, city: t.city || 'Bangalore', jcs: js, days: dayBy.get(name) ?? [] });
    }

    let sent = 0; const errors: string[] = []; const preview: any[] = [];
    for (const t of targets) {
      const cur = week(curWs, t.city, t.jcs, t.days), last = week(lastWs, t.city, t.jcs, t.days);
      // 24 Nov (Shivani): until a technician has opened My Incentive once, send ONLY the login mail (no target or points)
      const loggedIn = locked.has(t.name);
      const m = buildMail(loggedIn ? type : 'login', t, cur, last, loggedIn, asOf);
      if (dry) { if (preview.length < 3) preview.push({ to: t.email, subject: m.subject, html: m.html }); else preview.push({ to: t.email, subject: m.subject }); continue; }
      const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to: testTo || t.email, subject: m.subject, html: m.html }) });
      if (res.ok) sent++; else errors.push(`${t.name}: ${(await res.text()).slice(0, 200)}`);
      await new Promise(r => setTimeout(r, 550));                    // Resend: about 2 a second
      if (testTo && sent >= 3) break;                                // a test run sends at most 3 mails
    }

    if (!dry && SUMMARY_TO.length) await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: SUMMARY_TO, subject: `Incentive v2 mails (${type}): ${sent}/${targets.length} sent, ${today}`,
        html: `<p>Type: <b>${type}</b>. Technicians: ${targets.length}. Sent: <b>${sent}</b>. Not opened My Incentive yet: ${targets.filter(x => !locked.has(x.name)).length}.</p>${errors.length ? `<p style="color:#B91C1C">${errors.length} error(s): ${errors.slice(0, 5).map(esc).join('<br>')}</p>` : ''}` }) });

    return new Response(JSON.stringify({ type, today, technicians: targets.length, sent, dry, errors: errors.slice(0, 5), preview: dry ? preview : undefined }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('incentive-nudge-v2', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
