# FleetPro — Project Memory

Bounce Daily's internal fleet operations hub. Static HTML/JS frontend deployed via GitHub Pages at **bounceops.online**. Backend is Supabase (Postgres + Edge Functions).

## 🔒 Edit Lock Protocol (all windows + Cowork)

Before editing any page/feature, **claim its row in `LOCKS.md`** (owner + UTC timestamp +
note) and commit that change first. If the row is already locked by another window →
**STOP and wait.** Release it (`(free)`) when done. This keeps terminal windows and Cowork
desktop from clobbering each other on the shared folder.

## 📑 Docs map

Every FleetPro doc is indexed in `docs/INDEX.md` — one canonical context file + one
checklist per area. This is the deploy repo (`vehicle-parts-check`); edit & commit here,
push via the `/tmp` clone (see Repo & Deployment below).

## Repo & Deployment

- **Repo**: `Scalability-Vamsee/vehicle-parts-check` (main branch → GitHub Pages)
- **Live URL**: `https://bounceops.online/v8/` (prod)
- **Staging URL**: `https://bounceops.info/v8/` (staging branch → Vercel)
- **Supabase project**: `clkfvmmlgwcvntxnolsv` (same for both prod and staging)
- **GitHub owner**: `Scalability-Vamsee` (transferred from `vamseebounce` on 2026-08-16)
- **Supabase owner**: `vamsee@scalability.club` (transferred from `vamsee@bounceshare.com` on 2026-08-16)
- **Vercel project**: `vehicle-parts-check` (team: Vamsee Krishna Vorugantis-projects) — production branch = `staging`
- **Manasa (developer)**: GitHub `Manasa4243`, collaborator with Write access (added 2026-08-16)

## 👥 Three-Party Workflow (Manasa + Claude Cowork + Claude Code)

### Who does what

**Manasa (developer)**
- Writes code on her feature branch
- Merges feature → `staging` herself, no approval needed
- Tests on bounceops.info with real data
- Writes migration `.sql` files if DB changes needed (writes only — never applies)
- Fills in `.github/PULL_REQUEST_TEMPLATE.md` completely
- Opens PR: `staging` → `main` and notifies Vamsee

**Claude Cowork (this session — triggered when Vamsee pastes a PR URL)**
- Reads the PR description + diff
- Applies migrations via Supabase MCP BEFORE push
- Deploys changed edge functions via Supabase MCP AFTER push
- Writes Claude Code push prompt to clipboard
- After push confirmed → updates `CLAUDE.md` + `Fleetpro-context.md`

**Claude Code (terminal)**
- Receives clipboard prompt from Cowork
- Clones fresh to `/tmp/fleetpro-push`
- Syntax checks every changed HTML/JS file
- Executes git push to `main`
- Scrubs the clone

**Vamsee**
- Pastes PR URL to Cowork (Claude Cowork reads and reviews the diff — no manual review needed)
- Pastes clipboard prompt to Claude Code + replaces `<PAT>`
- Done

## 🔁 Staging → Production PR Promotion (MANDATORY when Vamsee pastes a PR URL)

When Vamsee pastes a GitHub PR URL (staging → main), follow this exact sequence:

1. **Fetch the PR** via web fetch — read the PR description (filled from `.github/PULL_REQUEST_TEMPLATE.md`)
2. **Review the diff** — fetch and read every changed file. Summarise what changed in plain English. Flag anything suspicious: auth changes, hardcoded secrets, DB calls without RLS consideration, JS errors, mismatch between PR description and actual diff. If something looks wrong → stop and ask Vamsee before proceeding.
3. **List changed files** — identify all modified HTML/JS files and any migration files
4. **Check for migrations** — if `supabase/migrations/` files are included, apply them via Supabase MCP BEFORE the git push
5. **Check for edge function changes** — if edge functions changed, deploy them via Supabase MCP AFTER the git push
6. **Write the Claude Code push prompt** to clipboard:
   - Clone fresh to `/tmp/fleetpro-push`
   - Copy all changed files
   - JS syntax check every HTML file changed
   - `git merge origin/staging` (not cherry-pick — full staging merge)
   - Push to main
