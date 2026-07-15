import { createClient } from 'jsr:@supabase/supabase-js@2';

// Master: Technician Nomenclature Map (gid=572681529)
// Spreadsheet: 17-Ix-tVo2ekew5dogOFm9K8XsuMsdCb0MjQcnQGdxFs
// Columns: Employee ID, JC Name (Raw), Normalized Name, Hub, City, Status, Email id, Contact Number, Remarks
//
// Syncs two tables from this single sheet:
//   1. incentive_technicians — full tech profile (one row per employee_id)
//   2. jc_name_aliases       — JC name → employee_id lookup (one row per normalized JC name)
//
// Cron: job 36 — 30 18 * * * (18:30 UTC = 00:00 IST daily)
const NOMEN_SHEET_URL = `https://docs.google.com/spreadsheets/d/17-Ix-tVo2ekew5dogOFm9K8XsuMsdCb0MjQcnQGdxFs/export?format=csv&gid=572681529`;

const NOT_A_PERSON = new Set(['FREELANCER', 'VECNOCOM', 'VECMOCON', 'READY ASSET', 'VAMSEE - HEBBALA']);

/**
 * Normalize a JC name (Layer 1 → Layer 2) — mirrors sync-incentive-data logic.
 * Trim, collapse spaces, standardize "PRITAM -   OKHLA" → "PRITAM - OKHLA"
 */
