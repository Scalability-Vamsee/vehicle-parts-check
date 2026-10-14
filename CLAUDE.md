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
   - `git push origin main` (requires PAT with admin rights; branch protection bypassed only for PR-reviewed merges)
7. Tell Vamsee: "Prompt is in clipboard — paste into Claude Code, replace `<PAT>`"
8. **After push confirmed** — update `CLAUDE.md` + `Fleetpro-context.md` to capture what changed

**Never skip the migration step.** If the PR has migrations and you push code first, prod will break.
- **Push discipline → `docs/PUSH-DISCIPLINE.md` (canonical).** macOS FUSE lock means you never push from the mounted folder — always clone fresh to `/tmp/fleetpro-push`, copy changed files, verify, push, scrub. Full rules (clone hygiene, secret scan, PAT inline-only, non-ff = STOP, edge fns = source-of-record) live in that doc.

## 🚀 Cowork → Claude Code deploy handoff (MANDATORY)

After saving any file change, **Cowork must immediately write a clipboard prompt** for
Claude Code to execute the push — no exceptions, no asking the user for the PAT.

**Push target: always `staging`, never `main` directly.**
`main` is branch-protected (no bypass allowance). All changes land on `staging` first;
`main` only moves via PR review (Cowork reads the PR → Claude Code merges).

Pattern Cowork always follows:
1. Save file(s) to the workspace folder.
2. Write this prompt to clipboard (`write_clipboard`) with `<PAT>` as a literal placeholder:

```
cd /tmp && rm -rf fleetpro-push
git clone https://<PAT>@github.com/Scalability-Vamsee/vehicle-parts-check.git fleetpro-push
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

git add . && git commit -m "<short description>" && git push origin HEAD:staging
```

3. Tell the user: "Prompt is in your clipboard — paste into Claude Code, replace `<PAT>`. Claude Code will syntax-check JS and push to staging."

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
  fw-map.html         — Firmware Pending Map (standalone page; also embedded as the RSA Warroom "FW Map" tab via `?embed=1` — see Pending Deploys 2026-10-14)
  rsa.html            — RSA Warroom (Admin panel: Vehicles/Roster/Directory/Spares/Assets tabs; Tickets slide panel; BLR cluster filter — see Fleetpro-context.md §2026-08-12; "FW Map" tab after Admin = lazy iframe of `fw-map.html?embed=1`, gated by `data-feature="fw-map"`)
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

## Pending Deploys (as of 2026-09-26)