7. Tell Vamsee: "Prompt is in clipboard — paste into Claude Code, replace `<PAT>`"
8. **After push confirmed** — update `CLAUDE.md` + `Fleetpro-context.md` to capture what changed

**Never skip the migration step.** If the PR has migrations and you push code first, prod will break.
- **Push discipline → `docs/PUSH-DISCIPLINE.md` (canonical).** macOS FUSE lock means you never push from the mounted folder — always clone fresh to `/tmp/fleetpro-push`, copy changed files, verify, push, scrub. Full rules (clone hygiene, secret scan, PAT inline-only, non-ff = STOP, edge fns = source-of-record) live in that doc.

## 🚀 Cowork → Claude Code deploy handoff (MANDATORY)

After saving any file change, **Cowork must immediately write a clipboard prompt** for
Claude Code to execute the push — no exceptions, no asking the user for the PAT.

Pattern Cowork always follows:
1. Save file(s) to the workspace folder.
2. Write this prompt to clipboard (`write_clipboard`) with `<PAT>` as a literal placeholder:

```
cd /tmp && rm -rf fleetpro-push
git clone https://<PAT>@github.com/vamseebounce/vehicle-parts-check.git fleetpro-push
cp "/Users/vamsee/Desktop/Scalability/Bounce/fleetpro/v8/<file>" /tmp/fleetpro-push/v8/<file>
cd /tmp/fleetpro-push

# ── JS syntax check (runs before every push) ──
node -e "
const fs=require('fs'),cp=require('child_process');
const html=fs.readFileSync('v8/<file>','utf8');
const blocks=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
blocks.forEach((js,i)=>{
  fs.writeFileSync('/tmp/_jscheck.js',js);
  const r=cp.spawnSync('node',['--check','/tmp/_jscheck.js'],{encoding:'utf8'});
  if(r.status!==0){console.error('❌ JS block '+(i+1)+' syntax error:\n'+r.stderr);process.exit(1);}
  console.log('✅ JS block '+(i+1)+' OK');
});
console.log('All checks passed — proceeding to push');
" || exit 1

git add . && git commit -m "<short description>" && git push origin main
```

3. Tell the user: "Prompt is in your clipboard — paste into Claude Code, replace `<PAT>`. Claude Code will syntax-check JS before pushing."

**Never ask the user for their PAT. Never expect the PAT to come to Cowork.**
The user fills in `<PAT>` themselves in the Claude Code terminal.

## Tech Stack

- Vanilla HTML/JS/CSS — no build step, no npm
- Supabase JS v2 (`@supabase/supabase-js@2`) loaded from CDN
- Leaflet.js for maps, CARTO `light_nolabels` tiles
- Inter font from Google Fonts
- GitHub Pages for hosting (bounceops.online CNAME)

## File Structure

```
v8/
  index.html          — Home dashboard (tile grid, auth, sidebar)
  maintenance.html    — Preventive Maintenance
  queue.html          — OOS (Out-of-Service) repair queue
  deployment.html     — Deployment Queue (city filter + allocation toggle, 2026-08-10)
  fw-map.html         — Firmware Pending Map
  rsa.html            — RSA Warroom (Admin panel: Vehicles/Roster/Directory/Spares/Assets tabs; Tickets slide panel; BLR cluster filter — see Fleetpro-context.md §2026-08-12)
  rsa-tech.html       — RSA Tech PWA (field technician app: duty log, ticket flow, FW map tab)
  rsa-tech-manifest.json — RSA Tech PWA manifest
  rsa-tech-sw.js      — RSA Tech service worker (v2: bg ticket polling, Web Push scaffolding, SW_UPDATED banner)
  trace-ho.html       — Trace HO Dashboard (FPI Recovery, HO view)
  trace-hunter.html   — Hunter PWA (field agent app)
  trace-hunter-manifest.json — Hunter PWA manifest
  trace-hunter-sw.js  — Hunter service worker
  icon-192.png / icon-512.png — Hunter PWA install icons (shared by rsa-tech + trace-hunter)
  admin-techs.html    — Admin: Manage Technicians
  admin-permissions.html — Admin: Permissions (role badges in user directory, 2026-08)
  admin-analytics.html — Admin: Page Analytics + Sync Jobs + Void Rate tabs
  rfd-check.html      — Admin: RFD Check (reg search → IoT/MCU/JC pass-fail; reads rfd_violations_cache)
  jc-approval.html    — Admin: Manual JC Approval Check
  incentive.html      — Technician Incentive Portal (dashboard/leaderboard/admin/Analytics tabs) + PWA
  incentive-manifest.json — Incentive PWA manifest
  incentive-sw.js     — Incentive PWA service worker (v2, 2026-07-29 — see Fleetpro-context.md)
  logo.jpg            — Bounce logo
```