function normalizeJcName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').replace(/\s*-\s*/g, ' - ').trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const results: Record<string, unknown> = {};

  // ── Fetch Nomenclature Map ───────────────────────────────────────────────────
  let rows: string[][];
  try {
    const res = await fetch(NOMEN_SHEET_URL);
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    rows = parseCSV(await res.text());
    if (rows.length < 2) throw new Error('Sheet: no data rows');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg, synced_at: new Date().toISOString() }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
    );
  }

  const header = rows[0].map((h: string) => h.trim().toLowerCase());
  const col = (name: string) => header.findIndex((h: string) => h.includes(name));
  const iEmpId   = col('employee id');
  const iJcName  = col('jc name');
  const iNorm    = col('normalized');
  const iHub     = col('hub');
  const iCity    = col('city');
  const iStatus  = col('status');
  const iEmail   = col('email');
  const iContact = col('contact');

  if (iJcName === -1) {
    return new Response(
      JSON.stringify({ error: `Missing columns. Header: ${JSON.stringify(header)}`, synced_at: new Date().toISOString() }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
    );
  }

  // Filter junk rows: empty JC name, "Not a person" status, known placeholders
  const validRows = rows.slice(1).filter((r: string[]) => {
    const jcName = r[iJcName]?.trim();
    const status = r[iStatus]?.trim();
    if (!jcName) return false;
    if (status === 'Not a person') return false;
    if (NOT_A_PERSON.has(jcName.toUpperCase())) return false;
    return true;
  });

  // Group by employee_id — collect all JC raw names and metadata per employee
  // empId must match real ID format (e.g. WRCT0099, WRC2011) — rejects emoji/label summary rows
  const byEmpId: Record<string, { jcNames: string[]; norm: string; hub: string; city: string; email: string; contact: string }> = {};
  const noEmpId: Array<{ jcName: string; norm: string; hub: string; city: string; email: string; contact: string }> = [];
  let skippedSummaryRows = 0;

  for (const r of validRows) {
    const empId    = iEmpId !== -1 ? r[iEmpId]?.trim() : '';
    const jcName   = r[iJcName]?.trim() || '';
    const norm     = iNorm    !== -1 ? r[iNorm]?.trim()     || '' : '';
    const hub      = iHub     !== -1 ? r[iHub]?.trim()      || '' : '';
    const city     = iCity    !== -1 ? r[iCity]?.trim()     || '' : '';
    const rawEmail = iEmail   !== -1 ? r[iEmail]?.trim()    || '' : '';
    const contact  = iContact !== -1 ? r[iContact]?.trim()  || '' : '';

    // Validate email — reject placeholders and malformed addresses
    const emailOk = rawEmail.length > 0 && rawEmail !== '-' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
    const email = emailOk ? rawEmail.toLowerCase() : '';

    // Validate empId — must be letters + digits only (e.g. WRCT0099)
    const empIdOk = empId && /^[A-Z]+[0-9]+$/.test(empId);

    if (empIdOk) {
      if (!byEmpId[empId]) byEmpId[empId] = { jcNames: [], norm, hub, city, email, contact };
      byEmpId[empId].jcNames.push(jcName);
      // First non-empty value wins for metadata fields
      if (norm    && !byEmpId[empId].norm)    byEmpId[empId].norm    = norm;
      if (hub     && !byEmpId[empId].hub)     byEmpId[empId].hub     = hub;
      if (city    && !byEmpId[empId].city)    byEmpId[empId].city    = city;
      if (email   && !byEmpId[empId].email)   byEmpId[empId].email   = email;
      if (contact && !byEmpId[empId].contact) byEmpId[empId].contact = contact;
    } else if (!empId) {
      noEmpId.push({ jcName, norm, hub, city, email, contact });
    } else {
      skippedSummaryRows++; // empId present but not a real ID format
    }
  }

  // ── 1. incentive_technicians ─────────────────────────────────────────────────
  try {
    let upsertedMapped = 0, upsertedUnmatched = 0;

    // Mapped rows (have employee_id) — conflict on employee_id
    const mappedRows = Object.entries(byEmpId).map(([empId, d]) => ({
      employee_id:     empId,
      name_in_system:  d.jcNames,
      name_normalized: d.norm    || null,
      hub_name:        d.hub     || null,
      city:            d.city    || null,
      email:           d.email   || null,
      contact_number:  d.contact || null,
      active:          true,
      updated_at:      new Date().toISOString(),
    }));

    if (mappedRows.length > 0) {
      const { error } = await supabase
        .from('incentive_technicians')
        .upsert(mappedRows, { onConflict: 'employee_id' });
      if (error) throw new Error(`Mapped upsert: ${error.message}`);
      upsertedMapped = mappedRows.length;
    }

    // Unmatched rows (no employee_id) — match by jc_name in name_in_system array
    for (const row of noEmpId) {
      const { data: existing } = await supabase
        .from('incentive_technicians')
        .select('id')
        .contains('name_in_system', [row.jcName])
        .maybeSingle();

      if (existing) {
        await supabase.from('incentive_technicians').update({
          name_normalized: row.norm    || null,
          hub_name:        row.hub     || null,
          city:            row.city    || null,
          email:           row.email   || null,
          contact_number:  row.contact || null,
          updated_at:      new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await supabase.from('incentive_technicians').insert({
          employee_id:     null,
          name_in_system:  [row.jcName],
          name_normalized: row.norm    || null,
          hub_name:        row.hub     || null,
          city:            row.city    || null,
          email:           row.email   || null,
          contact_number:  row.contact || null,
          active:          true,
          updated_at:      new Date().toISOString(),
        });
      }
      upsertedUnmatched++;
    }

    results.incentive_technicians = {
      success: true,
      upserted_mapped: upsertedMapped,
      upserted_unmatched: upsertedUnmatched,
      skipped_not_a_person: rows.length - 1 - validRows.length,
      skipped_summary_rows: skippedSummaryRows,
    };
  } catch (err: unknown) {
    results.incentive_technicians = { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  // ── 2. jc_name_aliases ───────────────────────────────────────────────────────
  // normalizeJcName(jc_name_raw) → employee_id
  // Dedup by normalized name (Map) to avoid Postgres "ON CONFLICT affects row twice" error.
  // No FK on employee_id — Nomenclature Map is the authority.
  try {
    const validEmpIds = new Set(Object.keys(byEmpId));
    const aliasMap = new Map<string, string>(); // technician_name → employee_id
    let skippedNoEmpId = 0;

    for (const [empId, d] of Object.entries(byEmpId)) {
      if (!validEmpIds.has(empId)) { skippedNoEmpId++; continue; }
      for (const jcName of d.jcNames) {
        const normalized = normalizeJcName(jcName);
        if (!normalized) continue;
        aliasMap.set(normalized, empId);
      }
    }

    const aliasRows = Array.from(aliasMap.entries()).map(([technician_name, employee_id]) => ({
      technician_name, employee_id, created_by: 'sync',
    }));

    let upsertedAliases = 0;
    const BATCH = 200;
    for (let i = 0; i < aliasRows.length; i += BATCH) {
      const { error } = await supabase
        .from('jc_name_aliases')
        .upsert(aliasRows.slice(i, i + BATCH), { onConflict: 'technician_name' });
      if (error) throw new Error(`jc_name_aliases upsert: ${error.message}`);
      upsertedAliases += Math.min(BATCH, aliasRows.length - i);
    }

    results.jc_name_aliases = { success: true, upserted: upsertedAliases, skipped_no_emp_id: skippedNoEmpId };
  } catch (err: unknown) {
    results.jc_name_aliases = { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  // ── 3. hr_employees (from Nomenclature Map — keeps auth + frontend working) ───
  // Populates employee_id, employee_name (= normalized name), hub, city, email, contact.
  // designation is not in the Nomenclature Map — will be NULL.
  // This keeps email→employee_id auth lookups working across all pages.
  try {
    const hrRows = Object.entries(byEmpId).map(([empId, d]) => ({
      employee_id:   empId,
      employee_name: d.norm    || null,
      designation:   null,
      city:          d.city    || null,
      hub:           d.hub     || null,
      contact:       d.contact || null,
      email:         d.email   || null,
      synced_at:     new Date().toISOString(),
    }));
    if (hrRows.length > 0) {
      const { error } = await supabase
        .from('hr_employees')
        .upsert(hrRows, { onConflict: 'employee_id' });
      if (error) throw new Error(`hr_employees upsert: ${error.message}`);
    }
    results.hr_employees = { success: true, upserted: hrRows.length };
  } catch (err: unknown) {
    results.hr_employees = { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  return new Response(
    JSON.stringify({ ...results, synced_at: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
  );
});

// Minimal CSV parser — handles quoted fields with commas/newlines
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        cells.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}