| Item | Status | Action needed |
|------|--------|---------------|
| **RSA Warroom "FW Map" tab (2026-10-14).** New 4th top tab right after Admin in `rsa.html` (`#view-fw-btn`, `data-feature="fw-map"` — same feature that gates the standalone page + sidebar link) showing the FW-pending live map (DIU FW / MCU 60A / Speedometer, city toggle, hub filter, search, Layers, RSA team markers). Implemented as a **lazy iframe of `./fw-map.html?embed=1`** (loaded on first open only — no extra queries / sync calls / polling for users who never open it; re-opening posts `fw-embed-show` so the frame re-measures the map and refreshes if >2 min stale). `showView('fw')` also hides the RSA City/date bar + ticket tiles while the tab is open (they only filter RSA tickets) and restores them on every other tab. **`fw-map.html` change is additive & gated on `?embed=1`** (`FW_EMBED` flag + `html.embed` class): hides its own `#topbar`/`#sb`/`#ov`/settings modal, ignores the pinned-sidebar margin, does NOT start the idle-signout timer (a hidden frame sees no activity and would otherwise sign the whole session out after 8h — the parent owns the session lifetime), and on "no fw-map feature" shows a message instead of redirecting `index.html` inside the frame (`fwDeny()`). The standalone page is unchanged (verified: same layout for all 53 element ids + pixel-identical screenshot vs the previous version). Browser-tested headless against stubbed Supabase (47 checks: tab order, lazy load, bars hidden/restored, frame sizing at 1440/1280/1024, no scrollbars, no idle timer in embed, re-open without reload + stale refresh, feature gating incl. missing `fw-map`/`rsa-admin`, sign-out → re-sign-in recovery of the frame, superadmin-without-group-rows path in parent + frame, no JS errors). Tab label is "📍 FW Map". **Rebased 2026-10-14 after the first push prompt's Guard 1 fired (by design):** staging's `rsa.html` (`ccd69274…`) had moved since our base (`5c1e3037…`) — newer `loadAndApplyPermissions(session)` with a superadmin shortcut that grants only `rsa-warroom` + `rsa-admin`. Staging's file was reconstructed byte-exactly from the old base + that change (hash matched), the FW Map hunks re-applied on top, and the superadmin branch now also sets `f['fw-map']=true` so a superadmin with no group rows still sees the tab. `fw-map.html` has no superadmin short-circuit of its own, so **in embed mode only** it mirrors the parent's (`fwSuper()` → `features['fw-map']=true`); the standalone page is untouched (superadmin without group rows is still redirected there, as before — pre-existing gap vs the "superadmin short-circuit on every page" rule, not changed here). Staging (Vercel) sends no `X-Frame-Options`/CSP and a live same-origin iframe of its `fw-map.html` loaded fine (verified 2026-10-14). | ✅ **LIVE on prod 2026-10-14.** Pushed to staging by Claude Code as `981cd88` (guards passed: staging `rsa.html` `ccd69274…` / `fw-map.html` `581ec5e8…`, mounted `c6e1d82c…` / `3b7515f4…`; JS syntax OK; exactly 2 files, numstat rsa +31/−4, fw-map +49/−2; Co-Authored-By trailer), then promoted by **PR #30** `staging`→`main`, merged as `29b5ac2` (mergeable clean, `main` has 0 required reviews / no required checks). GitHub Pages serves `rsa.html` `c6e1d82c…` and `fw-map.html` `3b7515f4…` ~1–2 min after the merge. | Vamsee: smoke test on prod `bounceops.online/v8/rsa.html` (tab right after Admin; the map loads inside it; Map tab restores the RSA City/date bar + tiles; standalone `/v8/fw-map.html` unchanged). Visibility today: every one of the 19 users who can open RSA Warroom already has `fw-map` (groups Admin 15, RSA Warroom 5), so all of them see the tab; the RSA Field Team group (17 users) has `fw-map` but not `rsa-warroom`, so it keeps the standalone map only. The tab condition is the existing permission design (admin-permissions screen), not a code gate; to show it to everyone give `fw-map` to any group that gets `rsa-warroom`. Known/accepted: after leaving the tab the frame keeps polling until its own 15-min idle limit. Rollback: revert `29b5ac2`. **Lesson:** staging is `bounceops.info`, prod is `bounceops.online`; the tab is on prod only after the PR merge. |
| **FW Map toggle: one-at-a-time + Refresh fix (2026-10-14).** In `fw-map.html` the DIU FW / MCU 60A / Speedometer buttons were a hybrid (Speedometer exclusive, DIU + MCU combinable, clicking the active one a no-op, silent switch-off of Speedometer). Now exactly one mode is active: `toggleFwMode(mode)` sets `_fwModes = new Set([mode])` (clicking the active mode is a no-op), the hub list, title and Indofast layer follow the mode. `loadMapData()` now re-fetches the speedometer list on every load / Refresh / auto-refresh while Speedometer mode is on (it used to fetch only when `_allSpeedo` was empty, so Refresh left the default view stale until a page reload); switching back to Speedometer re-fetches when the list is older than 2 min (`_speedoAt`, set in `fetchSpeedoData`). The DIU+MCU merge branch in `getMergedSource()` is now unreachable (left in place). Tested by running the real `toggleFwMode` / `loadMapData` against stubs (18 checks: all 9 transitions, Indofast layer, fetch-on-switch rule, Refresh per mode; the same checks fail 6 on the previous file); not clicked through in a real browser. | ✅ **LIVE on prod 2026-10-14.** Staging `b689e20` (guards: staging `fw-map.html` `3b7515f4…`, mounted `973f06c3…`; exactly 1 file, numstat +9/−17), **PR #31** merged to `main` as `2d9278f`; prod serves `fw-map.html` `973f06c3…`. | Vamsee: try the toggle on prod (standalone + inside the RSA tab). Rollback: revert `2d9278f`. |
| **`rsa_cc_calls` + `rsa-cc-calls-sync` (2026-10-14).** Customer calls (Smartflo "smartflo data" table in the RSA DB) within ±24h of each RSA ticket, from Metabase card `64d56b96-6834-4399-be56-ac49275f1393` ("CC Calls before RSA Ticket creation"). Revised query = rolling 30 days from IST midnight, adds `call_id` (the upsert key), IST time columns, UPPER(city), deterministic Call-ID dedupe, 10-digit phone guard, and a hash-joinable primary/secondary phone join (old IN/OR join). Query logic tested in Postgres on synthetic edge cases (dup Call ID, +91/leading-0 formats, primary=secondary, short phone, 24h boundary, window edge) and the fn's row mapper on 167 real rows. Table PK `(ticket_number, call_id)`; `call_id=''` = ticket with no call found (placeholder pruned by `rsa_cc_calls_prune_placeholders()` once a real call row appears). RLS `is_rrr_viewer()`; `primary_phone`/`secondary_phone` NOT selectable by clients (explicit column GRANT list). Edge fn v1 (verify_jwt on), cron 119 `rsa-cc-calls-sync-hourly` (`20 * * * *`). Guard: while the card is still the old 1-day query (no `call_id`) the fn writes nothing and returns 409. **Also fixed same day:** `rsa_tickets_raw` rider name/phone WERE readable by signed-in viewers — the earlier column REVOKE was a no-op against the table-level GRANT; migration `fix_rsa_tickets_raw_pii_column_grants` replaced it with an explicit column grant (verified `has_column_privilege` = false for both). | ✅ live via MCP (table + prune fn + fn v1 + cron 119) · ✅ local source `supabase/functions/rsa-cc-calls-sync/index.ts` · ❌ NOT yet pushed to `vehicle-parts-check` | (1) **Paste `RRR/rsa_design/queries/RSA_CC_Calls_Before_Ticket_30Day.sql` into Metabase card `64d56b96`** (time the run — the old 1-day version took ~23 s, so 30 days is unmeasured; if it nears 140 s the fn's fetch times out). Then run the fn once and check `rsa_cc_calls` row count + heartbeat. (2) Decide which `did` values are RSA lines (7 distinct DIDs seen; 157/167 rows are on …2717) — the query does not filter DID. (3) Push local source via the /tmp clone to `staging`. **v2 (14 Oct, same day, deployed):** query reworked to pair each call with ONE ticket on an operating-hours clock (night 22:00-07:00 IST not counted; day call <=2 op-hours, night call <=5 before its ticket; 'After ticket' follow-ups <=12 op-hours), tags connected/not-connected, `is_trigger_call`, per-ticket call counts + wait; new columns on `rsa_cc_calls` (phase, call_seq, call_period, connected, is_trigger_call, inbound_*_before, night_inbound_before, outbound_calls_before, first_call_time_ist, wait_*_hours, *_hours_before_ticket; old hours_from_ticket/call_timing dropped); `rsa_cc_calls_prune_stale()` removes rows a run did not rewrite. **v3 (14 Oct, deployed):** also tags calls DURING the ticket (creation → resolvedAt; open ticket 24h) and 0-1h / 1-2h / 2-3h AFTER close (`phase` = 'During ticket' / 'After close 0-1h' ...); new columns resolved_time(_ist), inbound_during_ticket, inbound_after_close_0_1h/1_2h/2_3h, outbound_during_after, hours_after_close. Guard needs `call_id` + `inbound_during_ticket`. |
| **`smartflo_calls_raw` + `smartflo-calls-sync` + `rsa_cc_calls_rebuild()` (2026-10-14).** Raw Smartflo calls (one row per Call ID; connected = any leg answered; phone10 not client-readable) from a plain Metabase card (`RRR/rsa_design/queries/RSA_Smartflo_Calls_Raw.sql`, optional Text vars start_date/end_date for backfill) → `smartflo_calls_raw` (rolling 35 days, ~165k rows/30d: whole table is 1.1M rows / 796k calls since 19 Jan, ~80% outbound). Pairing to RSA tickets now runs in Postgres: `rsa_cc_calls_rebuild(30)` (migration `20261014000001_...`) rebuilds `rsa_cc_calls` from `smartflo_calls_raw` + `rsa_tickets_raw` (incl. `alternate_phone`), same rules as the v3 Metabase query. `rsa_did_profile` view shows which DIDs carry RSA traffic. fn v1 deployed via MCP (card id passed in body until set as CARD_ID); **cron 119 (rsa-cc-calls-sync-hourly) UNSCHEDULED** — `rsa-cc-calls-sync` is superseded, left deployed/unscheduled. **LIVE 14 Oct:** card `27babdaa-3cff-4c07-9998-df87afdef037`; 30-day backfill done (155,722 calls, 10 Sep → 14 Oct, 9 chunks of 4 days, 20-44 s each); crons 120 `smartflo-calls-sync-hourly` (:15, last-2-days window) + 121 `rsa-cc-calls-rebuild-hourly` (:30, `select rsa_cc_calls_rebuild(30)`, ~1.6 s, 4,861 rows). Validated vs the Metabase v3 card: 30/31 days identical. Smartflo table lags (a call at 11:33 UTC was missing at 13:32 UTC) — the rolling 2-day re-pull + hourly rebuild self-heals. `rsa_did_profile`: ALL inbound is on one DID 918040802717 (30,948 / 30d, 92% connected; only ~10% of it pairs to an RSA ticket); every other DID is outbound-only, so there is no RSA-only line to filter on. **Recording links (14 Oct, migration `20261014000002_recording_url.sql`):** the raw card query now picks the first http(s) value in the row (column named like 'record' preferred; `recording_col` in the card output shows which) → `smartflo_calls_raw.recording_url` → copied to `rsa_cc_calls.recording_url` by the rebuild (viewer-readable); fn v3. `rsa-cc-calls-sync` (the old function) was DELETED live the same day. **Later 14 Oct:** (a) RSA makes no outbound calls (Vamsee) -> raw feed is INBOUND ONLY: card query HAVING first leg = 'Inbound', fn v5 skips non-inbound, `smartflo_calls_prune()` also deletes non-inbound (migration `20261014000004_inbound_only.sql`); raw table 155,722 -> 36,648 calls; the 180 outbound ticket-linked rows are gone. (b) The link column is literally `"Recording"` (all connected calls have one: 4,717/4,717 in a 2-day pull; Ozonetel S3 mp3 URLs); raw query now reads it directly (the jsonb column scan took 106 s) plus answered_by_agent, call_solution, inbound_queue, conversation_secs (migration `20261014000003_call_details.sql`, fn v4/v5). Needs the FINAL `RSA_Smartflo_Calls_Raw.sql` saved on card 27babdaa, then a 30-day re-backfill (4-day chunks) so older calls get links/agents. **Retention + history (14 Oct, Vamsee: store from June):** `smartflo_calls_raw` now keeps inbound calls from 1 Jun 2026 (migration `20261014000005_retention_from_june.sql`; was rolling 35 days): 159,642 calls loaded (8-day chunks, 21-50 s each), 120,847 connected / 120,845 with a link / all with an agent; `rsa_cc_calls_rebuild(134)` run once = 23,381 rows (6 s) for tickets from 2 Jun; the hourly cron still rebuilds only the last 30 days. By month: 74.9-86.1% of tickets have an inbound call before them, ~2.0 calls on average. Sources up to the recording_url migration pushed to staging (8bec1a0, 14 Oct); migrations 3-6 + fn v6 are LOCAL only until the next push. **Accuracy work (14 Oct, Vamsee's objectives: 98% mapping accuracy; all calls grouped per ticket; counts before / during / after close):** (1) IVR `skill_name` added (migration 6, fn v6; raw card query updated — Vamsee must re-paste it, then re-backfill from 1 Jun): in a 300-call Sep sample 62% of mapped calls came via `Already_Riding_*`, 28% `Any_Other_help_*`, 8% `Rent_Scooter_*` (candidate RSA marker / false-match flag). (2) The Metabase `public."Call Analysis"` table (113,154 LLM-analysed calls, May-Sep) has NO overlap with our Call IDs (0 matches in any month) — it is not the Sep 1-15 transcript set; transcripts still needed (Call ID or recording file name + text). (3) Before-window at 2 operating hours (Vamsee's rule) would drop only 366 of 14,269 mapped before-calls (all overnight; 6 of 6,956 tickets lose all before-calls) — APPLIED later the same day (see FINAL WINDOWS below); after-close distribution (wall-clock, mapped): 0-1h 958 / 1-2h 660 / 2-3h 483; unmapped from ticket phones: 3-4h 328 / 4-6h 447 / 6-12h 535 / 12-24h 2,001. **Later 14 Oct:** skill_name backfilled for all 159,762 calls (1 Jun -> now), pairing rebuilt (23,397 rows). Skill vs mapping on the FULL set: of 21,828 mapped calls 64.4% Already_Riding, 27.7% Any_Other_help, 6.9% Rent_Scooter (1,509), 1.0% Customer_support (mapped rate 18.7% / 12.8% / 4.3% / 12.2%) — IVR choice is a hint, not a filter. New view `rsa_ticket_calls` (migration 7: one row per ticket, counts before/during/after-close, `timeline` string, `calls` JSON with recording links). **Transcripts:** `public."Call Analysis"` (113,154 rows) = OUTBOUND-call analysis (Activity IDs start 3432/3428/3408…, the outbound ID series; inbound IDs start 18xx/19xx), so no inbound transcripts exist; recordings (Ozonetel S3 mp3, public link) are PURGED after ~3 months (June all dead, July partly, Aug+ alive) — archive/transcribe before expiry. Sep 1-15 audio: 14,607 connected calls = 856 h; mapped connected 2,007 = 129 h (avg 231 s). Optimaiz (optimaiz.endlessriver.ai) = LLM API gateway, no speech-to-text. **CORRECTION (Vamsee, same day):** the Call Analysis `Activity ID` = smartflo `Ozonetel UCID` (not Call ID), so the join key is UCID — raw query now selects `ucid` and LEFT JOINs `"Call Analysis"` (latest per Activity ID) -> `smartflo_calls_raw.ucid` + `analysis_*` (issue/secondary category, summary, resolved, language, outcome, sentiment), copied onto `rsa_cc_calls` by the rebuild (migration `20261014000008_ucid_and_call_analysis.sql`, fn v7). Waiting on: Vamsee re-pasting the query into card 27babdaa, then re-backfill 1 Jun -> now and a match-rate check by month. (14 Oct 21:xx IST: the in-Metabase join to "Call Analysis" was saved but FAILS (public card returns invalid-query, instant) -> query simplified to return `ucid` only; the join now runs in Supabase: **`public.call_analysis`** (113,154 rows uploaded from the CSV, 21 May-16 Sep, 41 categories, AI summaries not full transcripts; migration 11) + `smartflo_calls_attach_analysis()` (migration 12; cron 121 now runs attach then rebuild; fn v8 no longer writes analysis_*). **Vamsee must re-paste the simplified RSA_Smartflo_Calls_Raw.sql into card 27babdaa (until then cron 120 syncs fail with an error heartbeat, nothing is written), then I re-backfill 1 Jun -> now to fill ucid.** Vamsee dropped the idea of self-transcribing (14 Oct); analysis summaries/categories are the accuracy proxy.) **FINAL WINDOWS (Vamsee, 14 Oct; migrations 9 + 10, rebuild(134) re-run, 23,169 rows):** BEFORE = call <= 2 OPERATING hours before ticket creation (day and night; night 22:00-07:00 IST does not count; max seen 2.00); DURING = creation -> resolvedAt (open ticket 24 h); AFTER = 3 OPERATING hours after resolvedAt in 0-1h / 1-2h / 2-3h buckets (was wall-clock; now a 9 PM close collects calls to ~10 AM; 2,230 after-close calls vs 2,101). `hours_after_close` stays wall-clock for reference. Accuracy tool: `RRR/rsa_design/mapping_eval/`. **STT research (14 Oct, agent, vendor pages seen 14 Oct):** Sarvam best accuracy bet (₹29-35/h batch; trains on data unless opt-out; no India residency stated for API audio), Azure batch Central India ~$0.18/h, ElevenLabs Scribe ~$0.22/h, self-hosted IndicConformer free (GPU recommended), Whisper weak on Kannada/Telugu; 129 h pilot ≈ ₹4,600 on Sarvam. |
| **`rsa_tickets_raw` + `rsa-raw-sync` (2026-10-14).** New full-column RSA ticket table fed from the revised Metabase card `24810530-de51-4840-8574-f71ac131adc9` (adds rider GPS back, wall-clock AND working-hours 08–20 IST TATs, reopen/status-change counts, latest internal note, feedback rating, action-type log, closer/pickup user, shift). PK = RSA DB ticket `id`; IST columns stored as naive `timestamp` (Z suffix stripped), raw `created_at`/`resolved_at` as timestamptz. RLS: `is_rrr_viewer()` select; `customer_name`/`customer_phone` column-revoked from `authenticated` (service role only). Edge fn v1 (verify_jwt on; cron sends the service bearer): default run = trailing 7 days via `start_date`/`end_date` card params, body `{full:true}` = all rows; if the windowed call returns a non-array (card error) it falls back to a full pull + client filter and logs `mode=window-fallback-full` in `sync_heartbeats`. Cron 117 `rsa-raw-sync-15min` (`*/15`, off-hours guard 00–06 IST in-function) + cron 118 `rsa-raw-sync-nightly-full` (21:30 UTC = 03:00 IST, catches late feedback/notes on old tickets). Backfilled 11,943 rows (9 Mar → 14 Oct 2026, BLR/NCR/HYD/MUM, 68% with GPS). **Does NOT touch `rsa-ticket-sync`/`rsa_tickets_cache`** (warroom, still on the old card `f79c5050`). | ✅ live via MCP (table + fn v1 + crons 117/118) · ✅ local source `supabase/functions/rsa-raw-sync/index.ts` · ✅ source pushed to `vehicle-parts-check` staging 2026-10-14 (byte-identical to deployed v1, sha256 `9cb5a699…`; reaches `main` with the next staging→main PR) · ❌ the table DDL / RLS / column grants and crons 117/118 were applied via MCP and are NOT saved as a migration file in git yet (cron commands carry the service bearer: keep that out of any file) | (1) **Card fix (Vamsee, Metabase):** every windowed call on the revised card returns "An error occurred" (cause not proven; prime suspect is the two `"details"::jsonb ? 'from'` / `? 'to'` predicates, since `?` is a JDBC bind-placeholder character) and the fn falls back to a full pull (~12k rows, 10–40 s) every 15 min. Replace both with `jsonb_exists("details"::jsonb, 'from')` / `jsonb_exists("details"::jsonb, 'to')`; the fn switches to the cheap windowed mode automatically (heartbeat `error_message` goes NULL). (2) Push the local fn source via the /tmp clone to `staging`. **14 Oct (later):** `alternate_phone` column added (card query now also selects `t."alternatePhone"`, source `RRR/rsa_design/queries/RSA_Raw_Tickets_Full.sql`; fn v2 deployed; not client-readable). Fills as rows are re-synced — run `{"full":true}` once after the card is updated. |
| **Bike Status live sync** — new `bike_status_cache` table + `bike-status-sync` edge fn + `bike-status-15min-sync` pg_cron job (every 15 min), sourced from a new Metabase card (`20177d5c-13e8-4597-beec-5945e7630291`) replicating the exact `bike.vehicle_status`/`bike.rental_status` CASE logic from the "Bike Status by City and Hub" dashboard (Active Rental Paid/Not Paid, RFD, OOS, Marked For Recovery, Recovered, PDI, Internal Use, Marketing). Verified matching city ops' live numbers exactly (Gurugram OOS=17, RFD=7). This is DISTINCT from `oos_work_queue` (repair backlog — every bike with an unclosed JC regardless of current status, materially larger count e.g. 41 vs 17 for Gurugram) and `rfd_violations_cache` (RFD validation-check failures, not "bike is currently in RFD status"). New `bike-status.html` page (filterable list, hub/status/reg# filters, JC history drill-down) + new "Bike Status" tile on `index.html` (live Active Rental/RFD/OOS counts) + `maintenance.html` per-bike cards now show a live status badge + current hub (top-right) alongside "Last Serviced" hub (top-left, from last BILLED JC) — previously unlabeled and confusable. | ✅ main (PR #29, 2026-09-26) · ✅ cron job #102 live | — done — |
| **3 conflicting hub values on maintenance.html card (found + fixed 2026-09-28, odo fallback added 2026-09-29) — DL9EV7903 example.** A bike card showed 3 different hubs at once: live status badge (current/deployed hub), "Last Serviced" header (Sheet 9's last Billed JC hub), and JC History table's own newest row hub — all disagreeing. Root-caused to TWO real bugs in `RRR_JC_History_Sync.sql`'s `new_flow` CTE: (1) the 45-day `SYNC_DAYS` cutoff in `jc-history-sync` excluded JCs 45-60 days old (fixed: bumped to 60); (2) `JOIN booking b ON jc.booking_id = b.id` was INNER, silently dropping every manual/HO-initiated job card (no rental booking, e.g. job_card_id 86670 — Billed, 9 line items, 20 Sep 2026, Gurugram) fleet-wide. Fixed by joining `bike` directly via `jc.bike_id`. Also added `billing_category` (A/P/W) column. **`bike_odo`/`service_type`-for-manual-JCs gap CLOSED 2026-09-29**: added a 3-tier `bike_odo` fallback — `COALESCE(NULLIF(jc.bike_odo,0), nbo.starting_odo, bk.current_odo)` (real DMS reading → bike's next booking's `starting_odo` via a new `bike_booking_odo`+LATERAL join → `bike.current_odo` live telemetry, last resort). `bike_booking_odo` also filters `booking.status` to the same 8 real-deployment statuses used by `RRR_Sheet1_RR_Events.sql`'s `bike_first_deployment` (excludes cancelled/expired/never-started bookings, e.g. "created and expired due to non payment", from ever being picked). `service_type` staying NULL for manual JCs remains an accepted gap (no fallback source identified — `dms_api_call_json` is genuinely blank, not derivable). **Two full reloads executed**: first 2026-09-28 (543,230 → 522,884 rows after dedupe), then re-done 2026-09-29 after the odo-fallback logic changed made `bike_odo` drift day-to-day for manual JCs (see natural-key fix below) — final live table 525,748 rows, verified DL9EV7903/JC 86670 now shows Gurugram + real odo (43,233 via tier-2 telemetry fallback, no later booking existed yet). Old tables preserved as `jc_history_old_20260928` and `jc_history_old_20260929`. | ✅ done — repo file, Metabase query (pasted 2026-09-28), edge function, and live table all updated as of the 2026-09-28 reload; **odo-fallback + status-whitelist changes (2026-09-29) are saved in the repo file but NOT YET re-pasted into Metabase** | Still open: (a) UI still doesn't label the 3 hub concepts distinctly — worth adding "Current Hub" / "Last Billed Service Hub" / "Latest JC Activity Hub" labels; (b) both old backup tables safe to drop once the current live table is confirmed stable in FleetPro UI over a few days; (c) paste the 2026-09-29 repo version into the Metabase JC History card (status whitelist on `bike_booking_odo` — low-impact, `starting_odo > 0` already excluded these rows in practice, but makes intent explicit) and let the next `jc-history-sync` run pick it up naturally — no full reload needed for this one, just a normal upsert cycle. |
| **`jc_history` natural key — `bike_odo` removed (found + fixed 2026-09-29).** The unique constraint (`jc_no, item_name, line_type, jc_date, hub_name, bike_id, reg_number, bike_odo, service_type, qty, amount, technician_name, source`) included `bike_odo` — but the new 3-tier odo fallback above makes `bike_odo` drift day-to-day for manual JCs (next-booking odo or live telemetry both change over time), so every sync would INSERT a new row instead of UPDATing the existing one, silently accumulating duplicates. Found 3,699 duplicate groups / 10,910 excess rows already accumulated on the reduced (no-`bike_odo`) key from that day's runs — deduped (kept highest `bike_odo` per group), then dropped `bike_odo` from the constraint (renamed `jc_history_v2_natural_key` → `jc_history_natural_key`, 12 columns). `jc-history-sync` edge function deployed as **v20** with `bike_odo` removed from `CONFLICT_COLS_ARR` to match — the constraint change alone would have broken the next scheduled sync run (`ON CONFLICT` requires an exact matching constraint). | ✅ done (2026-09-29) — constraint fixed, edge function v20 deployed, dedupe applied to both the live table and the subsequent full-reload's `jc_history_v2` (20,461 more excess rows found+removed there, 545,446 → 524,985) | — done — |
| **Sheet 9 — manual JCs excluded from part-replacement history + odo anchor (found + fixed 2026-09-29).** Beyond the `last_jc_odo` fix (below), found the SAME `INNER JOIN booking` pattern in 7 more places: all 5 `part_replacements` UNION branches (post-Jan DMS part-replacement tracking — front/rear brake, tyre, cone set, brake disc, wheel bearing, steering) and `odo_intervals` (feeds the avg-km/day projection). A part actually replaced on a manual JC never registered as replaced at all — Sheet 9 kept tracking km_since/km_remaining from the PRIOR replacement, risking a false Overdue/Due Soon flag on a part that was just changed. Fixed all 7: `bike_id` now sourced from `jc.bike_id` directly (no more inner-joining `booking` for identity); `booking` kept as LEFT JOIN only where genuinely needed (`ended_at_location` for the replaced-at hub). Added a new shared `jc_odo_resolved` CTE (same 3-tier fallback as `RRR_JC_History_Sync.sql`: real reading → next booking's `starting_odo` → `bike.current_odo` live telemetry) resolved once per job_card, referenced by all 5 `part_replacements` branches instead of repeating the LATERAL join 5 times — `odo_at_replacement` for a manual JC now resolves via this fallback instead of showing the part as never-replaced. `bike_booking_odo` (the tier-1 next-booking lookup) also filters `booking.status` to the same 8 real-deployment statuses as `RRR_Sheet1_RR_Events.sql`'s `bike_first_deployment`. | ✅ repo file updated (2026-09-29) | **Not yet pasted into Metabase / synced** — paste the updated `RRR_Sheet9_Vehicle_Check_Flag.sql` into the Metabase Sheet 9 card, then trigger (or wait for) `metabase-sync` to pick it up in `vehicle_parts_check_flag` |
| **`estimated_current_odo` can show a stale/lower value than reality (found + fixed 2026-09-29).** `estimated_current_odo` (the ONLY column `maintenance.html`'s "Current Odometer" stat reads — confirmed via `grep`, single usage at line 872) is a forward-projected estimate (last billed-JC/swap odo + avg-km/day × days elapsed) — it could show a number lower than the bike's own live telemetry reading (`bike.current_odo`) if the projection under-shoots, or lower than a JC/swap anchor in an edge case. Also, `last_jc_odo`'s `JOIN booking` was INNER, silently dropping manual/HO JCs (job_card_id 86670 example) from the anchor entirely — fixed to LEFT JOIN, `bike_id` sourced from `jc.bike_id` directly. Fixed the display value itself: wrapped `estimated_current_odo` in `GREATEST(<existing projection-or-telemetry CASE>, bike.current_odo, last_jc_odo, swap_odo)` so it can never fall below any of its own real anchors — odo only ever increases, so the floor should always hold. Considered adding a separate `bike_current_odo` column first, but confirmed nothing in the UI reads it (only `estimated_current_odo` is wired to the display) — folded the fix into the existing column instead of adding an unused one. Also added a `bike.current_odo`-as-3rd-anchor-tier (used only when a bike has no billed JC and no swap on record at all — previously such bikes were excluded from `current_odo` entirely via `WHERE COALESCE(lj.jc_odo, ls.swap_odo) IS NOT NULL`, vanishing from the whole Component Health Matrix). | ✅ repo file updated (2026-09-29) · ✅ confirmed run clean by Vamsee in Metabase | Same Metabase-paste step as the row above still needed for the manual-JC part-replacement fix — both fixes are in the same file, paste once covers both |
| **`RRR_Sheet1_RR_Events.sql` — manual-JC gaps found, NOT yet fixed, holding per Vamsee's explicit instruction (file is mid-review on a separate unresolved thread — TAT 6-7d gap validation, see below).** Three distinct issues found 2026-09-29 while confirming the same-day odo/JC-history fix pattern also applies here — none fixed yet, Sheet 1 intentionally untouched:
--
--   **(1) `odo_intervals` join bug** (line ~715) — identical `INNER JOIN booking` + `WHERE jc.bike_odo > 0` bug as jc_history/Sheet 9 pre-fix. A manual JC's repair event is invisible to `km_since_last_service`/`odo_at_repair`, the core wear metric driving T2/T3 routing throughout the file. Same 3-tier fallback (real odo → next booking's `starting_odo` → `bike.current_odo`) would apply.
--
--   **(2) `latest_job_card` can never find a manual JC — the real issue, clarified by Vamsee.** Context: when a booking ends (classified intrip-RR or VE/BX from booking fields — `submission_type`, unaffected by this), the system attempts to auto-create a JC via DMS. **If that JC creation fails, the team manually creates a replacement JC** (`HO-xx` job_card_id placeholder pattern, e.g. job_card_id 86670) to actually do and record the work. For Running Repair this manual JC is fine as-is; for Vehicle Exchange, Vamsee noted the manual JC gets created as generic "General Services" rather than preserving VE intent (not a Sheet1 problem since `submission_type` reads booking fields, not JC service-type text — but worth knowing for whatever DOES read JC-level service type, e.g. `jc_history`). **The core gap**: a manual JC has NO `booking_id` at all (confirmed via 86670) — so `latest_job_card`'s `DISTINCT ON (booking_id) ... ORDER BY created_at DESC` can never select it. If the ORIGINAL failed JC attempt DID leave a `job_card` row (status stuck, never reaching `job_card_status_log` — i.e. `current_dms_status IS NULL`, same signal from issue 3 below), that dead row is what `latest_job_card` picks — the booking's Sheet1 row shows the FAILED JC's (empty/stale) parts, billing, damage-fee validation — never the real work done on the manual replacement.
--       **Vamsee's proposed structure — parent/child JC linking**: treat the original (failed, "status not created") JC as the *parent* and the manual JC as the *child*. To find the child: search for a manual JC (`HO-xx` pattern) on the SAME bike, created AFTER the parent JC/booking, bounded by the bike's NEXT booking so it doesn't grab an unrelated later JC on a busy bike — then attribute the child's real line items/billing/status back to the parent's booking row. **Exact boundary NOT yet settled** — Vamsee's first instinct was the next booking's `start_time` as the cutoff, but then flagged that this needs looking at a few real cases first (e.g. does the manual JC always land before the next booking starts, or can ops create it later/does the next booking's *creation* time matter more than its *start* time) before locking in the window logic. **Explicitly parked — solve later, with real examples in hand, not guessed.** Not yet built.
--
--   **(3) `job_card_status` (raw `job_card.status` text) used as a "real JC" proxy in 4 places** (lines 1478, 1936, 1955, 2259) — `job_card.status` is frozen at creation, always reads "draft job card created" regardless of what happens after (confirmed with Vamsee). A genuinely dead/failed JC never gets a row in `job_card_status_log` at all — so `current_dms_status IS NULL` (built from that log, already correct elsewhere in this file, lines 379-403) is the right "no real JC" signal, not the frozen status text. Proposed fix: swap `job_card_status = / != 'draft job card created'` → `current_dms_status IS NOT NULL / IS NULL` in all 4 spots. This signal (`current_dms_status IS NULL`) is ALSO the trigger condition for issue (2)'s parent/child search.
-- | ⏳ found, documented, NOT fixed — Sheet 1 is intentionally untouched pending the separate TAT-6-7d-gap review (see `Sheet1_gap_diagnostic` context below) | When ready to reopen `RRR_Sheet1_RR_Events.sql`: (a) apply the 3-tier odo fallback to `odo_intervals`; (b) build the parent/child manual-JC linking (trigger: `current_dms_status IS NULL` on the booking's own JC → search same-bike `HO-xx` JCs created after this booking but before the bike's next valid booking → attribute child's data to parent); (c) swap the 4 `job_card_status` checks to `current_dms_status`; (d) quantify row-level impact of all three before committing, same validation discipline as the TAT-gap thread. |
| **`jc-history-sync` edge function — batch upsert collision on duplicate rows (found + fixed 2026-09-28).** Widening the Metabase query's window to 60 days surfaced genuine duplicate line-item rows (same values across all 13 natural-key columns) within a single upsert batch — Postgres error `ON CONFLICT DO UPDATE command cannot affect row a second time` (a single statement can't apply the same conflict-key update twice). Fixed by deduping each 300-row batch client-side (keep first occurrence per natural key) before upserting — `v19` deployed 2026-09-28, reports a `deduped` count in its response. Separately, a full 60-day run can still hit the platform's 150s idle-timeout ceiling since it went from 45→60 days of data; not yet resolved — partial progress is preserved (upsert commits per-batch) so retrying picks up roughly where it left off, but isn't guaranteed to finish in one call. | ✅ v19 deployed (dedupe fix) · ⏳ idle-timeout on full 60-day runs not resolved | If repeated timeouts become a problem, consider larger batch size (fewer round-trips) or splitting the sync into date-range chunks server-side. |
|------|--------|---------------|
| Sheet 9 v2.12–v2.14 — v2.12: Due Soon band widened from ±10% to ±20% of threshold (Overdue fires past threshold×1.2, was ×1.1). v2.13: **thresholds switched from design-life spec to OBSERVED fleet-average part life** per Vamsee ("we are seeing higher health" than design specs implied) — Cone Set 16,717 \| Front Brake Disc 21,796 \| Front Brake Pad 14,175 \| Front Brake Shoe 15,750 \| Front Tyre 17,505 \| Front Wheel Bearing 19,217 \| Front/Rear Tyre combined 22,620 \| Rear Brake Disc 25,233 \| Rear Brake Pad 14,123 \| Rear Brake Shoe 12,088 \| Rear Tyre 21,146 \| Rear Wheel Bearing 20,084 (source: Vamsee's "Observed part life vs design life" tracker, real replacement-to-replacement km, not right-censored). v2.14: `last_jc_odo`/`days_since_last_jc` was joining plain `job_card` with no status filter — an OPEN/in-progress JC (created the instant a bike arrives, before any billing) counted as "last service" immediately, showing false "0 days since JC." Found via DL9SCU9214 (Vamsee: "last jc should be on billed not on just created"). Fixed by requiring the JC to have reached `'Billed'` in `job_card_status_log`, matching `RRR_Hub_Health_Scorecard.sql`/`RRR_HO_Approval_Bypass.sql`. | ✅ Pasted into Metabase + synced (v2.13, 2026-09-26) · ✅ repo file updated (v2.12–v2.14) | **v2.14 not yet pasted into Metabase** — only v2.12/v2.13 confirmed live |
| `maintenance.html` — `THRESH_DISC`/`THRESH_DRUM` switched to match Sheet 9 v2.13's observed-average values (was design-life, then briefly a different design-life slide's values — see two rows below); per-bike tile relabeled "Design"→"Fleet Avg" column since these are no longer spec values. Also removed a short-lived "Design vs Observed — Fleet Average" summary table + its RPC (`get_part_design_vs_actual`, dropped from DB) that blended Disc+Drum models into one wrong number per part — superseded by the correct disc/drum-split values now baked into the per-bike tile thresholds directly. | ✅ main (PR #26 thresholds, PR #27 relabel, 2026-09-26) | — done — |
| **Manual Supabase push incident (2026-09-26)** — `metabase-sync` has been crashing on "CPU Time exceeded" every hourly run since ~2026-09-25 14:00 UTC (gets through ~26-27 of ~29 batches then dies before logging a heartbeat or reaching the stale-row cleanup) — root cause NOT yet fixed, only worked around. To unblock verification of the v2.13 threshold change, ran a one-off manual push: fetched Sheet 9's CSV directly via Postgres's `http` extension (`extensions.http_get`, no Deno/CPU cap) and upserted all 14,322 rows via `mcp__supabase__execute_sql`. **First attempt had a column-index bug** — skipped `last_known_odo`/`odo_as_of_date` (CSV columns 67-68) when mapping to DB fields, shifting every column after `estimated_current_odo` by one — corrupted `last_jc_odo`, `days_since_last_jc`, `current_status`, `deployed_hub`, `last_service_hub` for **all 14,322 rows** (surfaced as bikes showing "37207 days since JC" etc.). Re-ran with corrected mapping; verified 0 bikes with `days_since_last_jc > 1000` fleet-wide after the fix. | ✅ DB corrected (2026-09-26) | `metabase-sync`'s underlying CPU-time crash is still unfixed — will keep failing hourly until addressed; not urgent since manual re-push is a known workaround |
| `index.html` — every tile on the Fleet Operations Hub now spans full width in a single horizontal row (icon/title/desc left, stats/badges middle, button right), matching Deployment Queue's existing layout — replaces the old 2-column + occasional full-width mix. | ✅ main (PR #27, 2026-09-26) | — done — |
| `maintenance.html` — PM component thresholds updated per revised part design-life data (slide): Disc brake pad 6k/6k→10k/12k, tyre f 12k→15k, cone set 12k→10k, brake disc 18k/18k→20k/25k, wheel bearing 12k/12k→6k/9k (front/rear now split, was shared). Drum brake shoe 10k/10k→12k/14k, tyre 12k/10k→15k/15k, cone set 12k→10k, wheel bearing 12k/12k→6k/9k. Also fixed a latent bug — legacy (pre-split) fallback path referenced an undefined `THRESH` object (ReferenceError risk); added `THRESH={brake:12000, tyre:15000}`. Audited Sheet 9's tracked `part_group`s vs the UI — `steering` is tracked in Sheet 9 but intentionally not surfaced in the Component Health Matrix (Vamsee: leave out); `side_stand_spring` also intentionally UI-only-removed (prior session decision) but still tracked in Sheet 9. | ✅ main (PR #24, 2026-09-26) | — done — |
| `fw-map.html` — speedo rider-phone lookup real fix: earlier fix (PR #22) filtered `bike_rider_cache` on `reg_number`, which doesn't exist on that table (only `chassis_number`) — PostgREST silently failed, every phone stayed blank. Switched to `chassis_number`. | ✅ main (PR #24, 2026-09-26) | — done — |
| `metabase-sync` v39 — **incident fix**: a bad Metabase response with 0 parsed rows fell through to `cleanup_stale_vpcf_rows({seen_ids: []})`, whose `WHERE bike_id <> ALL(seen_ids)` is vacuously true for an empty array — wiped all 14,293 `vehicle_parts_check_flag` rows on 2026-09-24 13:00 UTC while still logging `status:'success'`. v39 hard-fails (throws, no cleanup call) whenever 0 rows are parsed. ~8min downtime, fully restored via manual re-trigger. | ✅ MCP-deployed (v39, 2026-09-24) | **Not yet in git** — `supabase/functions/metabase-sync/index.ts` source needs to be updated to match live v39 before next git-based deploy of this function, or v38 will regress the fix |
| Sheet 9 (`RRR_Sheet9_Vehicle_Check_Flag.sql`) v2.9–v2.11 — v2.9: combined-tyre labour match was exact-string (`'FRONT TYRE 12 INCH'`), missed suffixed variants like `'FRONT TYRE 12 INCH REPLACEMENT'` (89 rows) — switched to `ILIKE`. v2.10: brake disc status only matched one casing per source (`'FRONT BRAKE DISC'` vs `'Front Brake Disc'`) — switched to `UPPER(...)` match; added missing steering variants (`Steering Pipe Bottom Inner Ring`, `M25 Washer For Steering Lock`). v2.11: **root cause of the tyre bug** — `latest_per_part`'s `DISTINCT ON (bike_id, part_name)` collapsed the always-emitted `'tyre'` fallback row and the labour/wear-resolved `'front_tyre'`/`'rear_tyre'` row (same JC, same part_name) into one, silently dropping whichever lost the tie-break. Fixed by adding `part_group` to the `DISTINCT ON` key. | ✅ Pasted into Metabase + synced (2026-09-24) · ✅ repo file updated | — done — |
| `RRR_JC_History_Sync.sql` — `new_flow`'s `technician_name` was hardcoded `NULL::text`; added `billed_technician` CTE (latest `job_card_status_log` row per JC where `new_status='Billed'`), same pattern as 5+ other RRR queries | ✅ Pasted into Metabase (2026-09-24) · ✅ repo file updated · ✅ historical backfill done (2026-09-26) | — done — |
| **`RRR_JC_History_Sync.sql` — A/P/W billing category missing for New Flow rows (found + fixed 2026-09-28).** `jc_history.service_type` is NOT the billing code — for `old_dms` rows it's `dms_cat` (real A/P/W), but for `new_flow` rows it's `jc.dms_api_call_json->>'iServType'` (e.g. "RUNNING REPAIR", "GENERAL SERVICES (REPOSSESSED)") — a different field entirely, so New Flow rows had no billing category at all. Confirmed via `jc_history` query on DL9EV7638/DL9SCV2434: Old DMS rows show `service_type` values 'A'/'P'; New Flow rows only show service-type text. Also confirmed `jc_no`+`item_name` is NOT a safe join key for a manual VLOOKUP workaround — found 60+ genuine duplicate-item-name rows within the same JC across just 41 bikes. Fixed properly: added a new dedicated `billing_category` column to both branches (`fi.dms_cat` for New Flow, `dms_cat` for Old DMS) in `RRR_JC_History_Sync.sql`, added matching `billing_category varchar` column to Supabase `jc_history` table. | ✅ repo file updated (2026-09-28) · ✅ `jc_history.billing_category` column added in Supabase | **Not yet pasted into Metabase** — paste updated query into the JC History Metabase card, then re-run `jc_history` sync so `billing_category` actually populates for New Flow rows |
| **`jc_history.technician_name` backfill (2026-09-26)** — the 765,195 NULL rows flagged above were fixed. Built a `jc_no → technician_name` lookup (94,056 rows) directly from the live Metabase card (`a2c3e48b`), staged it via a temp table + REST upsert (avoided a risky single 800k-row `http_get`/delete+reload), then ran a guarded `UPDATE` (skips any row that would collide with an already-correct duplicate on the `jc_history_natural_key` constraint). Result: 361,644 rows backfilled with real names; 401,897 rows turned out to be exact pre-fix duplicate rows (same JC/item/date/etc., differing only in the NULL technician) sitting alongside an already-correct row — deleted per Vamsee's approval after confirming the exact count first; 1,654 rows remain genuinely unmatched (JC not in the current Metabase lookup). Verified end-to-end on UP32QC5580 (screenshot showed `--` for 10 rows, now shows `CHINTOO - ROHINI`). No new columns/logic — pure data correction. | ✅ done (2026-09-26) | — done — |
| `maintenance.html` — Component Health Matrix now only renders Overdue/Due Soon part tiles (OK and No Data tiles hidden entirely); shows "✓ No parts need attention" when a bike has none; removed "Deployed Hub / Last Service Hub" line from bike card header; Firmware/IoT tags (DIU Check/IoT Glue/MCU FW 60A) now always show all 3, with null values rendering green "N/A" instead of being hidden | ✅ main (PR #24, 2026-09-26) | — done — |
| `index.html` — PM tile Overdue/Due Soon/No Issue labels show km-equivalent in brackets (100km/day proxy: 60d=6000km, 45d=4500km, display-only, thresholds still days-based); `maintenance.html` Parts sync-time now reads `sync_heartbeats` instead of `vehicle_parts_check_flag.created_at` (which freezes once every bike row exists) | ✅ main (PR #21, 2026-09-24) | — done — |
| `sync-incentive-data` v22 — techName always uses legacyNameMap (DMS name → `incentive_technicians.name_normalized`); `empIdByNormalized` fallback added; fixes name-variant merge split that caused missing earners in payouts | ✅ MCP-deployed (v22, 2026-09-24) · ✅ git (88fe93d, staging, 2026-09-24) | Promote to main via PR |
| `incentive_jc_log` backfill — `technician_name` corrected for all historical rows using `incentive_technicians.name_in_system` → `name_normalized` mapping; ~5k+ rows updated; weeks Aug 17/24/31, Sep 07 rebuilt and verified against GSheet | ✅ DB (2026-09-24) | — done — |
| `sync-incentive-technicians` edge fn — daily 6 AM IST cron; fetches Technician Nomenclature Map sheet (gid=572681529) → delete+reinsert `incentive_technicians` | ✅ MCP-deployed (v1, 2026-09-18) · ✅ cron job #95 | Push source to staging |
| `docs/EDGE-FUNCTION-REGISTRY.md` — full edge function registry with Metabase card UUIDs, cron schedules, source types; "Actual Metabase Query Link" column left blank for Vamsee to backfill | ✅ git (46c6976, staging, 2026-09-17) | Backfill Metabase query links; promote to main via PR |
| `jc-failure-alert` v14 — FIXED_CC now DB-driven (`jc_alert_recipients` table); added `machannagari.prakash@bounceshare.com`; hub CC still dynamic via `hub_contacts` | ✅ MCP-deployed (v14, 2026-09-18) · ✅ DB (`jc_alert_recipients` 6 rows) | Push source to staging; merge PR #12 |
| `indofast_top_stations` lat/lng seed — all 46 rows populated (was 10); fw-map now shows top 10 by `total_bikes_visited` (was all 46); column-name fix `avg_→total_bikes_visited` | ✅ DB updated · ✅ main (57e3ed6, 2026-09-02) | — done — |
| `jc-failure-alert` v9 — hub CC lookup switched to `hub_name` (was `hub_id`); all 15 hub HM/SM emails populated in `hub_contacts` via Apps Script (2026-09-13); `hub_contacts` migration + Apps Script sync (`docs/sync-hub-contacts.gs`) | ✅ DB (hub_contacts 18 rows, emails populated) · ✅ MCP-deployed (v9, 2026-09-13) · ✅ git (staging) | Apps Script runs manually on demand (no daily trigger) |
| `jc-failure-alert` v6 | ✅ git (8099932, 2026-08-01) · ✅ MCP-deployed | — done — |
| `jc-history-sync` v12 | ✅ git (8099932, 2026-08-01) · ✅ MCP-deployed | — done — |
| `sync-hr-employees` | ✅ git (bd65cfb) · ✅ MCP-deployed (v15, 2026-08-21) | — done — |
| `zone-cluster` + `recovery-blocked-sync` | ✅ code · ✅ MCP-deployed (v12/v7, 2026-08-14) | — done — |
| `rsa_tickets_cache` realtime | ✅ live via MCP · ✅ git (de16d6c migration) | — done — |
| PR #6 — sidebar CSS + pin-btn (rfd-check, rsa, trace-hunter) | ✅ git (18a8576, 2026-08-18) | — done — |
| `incentive.html` analytics dummy-name filter | ✅ git (18a8576, 2026-08-18) | — done — |
| PR #7 — docs update + `deployment.html` model_id=4 → High Speed fix | ✅ git (270ea80, 2026-08-18) | — done — |
| `incentive.html` analytics freelancer toggle (default all-staff, btn excludes dummies) | ✅ git (ce71496, 2026-08-18) | — done — |
| `deployment.html` column filters missing bike_model_id (model_id=4 stayed in LS) | ✅ git (63b1eb1, 2026-08-19) | — done — |
| `rsa-tech.html` sidebar pin CSS + `admin-permissions.html` clear secret on sign-out | ✅ git (54b8a36, 2026-08-19) | — done — |
| PR #9 — rsa.html 4 new techs; deployment.html dead code; fw-map.html city toggle + Indofast nav/refresh; admin-permissions.html RPC gate restored; trace-ho.html pin CSS; docs/BUG-TRACKER.md + COWORK-PRIMER.md | ✅ main (b0d71a1, 2026-08-31) | — done — |
| CARTO → OSM tile switch (fw-map.html, rsa.html, trace-ho.html, rsa-tech.html) — CARTO started requiring API key, maps showing watermark | ✅ main (261c9f5, 2026-08-31) | — done — |

**H4 summary (2026-07-26):** `dms_api_call_json` (JSON with embedded newlines/commas) broke the old regex/line-split CSV parser → `intrip` mapped to `undefined`. Fixed with RFC 4180 compliant `parseCSV`. Labels: `intrip=true` → "🔴 RUNNING REPAIR", `false` → "GENERAL SERVICES (Repossessed)".

**H5 summary (2026-07-26):** Metabase card grew to 372k rows / 46MB → edge fn OOM (`WORKER_RESOURCE_LIMIT`). v12: streaming reader + 90-day incremental delete/reinsert. Metabase card `a2c3e48b` updated to filter last 90 days. Full seed of 372,053 rows done from bash (2025-04-01 → 2026-07-24). Crons: job 21 (every 2h) + job 41 (every 3h) maintain rolling 90-day window.

---

## Security Constraints

- **PAT**: Never store in any committed file. Inline to git clone URL only, then discard.
- **Login key**: `Hatric1@3` — Supabase env only, never in code
- **ARCHIVE_CRON_SECRET**: In Supabase vault + edge fn secrets only, never in git
- **Supabase anon key**: Safe to commit (it's public-facing by design)

## Map Tiles (all map pages)

CARTO's `basemaps.cartocdn.com` endpoint started requiring an API key (returns a watermarked
"API KEY REQUIRED" tile without one) — switched all 4 map pages (`fw-map.html`, `rsa.html`,
`trace-ho.html`, `rsa-tech.html`) to OpenStreetMap's standard tile server on 2026-08-31.

```js
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
  subdomains: 'abc'
}).addTo(map);
```

## Incentive Payout Verification (before processing any week)

**Root cause of past discrepancies (fixed 2026-09-24):** `sync-incentive-data` v21 and earlier used `normalizedName` as `techName` when `employee_id` was resolved — bypassing `legacyNameMap`. This caused raw-name variants of the same person (e.g. "MANIKANDAN BANASWADI" + "MANI BASASAWADI") to produce different `technician_name` values in jc_log → rebuild's `merged` CTE couldn't collapse them → split counts, missing earners.

**Fix (v22, 2026-09-24):** `techName` now ALWAYS uses `legacyNameMap[rawName]` (DMS name → `incentive_technicians.name_normalized`) regardless of employee_id. The `merged` CTE groups by `tech_name` as a secondary pass — so all variants of the same person collapse automatically once they share the same display name.

**Merge key:** `technician_name` (display name from `incentive_technicians.name_normalized`) — NOT `employee_id`. The rebuild's GROUP BY is `COALESCE(employee_id, technician_name)` + secondary `GROUP BY tech_name`. Adding a new technician's raw DMS names to `incentive_technicians.name_in_system` is sufficient for correct grouping.

**Pre-payout checklist:**
1. `SELECT week_start, tech_name, eligible_jcs, payout_amount FROM incentive_weekly_stats WHERE week_start = '<date>' AND payout_amount > 0 ORDER BY payout_amount DESC;`
2. Compare earner count + total payout against GSheet Dashboard (Metabase card `9a4c0477-92b1-450d-93b2-6b4ccd1e3473`)
3. Any missing earner → check jc_log for their raw name variants → if not in `incentive_technicians.name_in_system`, add them → backfill jc_log + rebuild
4. Completed weeks are auto-frozen by Thursday noon cron (`freeze_completed_weeks`). Unfreeze to rebuild: `UPDATE incentive_weekly_stats SET is_frozen=false WHERE week_start='<date>';`

## jc-failure-alert — Recipient Management

**FIXED_CC is DB-driven** (since v14, 2026-09-18). To add or remove a global recipient — no code change, no deploy, no git push:

```sql
-- Add
insert into jc_alert_recipients (email) values ('name@bounceshare.com');

-- Remove (soft-delete)
update jc_alert_recipients set active = false where email = 'name@bounceshare.com';
```

**Hub-specific CC** (HM/SM of the affected hub) comes from `hub_contacts` table — also DB-driven, no code needed. `niranjan.tn` and `hemanth.k` are in `hub_contacts` (their specific hubs), not in `jc_alert_recipients`.

Current `jc_alert_recipients` (active): shivani.vavilapalli, nithish, mohithml, uppu.mubarak, vishnu.rc, machannagari.prakash — all `@bounceshare.com`.

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