## Auth Pattern (CRITICAL — do not change)

All pages use Supabase auth. The pattern:

1. Auth screen covers the page (`z-index:9999`) on load
2. `bootPage()` calls `sb.auth.getSession()`
3. If session exists → `activateSession(session)` which:
   - Calls `loadAndApplyPermissions(session)` FIRST
   - If permissions fail → redirect to `index.html`
   - Only then calls `hideAuthScreen()`
4. NO permission veil (`position:fixed;z-index:8000`) — auth screen IS the cover

All pages including `trace-hunter.html` now follow this exact flow (the Hunter PWA previously used a `#perm-veil` + checked permissions after hiding the auth screen — fixed 2026-06-18 to boot permissions-first like the rest).

**Superadmin short-circuit**: `session.user.app_metadata.is_superadmin` → grants all features, bypasses DB queries. Present on every page including `trace-hunter.html`.

**Feature gating**: `user_groups` → `group_features` → `{key:true}` map → `data-feature` attributes on DOM elements.

**Auth bug discipline (mandatory before declaring any auth fix)**:
1. Grep file for every `signOut()` call
2. For each one, trace exact condition and simulate against affected user's state
3. Confirm full session completes without hitting any of them

**Pre-auth email gate (`sendMagicLink()`, do not hardcode) — updated 2026-08-12**: Before calling `signInWithOtp`, every page checks the entered email. `@bounceshare.com` bypasses unconditionally (company staff). Any other email must pass `sbClient.rpc('is_approved_user',{p_email:email})` (or the raw REST equivalent on pages not using the JS client) — this Postgres RPC checks `hr_employees`/`incentive_technicians`/`rsa_technicians` server-side, sidestepping the fact that those tables are `authenticated`-only RLS and can't be reliably probed from an anon pre-login session. **Never reintroduce a hardcoded email/domain allowlist** (`RSA_EMAILS`, `ALLOWED_EMAILS`, a single exception like `vamsee@scalability.club`) — every one of those was removed 2026-08-12 in favor of this RPC precisely because they drift from the real technician/employee roster and require a code push to update. If a legitimate user gets rejected, the fix is a DB row (add them to `rsa_technicians`/`hr_employees`/`incentive_technicians`), not a code-level exception.

## Sidebar Layout (index.html)

Sections and their labels:
- **Fleet Tools**: Home
- **Service Operations**: Preventive Maintenance, OOS Queue
- **Hub Operations**: Deployment Queue
- **RSA Operations**: FW Pending Map, RSA Warroom, RSA Tech App ← (data-feature="tech-app", added 2026-08-01)
- **Recovery Operations**: Trace, Hunter ← (data-feature="trace-ho")
- **Admin**: Manage Technicians, Permissions, RFD Check ← (data-feature="rfd-check")
- **Coming Soon**: Fleet Analytics, Alert Centre

`tech-app` feature key gates the RSA Tech PWA link; group membership is auto-assigned from `rsa_technicians.city` via `sync_rsa_tech_groups()` (daily cron, 02:00 IST) and can be set manually per-tech via the Directory Role dropdown in `rsa.html` (calls `assign_rsa_role()` RPC).

Sidebar never auto-pins. No `@media(min-width:900px)` rule. `localStorage('sb_pinned')` for user preference only.

## Index Tile Layout

Pattern: **2 → 1(full-width) → 2 → 1(full-width)**

