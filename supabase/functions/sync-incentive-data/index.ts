import { createClient } from 'jsr:@supabase/supabase-js@2';

// v22 — techName fix: always use legacyNameMap (DMS name → incentive_technicians.name_normalized)
// so all raw-name variants of the same person resolve to the same display name.
// The rebuild's merged CTE collapses by tech_name — no need for jc_name_aliases for merge.
// v21 features retained: purge_stale_jc_log_rows, toIstTimestamptz, jcsl_id, jc_weight

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SYNC_SECRET = Deno.env.get('SYNC_SECRET');

const METABASE_BASE = 'https://metabaselatest-dy7gqwqrma-el.a.run.app';
const CARD_UUID = '9a4c0477-92b1-450d-93b2-6b4ccd1e3473';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function getWeekStart(dateStr: string): string {
  const dt = new Date(dateStr);
  const day = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() - (day === 0 ? 6 : day - 1));
  return dt.toISOString().split('T')[0];
}

/**
 * Metabase returns IST local timestamps as "YYYY-MM-DD HH:MM:SS" with no tz offset
 * (result of AT TIME ZONE 'Asia/Kolkata' → timestamp without time zone).
 * Appending +05:30 lets Postgres store them correctly in the timestamptz column.
 * Idempotent: already-offset or UTC strings pass through unchanged.
 */
function toIstTimestamptz(s: string | null): string | null {
  if (!s) return null;
  if (s.includes('+') || s.endsWith('Z')) return s;   // already has offset
  return s.replace(' ', 'T') + '+05:30';
}

/**
 * Normalize a JC name (Layer 1 → Layer 2):
 * - Trim outer whitespace
 * - Collapse multiple spaces to one
 * - Standardize hub separator: any spaces+dash+spaces → " - "
 * e.g. "PRITAM -   OKHLA" → "PRITAM - OKHLA"
 *      "AMAN SHARMA-HSR LAYOUT" → "AMAN SHARMA - HSR LAYOUT"
 */
