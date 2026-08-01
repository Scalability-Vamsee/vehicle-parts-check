import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SB_URL  = Deno.env.get('SUPABASE_URL')!;
const SB_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND  = Deno.env.get('RESEND_API_KEY')!;
const MB_URL  = 'http://metabaselatest-dy7gqwqrma-el.a.run.app';
const MB_CARD = '703fa2b6-0b00-4383-aead-9b06ae176a3b';
const ALERT_TO = 'vamsee@bounceshare.com';

interface Row {
  id: string;
  reg_number: string;
  chassis_number: string;
  odo_km: string;
  hub_name: string;
  hub_id: string;
  intrip: string;
  status: string;
  created_at: string;
  user_id: string;
  booking_id: string;
}

Deno.serve(async () => {
  const sb = createClient(SB_URL, SB_KEY);

  // 1. Fetch Metabase CSV
  const mbRes = await fetch(`${MB_URL}/api/public/card/${MB_CARD}/query/csv`);
  if (!mbRes.ok) return new Response(`Metabase fetch failed: ${mbRes.status}`, { status: 500 });
  const csv = await mbRes.text();

  // 2. Parse CSV — RFC 4180 compliant (handles JSON fields with commas/newlines)
  function parseCSV(text: string): Record<string, string>[] {
    const allRows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
        else if (ch === '"') { inQuotes = false; }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\r') { /* skip */ }
        else if (ch === '\n') { row.push(field); field = ''; allRows.push(row); row = []; }
        else { field += ch; }
      }
      i++;
    }
    row.push(field);
    if (row.length > 1 || row[0] !== '') allRows.push(row);
    if (allRows.length === 0) return [];
    const hdrs = allRows[0];
    return allRows.slice(1).map(r => {
      const obj: Record<string, string> = {};
      hdrs.forEach((h, idx) => { obj[h] = r[idx] ?? ''; });
      return obj;
    });
  }
  const rows: Row[] = parseCSV(csv) as unknown as Row[];

  // 3. Filter only failure rows
  const failures = rows.filter(r =>
    r.status && r.status.toLowerCase().startsWith('draft job card creation failed')
  );

  if (failures.length === 0)
    return new Response('No failures in dataset', { status: 200 });

  // 4. Check which IDs already alerted
  const failureIds = failures.map(r => parseInt(r.id)).filter(Boolean);
  const { data: alerted } = await sb
    .from('jc_failure_alert_log')
    .select('job_card_id')
    .in('job_card_id', failureIds);

  const alertedSet = new Set((alerted || []).map((r: any) => r.job_card_id));
  const newFailures = failures.filter(r => !alertedSet.has(parseInt(r.id)));

  if (newFailures.length === 0)
    return new Response('No new failures to alert', { status: 200 });

  // 5. Build email
  const fmtTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return ts; }
  };

  const tableRows = newFailures.map(r => `
    <tr style="background:${r.intrip === 'true' ? '#FEF2F2' : '#fff'}">
      <td>${r.id}</td>
      <td><b>${r.reg_number}</b></td>
      <td>${r.chassis_number || '—'}</td>
      <td>${r.odo_km ? Number(r.odo_km).toLocaleString() + ' km' : '—'}</td>
      <td>${r.hub_name || r.hub_id || '—'}</td>
      <td style="color:${r.intrip === 'true' ? '#DC2626' : '#374151'};font-weight:${r.intrip === 'true' ? '700' : '400'}">
        ${r.intrip === 'true' ? '🔴 RUNNING REPAIR' : 'GENERAL SERVICES (Repossessed)'}
      </td>
      <td>${r.status.replace('draft job card creation failed :', '')}</td>
      <td>${fmtTime(r.created_at)}</td>
    </tr>`).join('');

  const intripCount = newFailures.filter(r => r.intrip === 'true').length;
  const subjectPrefix = intripCount > 0 ? `🔴 ${intripCount} running repair · ` : '';

  const html = `
    <div style="font-family:sans-serif;max-width:900px">
      <h2 style="color:#DC2626">🚨 Draft JC Creation Failures — ${newFailures.length} new</h2>
      ${intripCount > 0 ? `<p style="color:#DC2626;font-weight:700">${intripCount} failure(s) are for running repair bikes — immediate attention needed.</p>` : ''}
      <table border="1" cellpadding="8" style="border-collapse:collapse;font-size:13px;width:100%">
        <tr style="background:#F3F4F6">
          <th>JC ID</th><th>Reg</th><th>Chassis</th><th>Odo</th>
          <th>Hub</th><th>Type</th><th>Failure Reason</th><th>Time (IST)</th>
        </tr>
        ${tableRows}
      </table>
      <p style="font-size:11px;color:#9CA3AF;margin-top:16px">
        FleetPro · jc-failure-alert · runs every 10 min
      </p>
    </div>`;

  // 6. Send email
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'FleetPro Alerts <alerts@bounceops.online>',
      to: ALERT_TO,
      subject: `${subjectPrefix}${newFailures.length} JC creation failure${newFailures.length > 1 ? 's' : ''} — ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}`,
      html
    })
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    return new Response(`Resend failed: ${err}`, { status: 500 });
  }

  // 7. Log alerted IDs
  await sb.from('jc_failure_alert_log').insert(
    newFailures.map(r => ({ job_card_id: parseInt(r.id), status: r.status }))
  );

  return new Response(`Alerted: ${newFailures.length} failures (${intripCount} running repair)`, { status: 200 });
});