1. Preventive Maintenance + Pending OOS Vehicles
2. Deployment Queue (full-width, horizontal layout)
3. FW Pending Map + RSA Warroom
4. Trace (full-width, horizontal layout, same structure as Deployment Queue)

Tile accent bars are 5px top gradient, department-based:
- Fleet Health (PM): `#E8191C → #F97316`
- Workshop (OOS): `#1D4ED8 → #0891B2`
- Deployment: `#7C3AED, #0369A1, #059669`
- Tech/FW: `#0369A1 → #0891B2`
- RSA: `#7C3AED → #A855F7`
- Trace/Recovery: `#F59E0B → #EF4444`

## Tile Stats Data Flow (index.html)

`loadTileStats()` called on login, refreshes every 5 minutes via `setInterval`.

| Tile | Table | Filter | Metric |
|------|-------|--------|--------|
| PM | `vehicle_parts_check_flag` | `check_required=true` | count + overdue/due-soon breakdown |
| OOS | `oos_work_queue` | all | count + hub count + est. time |
| Trace | `recovery_tickets` | `status NOT IN (cancelled, at_hub)` | pending count + critical (72h+) count |

Uses `Prefer: count=exact` + `Range: 0-0` header to get counts without fetching rows.

## Trace & Hunter — Build Status

Full spec in `Trace and Hunter/context.md`.

> **2026-06-18 — Phase 1 fully deployed.** Two code passes pushed to GitHub and all Supabase changes applied:
> 1. **Bug-fix pass** (commits `6410c87`, `056c837`): 14 Phase-1 fixes — Hunter actions, auth alignment, HO map/stats, Voronoi zones, `marked_at_utc` tz, RLS ownership, `user_id`.
> 2. **RSA-clone rebuild** (commit `1847e69`): `trace-ho.html` rebuilt from `rsa.html` — Micro-RAM cache architecture, `hunter_locations`, `parseUtcTs` Safari fix, breadcrumb writes.
>
> **Supabase deploy status (verified 2026-06-22):**
> - ✅ Migrations 0002–0006 all applied (`recovery_tickets_cache`, `hunter_locations`, `hunter_locations_latest` view, RLS ownership policy, `recovery-photos` bucket)
> - ✅ Edge fns `zone-cluster` (d3-delaunay) and `recovery-ticket-sync` (cache rebuild) redeployed
> - ✅ Metabase Q1 re-published with `marked_at_utc` + `user_id`
> - ⚠️ `rental_locations` only has NCR hubs (city_id=1) — BLR/HYD hub data not imported; hub layer only shows NCR pins
> - ⚠️ `roster_template` empty — zone-cluster assigns no hunters (k=4 default); Phase 2 roster UI will populate this
> - ⚠️ `recovery_tickets.city_id` all NULL — safe, do not populate from DMS city_id without verifying mapping
>
> **2026-06-19 — hotfix** (commit `6ca86db`): `trace-ho.html` `validLL()` India-bbox guard on all map paths.
>
> **2026-06-22 — additional fixes** (commits `37a9033`, `cc4481c`, `330db7d`, `fb9d3cd`): Hunter PWA `validLL` bug, team vehicles layer, zone morning-gap fix, refresh/recenter/track UX fixes.

### Phase 1 — Core Ops

