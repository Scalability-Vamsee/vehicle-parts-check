// validation-check-sync: copies DMS vehicle validation results (RFD validation) from Metabase card "Validation check"
// (card 5799, public 79990b1c-2c4f-41a8-a52c-bee10621ab69) into public.validation_check (migration 20261124000002).
// Written 24 Nov 2026 by Claude Code (Vamsee's window). Old data was imported once by Vamsee on 24 Nov (ids 1 to 329,944).
//
// The card returns a rolling last-48-hours window (about 5,800 rows, ~950 KB). Each run:
//   1. reads the card,
//   2. inserts the ids that are not in the table yet (on conflict do nothing),
//   3. fixes created_at where the table's time differs from the card's (the 24 Nov import kept whole minutes only; after the
//      first run inside the window this is 0 rows). No other updates and no deletes.
// If the table's newest id is older than the card's oldest id, rows were missed (a stop of more than 48 hours): the run still
// inserts and writes a warning into the heartbeat.
//
// Schedule: pg_cron every 5 min (migration 20261124000003), Authorization = the service-role key read from Vault ('service_role_key').
// Caller check: service role only. Deploy with verify_jwt = true: the role claim is trusted because the gateway checks the signature.
// Heartbeat: one sync_heartbeats row per run (function_name 'validation-check-sync', status success / failure).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CARD = "https://metabaselatest-dy7gqwqrma-el.a.run.app/api/public/card/79990b1c-2c4f-41a8-a52c-bee10621ab69/query/json";
const FN = "validation-check-sync";

function isServiceRole(req: Request): boolean {
  const tok = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return false;
  if (SB_KEY && tok === SB_KEY) return true;
  try {
    const b = tok.split(".")[1];
    const p = JSON.parse(atob(b.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b.length + 3) % 4)));
    return p.role === "service_role";
  } catch { return false; }
}

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
// the card's time is UTC without a zone ("2026-11-24T13:38:58.266899"): mark it as UTC
const utc = (s: unknown) => (typeof s === "string" && s) ? (/[zZ]$|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z") : null;
const int = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) ? null : Math.trunc(Number(v));

type Row = { id: number; ops_user_id: number | null; bike_id: number | null; odometer: number | null; result: string | null; created_at: string | null };

Deno.serve(async (req) => {
  if (!isServiceRole(req)) return json({ error: "service role only" }, 401);
  const t0 = Date.now();
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  try {
    // 1. the card
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 60_000);
    const res = await fetch(CARD, { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`card HTTP ${res.status}`);
    const raw = await res.json();
    if (!Array.isArray(raw)) throw new Error("card did not return rows: " + JSON.stringify(raw).slice(0, 200));
    const rows: Row[] = [];
    for (const r of raw) {
      const id = int(r.id);
      if (id === null) continue;
      rows.push({ id, ops_user_id: int(r.ops_user_id), bike_id: int(r.bike_id), odometer: int(r.odometer),
                  result: r.result ?? null, created_at: utc(r.created_at) });
    }
    if (!rows.length) throw new Error("card returned 0 rows");
    const minId = rows.reduce((m, r) => Math.min(m, r.id), Infinity);

    // gap check: newest id already stored below the card window
    const { data: below, error: e0 } = await sb.from("validation_check").select("id").lt("id", minId).order("id", { ascending: false }).limit(1);
    if (e0) throw new Error("read newest id: " + e0.message);
    const prevMax = below?.[0]?.id ?? null;
    const warn = prevMax !== null && prevMax < minId - 1
      ? `possible gap: table had ids up to ${prevMax}, card starts at ${minId}` : null;

    // 2. and 3. compare with the rows already stored in the card's id range
    const have = new Map<number, string | null>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("validation_check").select("id,created_at").gte("id", minId).order("id").range(from, from + 999);
      if (error) throw new Error("read window: " + error.message);
      for (const d of data!) have.set(d.id, d.created_at);
      if (data!.length < 1000) break;
    }
    const fresh = rows.filter((r) => !have.has(r.id));
    const fix = rows.filter((r) => have.has(r.id) && r.created_at && Date.parse(have.get(r.id) ?? "") !== Date.parse(r.created_at));

    let inserted = 0, fixed = 0;
    for (let i = 0; i < fresh.length; i += 1000) {
      const part = fresh.slice(i, i + 1000);
      const { error, count } = await sb.from("validation_check").upsert(part, { onConflict: "id", ignoreDuplicates: true, count: "exact" });
      if (error) throw new Error("insert: " + error.message);
      inserted += count ?? part.length;
    }
    for (let i = 0; i < fix.length; i += 1000) {
      const part = fix.slice(i, i + 1000);
      const { error, count } = await sb.from("validation_check").upsert(part, { onConflict: "id", count: "exact" });
      if (error) throw new Error("fix times: " + error.message);
      fixed += count ?? part.length;
    }

    const ms = Date.now() - t0;
    await sb.from("sync_heartbeats").insert({ function_name: FN, status: "success", duration_ms: ms, rows_affected: inserted + fixed, error_message: warn });
    return json({ card_rows: rows.length, card_first_id: minId, inserted, fixed_times: fixed, warning: warn, ms });
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).slice(0, 500);
    await sb.from("sync_heartbeats").insert({ function_name: FN, status: "failure", duration_ms: Date.now() - t0, rows_affected: 0, error_message: msg });
    return json({ error: msg }, 500);
  }
});
