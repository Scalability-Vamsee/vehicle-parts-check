// sync-incentive-technicians (rewritten 26 Nov 2026)
// Reads the Technician Nomenclature Map sheet (gid=572681529) and keeps public.incentive_technicians in step with it.
// Called daily by cron 95 (00:30 UTC = 06:00 IST).
//
// Why: the earlier version deleted every row and then inserted the sheet in one statement. The sheet has the same Employee ID on
// 2 to 3 normalized names (name variants for job-card matching) and "-" as Employee ID on some names, so the insert hit
// the unique constraint on employee_id and left the table empty (25 and 26 Nov). Now it:
//   - never deletes rows;
//   - keeps one row per normalized name (every name variant stays, so job-card, hub and Watchlist lookups by name work);
//   - an Employee ID ("-", "" and "NA" mean none) sits on one row only: per ID, the first sheet row that has an email,
//     else the first row; the ID's other names are kept as rows without the ID;
//   - an email sits on one row only (the first in sheet order), because the My Incentive login refuses an email that
//     matches more than one technician;
//   - updates only fields that change, and never overwrites a non-empty value with an empty one;
//   - one bad row is logged and skipped; the run goes on;
//   - logs rows read, inserted, updated, unchanged and skipped (with the reason).
// Dry run: ?dry=1 reads the sheet and the table and returns the plan without writing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/17-Ix-tVo2ekew5dogOFm9K8XsuMsdCb0MjQcnQGdxFs/export?format=csv&gid=572681529";

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  while (i < text.length) {
    const row: string[] = [];
    while (i < text.length && text[i] !== "\n") {
      if (text[i] === '"') {
        i++;
        let cell = "";
        while (i < text.length) {
          if (text[i] === '"' && text[i + 1] === '"') { cell += '"'; i += 2; }
          else if (text[i] === '"') { i++; break; }
          else { cell += text[i++]; }
        }
        row.push(cell);
        if (text[i] === ",") i++;
      } else {
        let cell = "";
        while (i < text.length && text[i] !== "," && text[i] !== "\n") cell += text[i++];
        row.push(cell.replace(/\r$/, "").trim());
        if (text[i] === ",") i++;
      }
    }
    if (text[i] === "\n") i++;
    if (row.length > 1 || row[0]) rows.push(row);
  }
  return rows;
}

const clean = (s: string | undefined) => (s ?? "").replace(/\r/g, "").trim();
const nullId = (s: string) => {
  const v = clean(s);
  return ["", "-", "na"].includes(v.toLowerCase()) ? null : v;
};
const empty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

type Target = {
  name_normalized: string; name_in_system: string[]; hub_name: string | null; city: string | null;
  employee_id: string | null; contact_number: string | null; email: string | null; active: boolean; first: number;
};