- [x] `recovery_tickets` + `recovery_ticket_events` table migrations
- [x] `recovery_blocked_vehicles` table
- [x] Edge function: Q1 — new ticket creation (5-min cron)
- [x] Edge function: Q2 — open ticket reconciliation (5-min cron)
- [x] Edge function: blocked-sync — Google Sheet → table (6 PM cron)
- [x] Edge function: zone-cluster — k-means + Voronoi per city (6 PM cron)
- [x] Auto zone + hunter assignment from clustering output
- [x] FPI groups + feature permissions (`trace-ho`, `trace-hunter`)
- [x] HO Dashboard (trace-ho.html) — map, color-coded pins, zone cards, stats bar, filter bar, auto-refresh
- [x] Hunter PWA shell (trace-hunter.html + trace-hunter-manifest.json + trace-hunter-sw.js)
- [x] Hunter PWA: vehicle list sorted by nearest distance (Haversine, Phase 1 = bike GPS as reference)
- [x] Hunter PWA: Call action → dials, then outcome sheet sets `call_status` (informed / no_response); never regresses status
- [x] Hunter PWA: Navigate action → sets ticket status to `en_route` (+ `en_route_at`, event)
- [x] Hunter PWA: Mark Found — photo upload required → sets `mark_found_at`, `mark_found_photo_url`, `hub_id` (nearest active `rental_locations` via client-side Haversine)
- [x] Hunter PWA: In Transit — photo upload required → sets `in_transit_at`, `in_transit_photo_url`. **Does NOT write `bike_operations_log`** — In Transit is Trace & Hunter internal state only (decision 2026-06-18, overrides the spec line that said it writes `recovered`)
- [x] HO Dashboard: "Location unknown" list — tickets with no GPS in `bike_location_cache`
- [~] GPS fallback logic — `bike_location_cache` exposes a single resolved `lat/lng` + `baas_location_time` (baas-vs-current fallback happens upstream at cache-sync). Verify upstream; no client-side fallback needed.
- [x] GPS staleness indicator — `gpsAge()` on Hunter cards + `gpsAgeStr()` in HO popups ("Xh / Xd ago")
- [x] Voronoi zone boundaries — `zone-cluster` computes GeoJSON (`boundary_polygon`) via d3-delaunay; trace-ho renders dashed colored cells under pins
- [x] `recovery-photos` storage bucket (public-read, authenticated-write) — migration `…0004`
- [x] RLS: UPDATE restricted to owner-or-superadmin — migration `…0005`
- [x] Edge functions redeployed: `zone-cluster` v2 (d3-delaunay), `recovery-ticket-sync` v2 (`marked_at_utc` IST→UTC + `user_id`)
- [x] Metabase Q1 (`8ef20d85…`) re-published with `marked_at_utc` + `user_id` columns

### Phase 2 — Ops Quality

- [ ] Cool-off mechanism — hunter-initiated, 2hr, one-time per ticket; `cooloff_expires_at` countdown in UI
- [ ] Deprioritize vehicle — hunter flags, sinks to bottom of list, HO sees deprioritized count per hunter
- [ ] Admin live override panel — drag-reassign vehicles between hunters on HO map
- [ ] Roster system UI — Mon–Sun matrix (Hunter × 7 days), template + overrides
- [ ] Bulk reassign — mark absent → covering hunter inherits all open tickets
- [ ] Instant push notification to hunter when customer renews while `en_route` (Q2 special case, <5min lag)
- [ ] PWA push notifications — new vehicle added to zone mid-day
- [ ] Newly added vehicle pulsing pin animation on HO map
- [ ] Base list / Added today filter toggle
- [ ] Re-cluster now button (Super admin only)

### Phase 3 — Intelligence

- [ ] Porter booking (in-system, replaces WhatsApp)
- [ ] Key metrics dashboard (avg recovery time, hunter productivity, zone performance)
- [ ] Call attempts tracking (`call_attempts` count + `last_called_at`)
- [ ] Damage fee exposure tracking
- [ ] Historical zone performance analytics
- [ ] Zone config history viewer

---

## Trace & Hunter Module

### Key rules (do not violate)
- GPS always read live from `bike_location_cache` via `reg_number` — never stored on ticket
- Do not modify any existing FleetPro feature not in spec
- Build only Phase 1 items

