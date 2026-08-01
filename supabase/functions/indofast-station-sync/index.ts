/**
 * indofast-station-sync
 * Runs daily at 8 AM IST (2:30 AM UTC).
 * Fetches top 5 Indofast swap stations per city (BLR + NCR) from Metabase,
 * upserts visit stats into indofast_top_stations.
 * Coordinates are seeded once in the migration and preserved on conflict.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SB_URL  = Deno.env.get('SUPABASE_URL')!
const SB_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MB_URL  = 'https://metabaselatest-dy7gqwqrma-el.a.run.app'
const MB_CARD = '6a53446d-848e-4ea5-8f9d-66605f84c77c'

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
    else cur += ch
  }
  result.push(cur.trim())
  return result
}

async function writeHeartbeat(
  sb: ReturnType<typeof createClient>,
  status: string, durationMs: number,
  rows: number | null = null, errorMessage: string | null = null
) {
  try {
    await sb.from('sync_heartbeats').insert({
      function_name: 'indofast-station-sync',
      status, duration_ms: durationMs,
      rows_affected: rows, error_message: errorMessage,
      synced_at: new Date().toISOString()
    })
  } catch (_) {}
}

Deno.serve(async () => {
  const t0 = Date.now()
  const sb = createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    const res = await fetch(`${MB_URL}/api/public/card/${MB_CARD}/query/csv`, {
      signal: AbortSignal.timeout(30000)
    })
    if (!res.ok) throw new Error(`Metabase fetch failed: ${res.status}`)
    const csvText = await res.text()
    const lines = csvText.split('\n').filter(l => l.trim())
    if (lines.length < 2) throw new Error('Empty CSV from Metabase')

    // Headers: City,Total Bikes Visited Today,Home Bikes,Location,Cabinets,Station IDs,Short Address,Address,Provider
    const headers = parseCSVLine(lines[0]).map(h =>
      h.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '')
    )

    const rows = lines.slice(1).map(line => {
      const cols = parseCSVLine(line)
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = cols[i] || '' })
      return obj
    })

    // Yesterday in IST (data at 8 AM reflects the previous full day)
    const nowIst = new Date(Date.now() + 5.5 * 3600000)
    nowIst.setDate(nowIst.getDate() - 1)
    const statDate = nowIst.toISOString().slice(0, 10)

    let updated = 0
    // Metabase returns top 5 per city sorted by visits desc — rows 1-5 = BLR, 6-10 = NCR
    const cityRankCounter: Record<string, number> = {}

    for (const row of rows) {
      const cityRaw = (row.city || '').trim()
      const city = cityRaw === 'Bangalore' ? 'BLR' : cityRaw === 'NCR' ? 'NCR' : null
      if (!city) continue

      cityRankCounter[city] = (cityRankCounter[city] || 0) + 1
      const rank = cityRankCounter[city]
      if (rank > 5) continue

      const location       = row.location || ''
      const totalBikes     = parseInt(row.total_bikes_visited_today) || 0
      const homeBikes      = parseInt(row.home_bikes) || 0
      const shortAddress   = row.short_address || ''
      const address        = row.address || ''
      const cabinets       = parseInt(row.cabinets) || null
      const stationIds     = row.station_ids || ''

      // Upsert: preserve lat/lng on conflict, update stats
      const { error } = await sb.from('indofast_top_stations')
        .upsert({
          city, rank, location,
          short_address: shortAddress,
          address, cabinets,
          station_ids: stationIds,
          total_bikes_visited: totalBikes,
          home_bikes: homeBikes,
          stat_date: statDate,
          synced_at: new Date().toISOString()
        }, {
          onConflict: 'city,location',
          ignoreDuplicates: false
        })

      if (error) {
        console.error(`Upsert failed for ${city} ${location}:`, error.message)
      } else {
        updated++
      }
    }

    await writeHeartbeat(sb, 'success', Date.now() - t0, updated)
    return new Response(
      JSON.stringify({ ok: true, updated, stat_date: statDate }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('indofast-station-sync error:', err)
    await writeHeartbeat(sb, 'error', Date.now() - t0, null, err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
