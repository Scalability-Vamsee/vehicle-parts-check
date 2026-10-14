import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// smartflo-calls-sync — raw Smartflo calls (one row per Call ID) → public.smartflo_calls_raw
// Source: Metabase public card "Smartflo calls — raw feed" (RRR/rsa_design/queries/RSA_Smartflo_Calls_Raw.sql).
// Card id: body.card_id, else CARD_ID below. Default run = card's own window (calls in the last 2 days).
// Backfill: POST { card_id?, start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD" } (UTC clock, end exclusive;
// use ~7-10 day chunks). Upserts on call_id, prunes calls older than 35 days.
// Pairing calls to RSA tickets is NOT done here: pg_cron runs public.rsa_cc_calls_rebuild() after the sync.
// Guard: if the card does not return call_id + connected columns nothing is written (409).

const CARD_ID      = "27babdaa-3cff-4c07-9998-df87afdef037";   // "Smartflo calls — raw feed" (body.card_id overrides)
const METABASE     = "https://metabaselatest-dy7gqwqrma-el.a.run.app/api/public/card";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH        = 1000;
const FETCH_TIMEOUT_MS = 140_000;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST",
               "Access-Control-Allow-Headers": "authorization, apikey, content-type" };

// <mapper>
const txt = (v: any) => (v === null || v === undefined ? null : String(v));
const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
// call_time is the UTC clock as a naive string → mark as UTC for timestamptz
const utc = (v: any) => {
  if (!v) return null; const s = String(v);
  return /Z$|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z";
};
// Smartflo stores Call ID with literal double quotes ("34322..."): strip them so the key is the bare id
const cleanId = (v: any) => String(v).replace(/^"+|"+$/g, "");
function mapRow(r: any, syncedAt: string) {
  return {
    call_id:     cleanId(r.call_id),
    phone10:     txt(r.phone10),
    call_time:   utc(r.call_time),
    direction:   txt(r.direction),
    call_status: txt(r.call_status),
    connected:   r.connected === true || r.connected === "true",
    legs:        num(r.legs),
    did:         txt(r.did),
    recording_url: txt(r.recording_url),
    synced_at:   syncedAt,
  };
}
// </mapper>

async function heartbeat(sb: any, status: string, ms: number, rows: number | null, err: string | null) {
  try { await sb.from("sync_heartbeats").insert({ function_name: "smartflo-calls-sync", status, duration_ms: ms,
        rows_affected: rows, error_message: err, synced_at: new Date().toISOString() }); } catch (_) {}
}

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const t0 = Date.now();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const cardId = body.card_id || CARD_ID;
  if (!cardId) return json({ ok: false, error: "no card id: set CARD_ID or pass body.card_id" }, 400);

  try {
    const params: any[] = [];
    if (body.start_date) params.push({ type: "category", target: ["variable", ["template-tag", "start_date"]], value: String(body.start_date) });
    if (body.end_date)   params.push({ type: "category", target: ["variable", ["template-tag", "end_date"]],   value: String(body.end_date) });
    const url = `${METABASE}/${cardId}/query/json?parameters=${encodeURIComponent(JSON.stringify(params))}`;

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    let rows: any;
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error(`Metabase HTTP ${res.status}`);
      rows = await res.json();
    } finally { clearTimeout(timer); }

    if (!Array.isArray(rows)) throw new Error(`Metabase returned a non-array body: ${String(JSON.stringify(rows)).slice(0, 200)}`);
    if (rows.length > 0 && !("call_id" in rows[0] && "connected" in rows[0])) {
      const msg = `card ${cardId} does not return call_id + connected — paste RSA_Smartflo_Calls_Raw.sql into it`;
      await heartbeat(sb, "error", Date.now() - t0, 0, msg);
      return json({ ok: false, error: msg }, 409);
    }

    const syncedAt = new Date().toISOString();
    const byId = new Map<string, any>();
    for (const r of rows) if (r.call_id && r.call_time) { const m = mapRow(r, syncedAt); byId.set(m.call_id, m); };
    const recs = [...byId.values()];

    for (let i = 0; i < recs.length; i += BATCH) {
      const { error } = await sb.from("smartflo_calls_raw").upsert(recs.slice(i, i + BATCH), { onConflict: "call_id" });
      if (error) throw new Error(`Upsert error at batch ${i}: ${error.message}`);
    }
    const { data: pruned, error: pruneErr } = await sb.rpc("smartflo_calls_prune", { p_days: 35 });
    if (pruneErr) throw new Error(`Prune error: ${pruneErr.message}`);

    await heartbeat(sb, "success", Date.now() - t0, recs.length, null);
    return json({ ok: true, fetched: rows.length, upserted: recs.length, pruned, ms: Date.now() - t0 });
  } catch (err) {
    await heartbeat(sb, "error", Date.now() - t0, null, String(err));
    return json({ ok: false, error: String(err) }, 500);
  }
});