### trace-ho.html (HO Dashboard — "Trace")
**Rebuilt 2026-06-18 as a full RSA-Warroom clone** (`v8/rsa.html` is the base template) — same shell/components/interactions, adapted to recovery data. Single full-screen map (no more city-tab/zone-card sidebar layout).
- Layout mirrors RSA: global bar (City multiselect + Marked-date range + Refresh + sync badge) → clickable tiles → map-filter row (Zone NE/NW/SE/SW + Status + Age + Hunter multiselects + search) → full map.
- **Reads ONE table: `recovery_tickets_cache`** (GPS pre-joined by the edge fn). localStorage cache (`trace_ho_v1`, 60s TTL) + 60s poll. No client-side join, no per-client GPS fan-out — Micro-RAM friendly.
- `parseUtcTs()` (copied from RSA) for all timestamp parsing — fixes Safari/iOS `NaN` on `+00` offsets.
- Pin colors by `hoursIn(t)`: amber<24h, coral<48h, orange<72h, dark-red 3d+. Call-status ring: blue=informed, grey=no_response.
- Tiles (city-scoped, clickable): Total Pending, Critical 3d+ (flashes pins), Recovered Today, Calls Made, Hunters Active.
- Layers panel: Zones (Voronoi from `zone_configs.boundary_polygon`) / Hubs (`rental_locations`) / Hunters (live dots from `hunter_locations_latest`).
- Track panel: Hunter Trail (`hunter_locations` polyline) / Ticket Events (`recovery_ticket_events` timeline by reg).
- Location-Unknown: slide-in panel (tickets with no GPS **or out-of-India GPS** — see coordinate guard below), opened from a map-control button.
- **Coordinate guard `validLL(lat,lng)` (2026-06-19):** every marker / `fitBounds` path (ticket pins, hubs, live hunter dots, hunter trail, Critical-flash, reg search-zoom) requires coords inside India's bbox (lat 6.5–37.5, lng 68–97.5). A `0,0` / swapped / out-of-range GPS no longer plots an ocean pin or blows `fitBounds` out to world view — it routes to the Location-Unknown list instead.
- Auth: permissions-first + superadmin short-circuit (NO perm-veil — matches the documented pattern, not RSA's older veil).

### trace-hunter.html (Hunter PWA — "Hunter")
- Mobile-first PWA (trace-hunter-manifest.json + trace-hunter-sw.js)
- Field agent app for ground team; My Queue (list) + Map tabs
- Reads `recovery_tickets` directly (own small slice — real-time for own actions), NOT the cache.
- List sorted nearest-first by Haversine from live phone GPS (`watchPosition`); in-transit tickets sink to the bottom as a collapsed confirmation line
- Actions: **Call** (dial → outcome sheet: informed/no_response), **Navigate** (opens maps → sets `en_route`), **Mark Found** (photo → `recovery-photos` bucket → `mark_found_photo_url` + nearest `hub_id`), **In Transit** (photo → `in_transit_photo_url`, internal state only)
- Null phone → disabled "No phone" button; no GPS → disabled "No GPS" Navigate
- `parseUtcTs()` for age parsing (Safari fix). Writes a throttled (~45s) breadcrumb to `hunter_locations` on `watchPosition` → HO live dots + Track trail.

### Supabase tables (Trace & Hunter)
- `recovery_tickets` — core ticket table (GPS never stored here)
- `recovery_ticket_events` — append-only event log
- `bike_location_cache` — live GPS (never join via ticket, always via reg_number; cols: `reg_number, lat, lng, baas_location_time`)
- `zone_configs` — daily clustering output (centroids, hunter, `boundary_polygon` GeoJSON, per date/city/zone)
- `recovery_blocked_vehicles` — police-station / impounded exclusions (6 PM Google Sheet sync)
- `roster_template` / `roster_overrides` — hunter roster (Phase 2 UI; read by zone-cluster)
- `rental_locations` — hubs (`id, location_name, lat, lng, city_id, status`); nearest-hub Haversine at Mark Found
- `recovery_tickets_cache` — **denormalised HO snapshot** (open + today-recovered, GPS pre-joined). Rebuilt by `recovery-ticket-sync` every 5 min (delete+reinsert). The HO dashboard's only read source — keeps the GPS join off the client (Micro RAM).
- `hunter_locations` (+ `hunter_locations_latest` view) — hunter GPS breadcrumbs from the PWA; HO live dots + Track trail. 7-day retention.

### Storage
- `recovery-photos` bucket — Mark Found / In Transit proof photos (public-read, authenticated-write); path `<ticketId>/<ts>.<ext>`

### Migrations
- `…0002_trace_hunter_tables.sql` — tables, enums, RLS, triggers
- `…0003_trace_hunter_groups.sql` — FPI groups + feature keys
- `…0004_recovery_photos_bucket.sql` — storage bucket + policies
- `…0005_recovery_tickets_update_ownership.sql` — UPDATE restricted to owner-or-superadmin
- `…0006_recovery_ho_cache.sql` — `recovery_tickets_cache` + `hunter_locations` (+ latest view) + 7-day cleanup fn

### Edge functions
- `recovery-ticket-sync` — 5-min cron, syncs Q1+Q2 tickets (resolves `marked_at_utc` IST→UTC; sets `user_id`); **Step 3 rebuilds `recovery_tickets_cache`** (GPS-enriched snapshot for the HO dashboard)
- `recovery-blocked-sync` — 6 PM cron, syncs Google Sheets blocked list
- `zone-cluster` — 6 PM cron, balanced k-means + Voronoi (d3-delaunay) + roster-based hunter assignment

### Feature keys
- `trace-ho` — HO Dashboard access
- `trace-hunter` — Hunter PWA access

### Do-not-violate decisions
- **In Transit never writes `bike_operations_log`** — it's Trace & Hunter internal state (overrides context.md). Do not add an ops_log write.
- **All map markers must pass `validLL()`** (India bbox lat 6.5–37.5, lng 68–97.5) before `L.marker` / `fitBounds`. One out-of-range GPS row otherwise distorts the whole map to world view.
- RLS `recovery_tickets` UPDATE = owner-or-superadmin. Phase 2 admin drag-reassign will need a broader policy.

## Pending Deploys (as of 2026-08-14)

| Item | Status | Action needed |
|------|--------|---------------|
| `jc-failure-alert` v6 | ✅ git (8099932, 2026-08-01) · ✅ MCP-deployed | — done — |
| `jc-history-sync` v12 | ✅ git (8099932, 2026-08-01) · ✅ MCP-deployed | — done — |
| `sync-hr-employees` | ✅ git (bd65cfb) · ✅ MCP-deployed (v14, 2026-08-14) | — done — |
| `zone-cluster` + `recovery-blocked-sync` | ✅ code · ✅ MCP-deployed (v12/v7, 2026-08-14) | — done — |
| `rsa_tickets_cache` realtime | ✅ live via MCP · ✅ git (de16d6c migration) | — done — |

**H4 summary (2026-07-26):** `dms_api_call_json` (JSON with embedded newlines/commas) broke the old regex/line-split CSV parser → `intrip` mapped to `undefined`. Fixed with RFC 4180 compliant `parseCSV`. Labels: `intrip=true` → "🔴 RUNNING REPAIR", `false` → "GENERAL SERVICES (Repossessed)".

**H5 summary (2026-07-26):** Metabase card grew to 372k rows / 46MB → edge fn OOM (`WORKER_RESOURCE_LIMIT`). v12: streaming reader + 90-day incremental delete/reinsert. Metabase card `a2c3e48b` updated to filter last 90 days. Full seed of 372,053 rows done from bash (2025-04-01 → 2026-07-24). Crons: job 21 (every 2h) + job 41 (every 3h) maintain rolling 90-day window.

---

## Security Constraints

- **PAT**: Never store in any committed file. Inline to git clone URL only, then discard.
- **Login key**: `Hatric1@3` — Supabase env only, never in code
- **ARCHIVE_CRON_SECRET**: In Supabase vault + edge fn secrets only, never in git
- **Supabase anon key**: Safe to commit (it's public-facing by design)

## Map Tiles (all map pages)

```js
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap © CARTO',
  maxZoom: 19,
  subdomains: 'abcd'
}).addTo(map);
```

## Common Patterns

**Counting rows without fetching data:**
```js
var h = { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + K, 'Prefer': 'count=exact', 'Range': '0-0' } };
fetch(SB + '/rest/v1/table_name?select=id&filter=eq.value', h)
  .then(r => parseInt(r.headers.get('Content-Range').split('/')[1]) || 0)
```

**IST date string:**
```js
function getIstDate(){ return new Date(Date.now()+5.5*3600000).toISOString().slice(0,10); }
```
