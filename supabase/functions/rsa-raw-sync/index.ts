import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// rsa-raw-sync — full-column RSA ticket feed → public.rsa_tickets_raw
// Source: Metabase public card 24810530 ("RSA Raw Data", revised 2026-10-14 query).
// Default run = trailing WINDOW_DAYS (IST) via card start_date/end_date params.
// Body overrides: { start_date, end_date } (YYYY-MM-DD, IST) or { full: true }.
// If the windowed call errors (card params broken), falls back to a full pull
// (~40 s, ~12k rows) and filters client-side, so the sync never silently stops.
// The warroom pipeline (rsa-ticket-sync → rsa_tickets_cache) is untouched.

const CARD_ID      = "24810530-de51-4840-8574-f71ac131adc9";
const METABASE     = `https://metabaselatest-dy7gqwqrma-el.a.run.app/api/public/card/${CARD_ID}/query/json`;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WINDOW_DAYS  = 7;
const BATCH        = 500;
const OFF_HOURS_START = 0, OFF_HOURS_END = 6;   // IST — no RSA ops, skip scheduled runs

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST",
               "Access-Control-Allow-Headers": "authorization, apikey, content-type" };

function istNow(): Date { return new Date(Date.now() + 330 * 60 * 1000); }
function istDate(d: Date): string { return d.toISOString().slice(0, 10); }

// Card emits IST wall-clock strings, some with a trailing Z (timestamptz sources).
// Store IST columns as naive timestamps: strip the Z.
function ist(v: any): string | null {
  if (!v) return null; const s = String(v); return s.endsWith("Z") ? s.slice(0, -1) : s;
}
// Raw createdAt/resolvedAt are naive UTC strings → mark as UTC for timestamptz.
function utc(v: any): string | null {
  if (!v) return null; const s = String(v);
  return /Z$|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z";
}
const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
const txt = (v: any) => (v === null || v === undefined ? null : String(v));

async function heartbeat(sb: any, status: string, ms: number, rows: number | null, err: string | null) {
  try { await sb.from("sync_heartbeats").insert({ function_name: "rsa-raw-sync", status, duration_ms: ms,
        rows_affected: rows, error_message: err, synced_at: new Date().toISOString() }); } catch (_) {}
}

async function fetchCard(params: any[]): Promise<any[] | null> {
  const url = `${METABASE}?parameters=${encodeURIComponent(JSON.stringify(params))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Metabase HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body) ? body : null;   // Metabase returns a string/object on query error
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const t0 = Date.now();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const scheduled = !body.start_date && !body.end_date && !body.full;

  if (scheduled) {
    const h = istNow().getUTCHours();
    if (h >= OFF_HOURS_START && h < OFF_HOURS_END)
      return new Response(JSON.stringify({ skipped: true, reason: "off-hours", ist_hour: h }),
                          { headers: { "Content-Type": "application/json", ...CORS } });
  }

  const end   = body.end_date   || istDate(istNow());
  const start = body.start_date || istDate(new Date(istNow().getTime() - (WINDOW_DAYS - 1) * 86400000));
  const full  = body.full === true;

  try {
    let rows: any[] | null = null;
    let mode = "window";
    if (!full) {
      rows = await fetchCard([
        { type: "category", target: ["variable", ["template-tag", "start_date"]], value: start },
        { type: "category", target: ["variable", ["template-tag", "end_date"]],   value: end   },
      ]);
    }
    if (!rows) {                         // full mode, or windowed call failed → full pull + local filter
      mode = full ? "full" : "window-fallback-full";
      const all = await fetchCard([]);
      if (!all) throw new Error("Metabase returned a non-array body for the full pull");
      rows = full ? all : all.filter((r: any) => { const d = (r.Created_at_IST || "").slice(0, 10); return d >= start && d <= end; });
    }

    const now = new Date().toISOString();
    const recs = rows.filter((r: any) => r.id).map((r: any) => ({
      id:                      String(r.id),
      ticket_number:           txt(r.ticketNumber),
      customer_name:           txt(r.customerName),
      customer_phone:          txt(r.customerPhone),
      alternate_phone:         txt(r.alternatePhone),
      category:                txt(r.category),
      status:                  txt(r.status),
      booking_id:              txt(r.bookingId),
      issue_category:          txt(r.issueCategory),
      chassis_number:          txt(r.chassisNumber),
      smpl_ticket_number:      txt(r["SMPL Ticket Number"]),
      technician_name:         txt(r["Technician Name"]),
      action_type:             txt(r.actionType),
      resolution_type:         txt(r.resolutionType),
      created_at:              utc(r.createdAt),
      resolved_at:             utc(r.resolvedAt),
      fault_details:           txt(r.faultDetails),
      city:                    txt(r.city),
      cs_agent_name:           txt(r["CS Agent Name"]),
      inprogress_by:           txt(r["InProgress By"]),
      closed_by:               txt(r["Closed By"]),
      shift:                   txt(r.Shift),
      tat_minutes:                        num(r.TAT_Minutes),
      tat_create_to_inprogress_minutes:   num(r.TAT_Create_to_InProgress_Minutes),
      tat_inprogress_to_resolved_minutes: num(r.TAT_InProgress_to_Resolved_Minutes),
      tat_wh_minutes:                        num(r.TAT_WH_Minutes),
      tat_wh_create_to_inprogress_minutes:   num(r.TAT_WH_Create_to_InProgress_Minutes),
      tat_wh_inprogress_to_resolved_minutes: num(r.TAT_WH_InProgress_to_Resolved_Minutes),
      created_at_ist:          ist(r.Created_at_IST),
      resolved_at_ist:         ist(r.Resolved_at_IST),
      inprogress_at_ist:       ist(r.InProgress_at_IST),
      reg_number:              txt(r["Reg Number"]),
      reopen_count:            num(r.Reopen_Count),
      status_changes:          num(r.Status_Changes),
      porter_booked_hub:       txt(r.Porter_Booked_Hub),
      porter_crm:              txt(r.Porter_CRM),
      porter_cost:             num(r.Porter_Cost),
      bass_lat:                num(r.Bass_Lat),
      bass_lng:                num(r.Bass_Lng),
      bass_location_time_ist:  ist(r.Bass_Location_Time_IST),
      internal_note_content:   txt(r.Internal_Note_Content),
      feedback_rating:         txt(r.Feedback_Rating),
      feedback_result:         txt(r.Feedback_Result),
      feedback_step:           txt(r.Feedback_Step),
      feedback_responded_at:   utc(r.Feedback_Responded_At),
      action_type_log:         txt(r.Action_Type_Log),
      action_type_changes:     num(r.Action_Type_Changes),
      first_action_type:       txt(r.First_Action_Type),
      last_action_type:        txt(r.Last_Action_Type),
      synced_at:               now,
    }));

    for (let i = 0; i < recs.length; i += BATCH) {
      const { error } = await sb.from("rsa_tickets_raw").upsert(recs.slice(i, i + BATCH), { onConflict: "id" });
      if (error) throw new Error(`Upsert error at batch ${i}: ${error.message}`);
    }

    await heartbeat(sb, "success", Date.now() - t0, recs.length, mode === "window" ? null : `mode=${mode}`);
    return new Response(JSON.stringify({ ok: true, mode, start, end, fetched: rows.length, upserted: recs.length, ms: Date.now() - t0 }),
                        { headers: { "Content-Type": "application/json", ...CORS } });
  } catch (err) {
    await heartbeat(sb, "error", Date.now() - t0, null, String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }),
                        { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
  }
});