function normalizeJcName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')                       // collapse spaces
    .replace(/\s*-\s*/g, ' - ')                 // standardize dash spacing
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (SYNC_SECRET) {
    const auth = req.headers.get('Authorization') ?? '';
    if (auth.replace('Bearer ', '') !== SYNC_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Fetch from Metabase public API — /query/json has no 2000-row API cap
    console.log(`[sync-incentive v22] Fetching from Metabase card ${CARD_UUID}`);
    const mbRes = await fetch(`${METABASE_BASE}/api/public/card/${CARD_UUID}/query/json`);
    if (!mbRes.ok) throw new Error(`Metabase fetch failed: ${mbRes.status}`);
    // /query/json returns a flat array of row objects: [{col: val, ...}, ...]
    const parsed = await mbRes.json();
    if (!Array.isArray(parsed)) {
      throw new Error(`Metabase /query/json returned non-array: ${JSON.stringify(parsed).slice(0, 300)}`);
    }
    const rawRows: Record<string, unknown>[] = parsed;
    console.log(`[sync-incentive v22] Metabase returned ${rawRows.length} rows`);

    const col = (row: Record<string, unknown>, name: string) => row[name];

    // 2. Load jc_name_aliases: normalized JC name → employee_id
    //    (kept for employee_id assignment on payroll export, NOT used as merge key)
    const { data: aliases } = await supabase
      .from('jc_name_aliases')
      .select('technician_name, employee_id');

    const aliasMap: Record<string, string> = {};
    for (const a of aliases ?? []) {
      aliasMap[a.technician_name] = a.employee_id;
    }
    console.log(`[sync-incentive v22] Loaded ${Object.keys(aliasMap).length} aliases`);

    // 3. Load DMS name → display name mappings from incentive_technicians
    //    name_in_system contains DMS raw names; name_normalized is the canonical display name.
    //    This is the PRIMARY merge key: all raw-name variants that map to the same name_normalized
    //    will produce the same technician_name → rebuild's merged CTE collapses them.
    const { data: techDir } = await supabase
      .from('incentive_technicians')
      .select('employee_id, name_normalized, name_in_system')
      .not('name_in_system', 'is', null);

    const legacyNameMap: Record<string, string> = {};   // raw DMS name → name_normalized
    const empIdByNormalized: Record<string, string> = {}; // name_normalized → employee_id
    for (const t of techDir ?? []) {
      const jcNames: string[] = Array.isArray(t.name_in_system) ? t.name_in_system : [];
      for (const raw of jcNames) {
        if (raw && t.name_normalized) legacyNameMap[raw] = t.name_normalized;
      }
      if (t.employee_id && t.name_normalized) empIdByNormalized[t.name_normalized] = t.employee_id;
    }
    console.log(`[sync-incentive v22] Loaded ${Object.keys(legacyNameMap).length} DMS→display name mappings`);

    // 4. Build jc_log rows
    const jcLogRows = rawRows.map((row) => {
      const billedDateRaw = col(row, 'jc_billed_date') as string;
      const billedDate = billedDateRaw?.slice(0, 10) ?? '';

      // jc_billed_datetime and first_comeback_datetime arrive from Metabase as IST local
      // strings ("YYYY-MM-DD HH:MM:SS", no tz offset) after the AT TIME ZONE 'Asia/Kolkata'
      // conversion. Append +05:30 so Postgres stores them correctly in timestamptz columns.
      const billedDt = toIstTimestamptz((col(row, 'jc_billed_datetime') as string | null) ?? null);
      const firstComeback = toIstTimestamptz((col(row, 'first_comeback_datetime') as string | null) ?? null);

      // jcsl_id: stable source ID from job_card_status_log — used as conflict key (timezone-independent)
      const jcslId = col(row, 'jcsl_id') as number | null;

      const rawName = (col(row, 'technician_name') as string) ?? '';
      const normalizedName = normalizeJcName(rawName);  // Layer 2: whitespace/dash normalisation
      const isVoid = Number(col(row, 'rr_count_3d_comeback') ?? 0) > 0;

      // technician_name display: always prefer legacyNameMap (DMS raw name → incentive_technicians.name_normalized)
      // so that all raw-name variants of the same person resolve to the same display name.
      // employee_id is kept for payroll export but is NOT the merge key — the rebuild's secondary
      // GROUP BY tech_name (merged CTE) collapses name variants that share the same display name.
      const techName = legacyNameMap[rawName] ?? normalizedName;

      // Resolve employee_id: alias map keyed by normalized name, OR look up by display name
      const employeeId = aliasMap[normalizedName] ?? empIdByNormalized[techName] ?? null;

      return {
        jcsl_id: jcslId,
        jc_billed_date: billedDate,
        jc_billed_datetime: billedDt,
        intrip: Number(col(row, 'intrip') ?? 0),
        reg_number: (col(row, 'reg_number') as string) ?? '',
        bike_model: (col(row, 'bike_model') as string) ?? '',
        technician_name_raw: rawName,                  // Layer 1: as-is from Metabase
        technician_name_normalized: normalizedName,    // Layer 2: trimmed, spaces collapsed, dash standardized
        technician_name: techName,                     // display name from incentive_technicians.name_normalized
        employee_id: employeeId,                       // from jc_name_aliases or incentive_technicians lookup
        hub_name: (col(row, 'hub_name') as string) ?? '',
        city: (col(row, 'city') as string) ?? '',
        is_void: isVoid,
        first_comeback_datetime: firstComeback,
        week_start: getWeekStart(billedDate),
        jc_weight: Number(col(row, 'jc_weight') ?? 1),
        effective_labour_minutes: Number(col(row, 'effective_labour_minutes') ?? 0),
      };
    }).filter(r => r.jc_billed_date && r.reg_number);

    // 5. Upsert jc_log
    const BATCH = 500;
    let upserted = 0;
    for (let i = 0; i < jcLogRows.length; i += BATCH) {
      const { error } = await supabase.from('incentive_jc_log').upsert(
        jcLogRows.slice(i, i + BATCH),
        { onConflict: 'jc_billed_datetime,technician_name_raw,reg_number', ignoreDuplicates: false }
      );
      if (error) throw new Error(`jc_log upsert: ${error.message}`);
      upserted += Math.min(BATCH, jcLogRows.length - i);
    }

    // 6a. Purge stale phantom rows in open weeks.
    const { error: purgeErr } = await supabase.rpc('purge_stale_jc_log_rows');
    if (purgeErr) {
      console.warn(`[sync-incentive v22] purge_stale_jc_log_rows warning: ${purgeErr.message}`);
    }

    // 6b. Freeze completed weeks, then rebuild open weeks only
    const { error: freezeErr } = await supabase.rpc('freeze_completed_weeks');
    if (freezeErr) throw new Error(`freeze_completed_weeks: ${freezeErr.message}`);
    const { error: rebuildErr } = await supabase.rpc('rebuild_incentive_weekly_stats');
    if (rebuildErr) throw new Error(`weekly_stats rebuild: ${rebuildErr.message}`);

    // 7. Backfill employee_id on all historical rows that now have an alias but no employee_id yet
    const { error: backfillErr } = await supabase.rpc('backfill_employee_ids');
    if (backfillErr) {
      console.warn(`[sync-incentive v22] backfill_employee_ids warning: ${backfillErr.message}`);
    }

    const resolvedCount = jcLogRows.filter(r => r.employee_id).length;

    return new Response(JSON.stringify({
      ok: true,
      rows_fetched: rawRows.length,
      rows_upserted: upserted,
      alias_mappings_loaded: Object.keys(aliasMap).length,
      dms_display_mappings_loaded: Object.keys(legacyNameMap).length,
      employee_id_resolved: resolvedCount,
      employee_id_unresolved: jcLogRows.length - resolvedCount,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[sync-incentive v22] ERROR:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
