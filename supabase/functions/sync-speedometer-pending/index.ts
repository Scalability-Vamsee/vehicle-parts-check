import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SB_URL   = Deno.env.get('SUPABASE_URL')!;
const SB_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQQKVgHvymh2uIl8_C-7cYcaQfrRMXSAcK1Rsfm8UWEVz-flIxqzHIDFFXwjmgIfWSjHtpU8HlbpZGo/pub?gid=1119617809&single=true&output=csv';

interface SpeedoRow {
  serial_number:   string;
  system_status:   string | null;
  zone:            string | null;
  hub:             string | null;
  reg_number:      string;
  bike_status:     string | null;
  completion:      string | null;
  technician_name: string | null;
  lat:             number | null;
  lng:             number | null;
  loc_time:        string | null;
  vehicle_status:  string | null;
}

Deno.serve(async () => {
  const sb = createClient(SB_URL, SB_KEY);

  // 1. Fetch the published Google Sheet CSV
  const sheetRes = await fetch(SHEET_URL);
  if (!sheetRes.ok)
    return new Response('Sheet fetch failed: ' + sheetRes.status, { status: 500 });
  const csv = await sheetRes.text();

  // 2. Parse CSV (RFC 4180 — handles quoted fields)
  function parseCSV(text: string): Record<string, string>[] {
    const allRows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\r') { /* skip */ }
        else if (ch === '\n') { row.push(field); field = ''; allRows.push(row); row = []; }
        else { field += ch; }
      }
    }
    row.push(field);
    if (row.some(c => c)) allRows.push(row);
    if (!allRows.length) return [];
    const hdrs = allRows[0].map(h => h.trim());
    return allRows.slice(1)
      .map(r => {
        const obj: Record<string, string> = {};
        hdrs.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
        return obj;
      })
      .filter(r => r['Serial Number'] && r['Reg No']);
  }

  const rows = parseCSV(csv);
  if (!rows.length)
    return new Response('No data rows parsed from sheet', { status: 500 });

  // 3. Collect unique reg_numbers for GPS lookup
  const regNums = [...new Set(rows.map(r => r['Reg No']).filter(Boolean))];

  // 4. Fetch GPS from bike_location_cache in batches of 500
  const gpsMap: Record<string, any> = {};
  for (let i = 0; i < regNums.length; i += 500) {
    const batch = regNums.slice(i, i + 500);
    const { data: gpsRows } = await sb
      .from('bike_location_cache')
      .select('reg_number,lat,lng,baas_location_time,vehicle_status')
      .in('reg_number', batch);
    (gpsRows || []).forEach((g: any) => { gpsMap[g.reg_number] = g; });
  }

  // 5. Build insert rows (all from sheet, regardless of Completion status)
  const toInsert: SpeedoRow[] = rows.map(r => {
    const gps = gpsMap[r['Reg No']] || {};
    return {
      serial_number:   r['Serial Number'],
      system_status:   r['System status'] || null,
      zone:            r['Zone'] || null,
      hub:             r['Hub'] || null,
      reg_number:      r['Reg No'],
      bike_status:     r['Bike Status'] || null,
      completion:      r['Completion'] || null,
      technician_name: r['Technician Name'] || null,
      lat:             gps.lat ?? null,
      lng:             gps.lng ?? null,
      loc_time:        gps.baas_location_time ?? null,
      vehicle_status:  gps.vehicle_status ?? null,
    };
  });

  // 6. Delete all existing rows + reinsert in chunks of 200
  await sb.from('speedometer_pending').delete().not('serial_number', 'is', null);

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { error } = await sb.from('speedometer_pending').insert(chunk);
    if (error)
      return new Response(`Insert error at chunk ${i}: ${error.message}`, { status: 500 });
    inserted += chunk.length;
  }

  const pending  = toInsert.filter(r => r.completion === 'Pending').length;
  const withGps  = toInsert.filter(r => r.lat && r.lng).length;
  const noGps    = toInsert.filter(r => r.completion === 'Pending' && !r.lat).length;

  return new Response(
    `Synced ${inserted} rows · ${pending} pending · ${withGps} with GPS · ${noGps} pending without GPS`,
    { status: 200 }
  );
});
