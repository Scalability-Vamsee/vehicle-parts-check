// jc-ops-sync v7 (24 Nov 2026, Claude Code in Vamsee's window): Metabase card B (98f2dc7c, bike_operations_log status / hub
// changes, about the last 30 days) -> public.jc_ops_log. Read by RFD Check (RFD = oos -> active) and the job card context.
//
// Why v7: v6 (deployed 23 Jun) deleted all ~99,000 rows and reinserted them on every run (9.5 million rows a day at 15 min; the
// page saw a half-empty table for ~14 s each run). Vamsee asked for a 5-min refresh (24 Nov), which would have meant 28.5 million.
// v7 writes only what changed:
//   1. reads the card (same CSV, same parsing and columns as v6);
//   2. inserts the rows of the last RECENT_DAYS IST days that are not in the table yet (on conflict (id) do nothing: existing rows
//      are not rewritten; the ops log is append-only). If the table's newest row is older than that (a long stop), it inserts
//      every card row instead (catch-up), still without rewriting existing ones;
//   3. deletes the rows older than the card's oldest row (the card's own window), only if the card looks complete
//      (at least half as many rows as the table), so a broken download never empties the table.
// Rows whose created_at_ist is not a date are skipped (Metabase error text has landed in such columns before).
// verify_jwt stays false as in v6 (cron 31 calls it unchanged). Heartbeat: sync_heartbeats, function_name 'jc-ops-sync'.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const METABASE_URL = "https://metabaselatest-dy7gqwqrma-el.a.run.app/api/public/card/98f2dc7c-a97f-47e8-9995-96e8aa19c56a/query/csv?parameters=%5B%5D";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RECENT_DAYS = 2;
const BATCH = 1000;
const IST_TS = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;

async function writeHeartbeat(sb: any, status: string, durationMs: number, rowsAffected: number | null = null, errorMessage: string | null = null) {
  try {
    await sb.from("sync_heartbeats").insert({
      function_name: "jc-ops-sync", status, duration_ms: durationMs, rows_affected: rowsAffected,
      error_message: errorMessage, synced_at: new Date().toISOString(),
    });
  } catch (_) {}
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim()); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function coerce(val: string | undefined) {
  if (val === undefined || val === "" || val === "null" || val === "NULL") return null;
  const num = Number(val);
  if (!isNaN(num) && val !== "") return num;
  return val;
}

// IST calendar day N days ago, as 'YYYY-MM-DD' (compares correctly with created_at_ist text)
function istDay(daysAgo: number): string {
  const d = new Date(Date.now() + 5.5 * 3600_000 - daysAgo * 86400_000);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (_req) => {
  const t0 = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  try {
    // 1. the card
    const mbRes = await fetch(METABASE_URL);
    if (!mbRes.ok) throw new Error(`Metabase fetch failed: ${mbRes.status}`);
    const csvText = await mbRes.text();
    const lines = csvText.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new Error("No data rows");
    const headers = parseCSVLine(lines[0]);
    const ci: Record<string, number> = {};
    headers.forEach((h, i) => { ci[h] = i; });
    const v = (row: string[], col: string) => ci[col] !== undefined ? coerce(row[ci[col]]) : null;
    const records = lines.slice(1).map(parseCSVLine).map((row) => ({
      id: v(row, "id"),
      reg_number: v(row, "reg_number"),
      bike_id: v(row, "bike_id"),
      previous_vehicle_status: v(row, "previous_vehicle_status"),
      new_vehicle_status: v(row, "new_vehicle_status"),
      hub_name: v(row, "hub_name"),
      performed_by_name: v(row, "performed_by_name"),
      created_at_ist: v(row, "created_at_ist"),
    })).filter((r) => typeof r.id === "number" && r.id > 0 && typeof r.created_at_ist === "string" && IST_TS.test(r.created_at_ist as string));
    if (!records.length) throw new Error("No valid rows in the card");
    const cardMin = records.reduce((m, r) => (r.created_at_ist as string) < m ? (r.created_at_ist as string) : m, records[0].created_at_ist as string);

    // 2. insert new rows (recent window, or everything when the table is behind)
    const recentSince = istDay(RECENT_DAYS);
    // '<= 2999' keeps any non-date text (it sorts after digits) out of the newest-row lookup
    const { data: top, error: topErr } = await supabase.from("jc_ops_log").select("created_at_ist").lte("created_at_ist", "2999").order("created_at_ist", { ascending: false }).limit(1);
    if (topErr) throw new Error(`Read newest row failed: ${topErr.message}`);
    const tableMax = (top?.[0]?.created_at_ist as string) ?? "";
    const catchUp = !(tableMax && IST_TS.test(tableMax) && tableMax >= recentSince);
    const pick = catchUp ? records : records.filter((r) => (r.created_at_ist as string) >= recentSince);
    let inserted = 0;
    for (let i = 0; i < pick.length; i += BATCH) {
      const part = pick.slice(i, i + BATCH);
      const { error, count } = await supabase.from("jc_ops_log").upsert(part, { onConflict: "id", ignoreDuplicates: true, count: "exact" });
      if (error) throw new Error(`Insert failed at batch ${i}: ${error.message}`);
      inserted += count ?? 0;
    }

    // 3. keep the card's window: delete older rows, only when the card looks complete
    const { count: tableRows, error: cntErr } = await supabase.from("jc_ops_log").select("id", { count: "exact", head: true });
    if (cntErr) throw new Error(`Count failed: ${cntErr.message}`);
    let deleted = 0;
    let trimNote: string | null = null;
    if ((tableRows ?? 0) > 0 && records.length >= 0.5 * (tableRows ?? 0)) {
      const { error: delErr, count } = await supabase.from("jc_ops_log").delete({ count: "exact" }).lt("created_at_ist", cardMin);
      if (delErr) throw new Error(`Delete old rows failed: ${delErr.message}`);
      deleted = count ?? 0;
    } else {
      trimNote = `trim skipped: card ${records.length} rows vs table ${tableRows}`;
    }

    await writeHeartbeat(supabase, "success", Date.now() - t0, inserted + deleted, trimNote);
    return new Response(JSON.stringify({ success: true, card_rows: records.length, mode: catchUp ? "catch-up" : "recent",
      picked: pick.length, inserted, deleted, table_rows_before_trim: tableRows, trim_note: trimNote }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    await writeHeartbeat(supabase, "error", Date.now() - t0, null, String(err));
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