// the caller's role from the JWT that verify_jwt already checked
function callerRole(req: Request): string | null {
  try {
    const tok = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const p = tok.split(".")[1]; if (!p) return null;
    return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(p.length / 4) * 4, "="))).role ?? null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const detail = callerRole(req) === "service_role";      // names in the response only for the service key; counts for everyone else
  if (dry && !detail) return new Response(JSON.stringify({ ok: false, error: "dry run needs the service key" }), { status: 403, headers: { "Content-Type": "application/json" } });
  const log = { rows_read: 0, names: 0, inserted: 0, updated: 0, unchanged: 0, skipped: [] as { row?: number; name?: string; reason: string }[],
                notes: [] as string[] };
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error("Sheet fetch failed: " + res.status);
    const rows = parseCSV(await res.text());
    if (rows.length < 2) throw new Error("Sheet appears empty");
    const data = rows.slice(1);
    log.rows_read = data.length;

    // 1. one target per normalized name (sheet order), as v2 did
    const byName = new Map<string, Target>();
    const rowsOf = new Map<string, { row: number; empId: string | null; email: string | null }[]>();
    data.forEach((row, k) => {
      const sheetRow = k + 2;      // 1-based, after the header
      try {
        const empId = nullId(row[0]);
        const rawName = clean(row[1]), normName = clean(row[2]);
        const hub = clean(row[3]), city = clean(row[4]), status = clean(row[5]).toLowerCase();
        const phone = clean(row[6]), email = clean(row[7]).toLowerCase();
        if (!normName) { if (row.some((c) => clean(c))) log.skipped.push({ row: sheetRow, reason: "no normalized name" }); return; }
        if (!byName.has(normName)) {
          byName.set(normName, { name_normalized: normName, name_in_system: [], hub_name: null, city: null, employee_id: null,
                                 contact_number: null, email: null, active: true, first: sheetRow });
          rowsOf.set(normName, []);
        }
        const t = byName.get(normName)!;
        if (rawName && !t.name_in_system.includes(rawName)) t.name_in_system.push(rawName);
        if (!t.hub_name && hub) t.hub_name = hub;
        if (!t.city && city) t.city = city;
        if (!t.contact_number && phone) t.contact_number = phone;
        if (status === "inactive") t.active = false;
        rowsOf.get(normName)!.push({ row: sheetRow, empId, email: email || null });
      } catch (e) {
        log.skipped.push({ row: sheetRow, reason: "could not read the row: " + String(e) });
      }
    });
    log.names = byName.size;

    // 2. Employee ID on one name per ID: the first sheet row with an email, else the first row
    const idRows = new Map<string, { row: number; name: string; email: string | null }[]>();
    for (const [name, rs] of rowsOf) for (const r of rs) if (r.empId) {
      if (!idRows.has(r.empId)) idRows.set(r.empId, []);
      idRows.get(r.empId)!.push({ row: r.row, name, email: r.email });
    }
    const emailOwner = new Map<string, string>();
    for (const [id, rs] of [...idRows].sort((a, b) => a[1][0].row - b[1][0].row)) {
      rs.sort((a, b) => a.row - b.row);
      const pick = rs.find((r) => r.email) ?? rs[0];
      const t = byName.get(pick.name)!;
      if (t.employee_id && t.employee_id !== id) { log.notes.push(`${pick.name}: has two Employee IDs in the sheet; kept ${t.employee_id}, not ${id}`); continue; }
      t.employee_id = id;
      if (pick.email && !t.email) {
        if (emailOwner.has(pick.email)) log.notes.push(`${pick.name}: email already on ${emailOwner.get(pick.email)}; kept without email`);
        else { t.email = pick.email; emailOwner.set(pick.email, pick.name); }
      }
      const others = [...new Set(rs.map((r) => r.name))].filter((n) => n !== pick.name);
      if (others.length) log.notes.push(`${id}: on ${pick.name}; other names under this ID kept without the ID: ${others.join(", ")}`);
    }
    // 3. every other name keeps its own email unless that email is already on another row (a true name variant shares the
    //    email of its ID's row; distinct people under a placeholder ID such as "1" or "2" keep their own)
    const order = [...byName.values()].sort((a, b) => a.first - b.first);
    for (const t of order) {
      if (t.email) continue;
      const e = rowsOf.get(t.name_normalized)!.map((r) => r.email).find((x) => x);
      if (!e) continue;
      if (emailOwner.has(e)) { log.notes.push(`${t.name_normalized}: email already on ${emailOwner.get(e)}; kept without email`); continue; }
      t.email = e; emailOwner.set(e, t.name_normalized);
    }

    // 4. compare with the table and write (never delete; never blank a filled field)
    const { data: cur, error: curErr } = await sb.from("incentive_technicians")
      .select("id,name_normalized,name_in_system,hub_name,city,employee_id,contact_number,email,active");
    if (curErr) throw new Error("Read of incentive_technicians failed: " + curErr.message);
    const curByName = new Map<string, any>(); const curById = new Map<string, any>(); const curByEmail = new Map<string, any>();
    for (const r of cur ?? []) {
      if (r.name_normalized) { if (curByName.has(r.name_normalized)) log.notes.push(`${r.name_normalized}: two rows in the table; the first is used`); else curByName.set(r.name_normalized, r); }
      if (r.employee_id) curById.set(r.employee_id, r);
      if (r.email) curByEmail.set(String(r.email).toLowerCase(), r);
    }
    const now = new Date().toISOString();
    const plan: { op: string; name: string; fields?: string[] }[] = [];

    for (const t of order) {
      try {
        let row = curByName.get(t.name_normalized);
        // a renamed technician: the ID is on a row with another name and no row has the new name yet
        if (!row && t.employee_id && curById.has(t.employee_id)) {
          row = curById.get(t.employee_id);
          log.notes.push(`${t.employee_id}: renamed in the sheet from ${row.name_normalized} to ${t.name_normalized}`);
          curByName.delete(row.name_normalized); curByName.set(t.name_normalized, row);     // the old name, if still in the sheet, becomes a new name-only row
        }
        const want: Record<string, unknown> = {
          name_normalized: t.name_normalized, name_in_system: t.name_in_system, hub_name: t.hub_name, city: t.city,
          employee_id: t.employee_id, contact_number: t.contact_number, email: t.email, active: t.active,
        };
        // an ID or email already on another row is not moved (that would blank the other row); logged instead
        if (t.employee_id && curById.has(t.employee_id) && curById.get(t.employee_id) !== row) {
          log.notes.push(`${t.name_normalized}: Employee ID ${t.employee_id} is on ${curById.get(t.employee_id).name_normalized} in the table; not moved`);
          delete want.employee_id;
        }
        if (t.email && curByEmail.has(t.email) && curByEmail.get(t.email) !== row) {
          log.notes.push(`${t.name_normalized}: email is on ${curByEmail.get(t.email).name_normalized} in the table; not moved`);
          delete want.email;
        }
        if (!row) {
          const ins: Record<string, unknown> = { created_at: now, updated_at: now };
          for (const [k, v] of Object.entries(want)) if (!empty(v) || k === "active") ins[k] = v;
          plan.push({ op: "insert", name: t.name_normalized });
          if (!dry) {
            const { error } = await sb.from("incentive_technicians").insert(ins);
            if (error) { log.skipped.push({ name: t.name_normalized, reason: "insert failed: " + error.message }); continue; }
            if (ins.employee_id) curById.set(String(ins.employee_id), ins);
            if (ins.email) curByEmail.set(String(ins.email), ins);
          }
          log.inserted++;
          continue;
        }
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(want)) {
          if (k === "active") { if (row.active !== v) patch.active = v; continue; }
          if (k === "name_in_system") {
            const merged = [...new Set([...(row.name_in_system ?? []), ...(v as string[])])];
            if (merged.length !== (row.name_in_system ?? []).length) patch.name_in_system = merged;
            continue;
          }
          if (empty(v)) continue;                       // never overwrite with an empty value
          if (row[k] !== v) patch[k] = v;
        }
        if (Object.keys(patch).length === 0) { log.unchanged++; continue; }
        patch.updated_at = now;
        plan.push({ op: "update", name: t.name_normalized, fields: Object.keys(patch).filter((k) => k !== "updated_at") });
        if (!dry) {
          const { error } = await sb.from("incentive_technicians").update(patch).eq("id", row.id);
          if (error) { log.skipped.push({ name: t.name_normalized, reason: "update failed: " + error.message }); continue; }
        }
        log.updated++;
      } catch (e) {
        log.skipped.push({ name: t.name_normalized, reason: String(e) });
      }
    }

    log.notes = [...new Set(log.notes)];
    const full = { ok: true, dry, ...log, table_rows_before: (cur ?? []).length, plan_sample: plan.slice(0, 15) };
    console.log(JSON.stringify({ ...full, plan_sample: undefined }));
    const counts = { ok: true, dry, rows_read: log.rows_read, names: log.names, inserted: log.inserted, updated: log.updated, unchanged: log.unchanged,
                     skipped: log.skipped.length, notes: log.notes.length, table_rows_before: (cur ?? []).length };
    return new Response(JSON.stringify(detail ? full : counts), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err), rows_read: log.rows_read, inserted: log.inserted, updated: log.updated }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
