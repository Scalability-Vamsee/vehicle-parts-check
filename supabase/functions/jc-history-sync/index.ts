import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const METABASE_URL = "https://metabaselatest-dy7gqwqrma-el.a.run.app/api/public/card/a2c3e48b-1b15-4c14-830d-5d65199d143f/query/csv?parameters=%5B%5D";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_DAYS = 90; // only keep/insert last N days; historical rows stay untouched

async function writeHeartbeat(sb: any, status: string, durationMs: number, rowsAffected: number | null = null, errorMessage: string | null = null) {
  try { await sb.from('sync_heartbeats').insert({ function_name: 'jc-history-sync', status, duration_ms: durationMs, rows_affected: rowsAffected, error_message: errorMessage, synced_at: new Date().toISOString() }); } catch (_) {}
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function coerce(val: string): string | number | null {
  const v = val.trim();
  if (v === '' || v === 'null' || v === 'NULL') return null;
  const num = Number(v);
  if (!isNaN(num) && v !== '') return num;
  return v;
}

Deno.serve(async (_req: Request) => {
  const t0 = Date.now();
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    // Cutoff: only sync rows from the last SYNC_DAYS days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SYNC_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

    const mbRes = await fetch(METABASE_URL);
    if (!mbRes.ok) throw new Error(`Metabase fetch failed: ${mbRes.status}`);
    if (!mbRes.body) throw new Error('No response body');

    // Stream the 45MB CSV — never load it all into memory
    const reader = mbRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let headers: string[] | null = null;
    let ci: Record<string, number> = {};
    let batch: any[] = [];
    let totalInserted = 0;
    let totalSkipped = 0;
    const BATCH = 300;

    const v = (row: string[], col: string): string | number | null =>
      ci[col] !== undefined ? coerce(row[ci[col]] ?? '') : null;

    const flush = async () => {
      if (batch.length === 0) return;
      const { error } = await sb.from('jc_history').insert(batch);
      if (error) throw new Error(`Insert failed: ${error.message}`);
      totalInserted += batch.length;
      batch = [];
    };

    // Delete only the recent window before re-inserting it
    const { error: delError } = await sb
      .from('jc_history')
      .delete()
      .gte('jc_date', cutoffStr);
    if (delError) throw new Error(`Delete failed: ${delError.message}`);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).replace(/\r$/, '');
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;

        const fields = parseLine(line);
        if (!headers) {
          headers = fields;
          fields.forEach((h, i) => { ci[h] = i; });
          continue;
        }

        // Skip rows older than cutoff
        const jcDate = (fields[ci['jc_date']] ?? '').trim();
        if (jcDate < cutoffStr) { totalSkipped++; continue; }

        batch.push({
          jc_no:           v(fields, 'jc_no'),
          bike_id:         v(fields, 'bike_id'),
          reg_number:      v(fields, 'reg_number'),
          bike_odo:        v(fields, 'bike_odo'),
          jc_date:         v(fields, 'jc_date'),
          hub_name:        v(fields, 'hub_name'),
          service_type:    v(fields, 'service_type'),
          line_type:       v(fields, 'line_type'),
          item_name:       v(fields, 'item_name'),
          qty:             v(fields, 'qty'),
          amount:          v(fields, 'amount'),
          technician_name: v(fields, 'technician_name'),
          source:          v(fields, 'source'),
        });
        if (batch.length >= BATCH) await flush();
      }
    }
    await flush();

    await writeHeartbeat(sb, 'success', Date.now() - t0, totalInserted);
    return new Response(JSON.stringify({ success: true, inserted: totalInserted, skipped: totalSkipped, cutoff: cutoffStr }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    await writeHeartbeat(sb, 'error', Date.now() - t0, null, String(err));
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
