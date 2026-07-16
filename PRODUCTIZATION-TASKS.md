# Fleetpro — Productization Task Tracker
*Last updated: 2026-07-17 (session 28 cont. — W6 attendance lag ops instruction drafted; IA8 sized as audit-harden job (loader is external GAS, not a rebuild). All hotfixes 900d95b/1eb7b71/c05aaab + IA9 aba0e40 recorded. Also 2026-07-16 maintenance.html: Firmware/IoT status tags + JC-history bar-into-hero + item wrap (PM1–PM3, verify+pushed & live). Prior: sync-hr-employees v11 pending MCP deploy)*

Legend: ⬜ TODO · 🔄 IN PROGRESS · ✅ DONE · ⏸ BLOCKED

## Incentive Analytics (session 26 — 2026-07-09)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| IA1 | Metric-1 impact dashboard (JC count level) | ✅ | `Bounce/RRR/Incentive_Metric1_JCperTech.html` — snapshot (data thru Jul 8), L0 pooled JC/tech/day w/ intrip-EndTrip split + total-JC line + W6 projection, L1 void-quality (W1 excluded — flags under-captured) + cohort, L2 city/hub. Corrected: launch=Jun 23, W3 retro-paid, Void%=voids÷billed, ROI=₹/(ΔJPT×tech-days). Local file, no deploy. |
| IA2 | Analytics tab in v8/incentive.html (LIVE data) | ✅ LIVE | Built + **pushed 2026-07-09 (commit 5b16277)**. Superadmin/incentive-admin gated; live fetch from `incentive_weekly_stats` + `hub_productivity_daily`. ⚠️ Verify on live tab: if yellow banner shows, run `CREATE POLICY "auth read" ON hub_productivity_daily FOR SELECT TO authenticated USING (true);` **2026-07-16 (commit 900d95b): fixed pooled JC/tech/day** — `anPooled` was dividing full-week JCs by only the attendance days synced to `hub_productivity_daily` (W6 had 2/7 → jpt showed 23.04). Now projects tech-days = (Σ per-hub avg techs/day) × days-in-week (matches reference `buildChart0`); W6 → 6.58. Added "N/7 att" label when attendance incomplete. **Drill-down field hotfix (commit 1eb7b71):** modal queries `technician_name` (normalized) not `technician_name_raw` (was 0 rows). **Drill-down IST + chronic badge (commit c05aaab):** billed/comeback times shown MM/DD HH:MM UTC→IST; `weight≥2` rows get amber "×N chronic" badge + row bg. |
| IA5 | Freeze structural fix (rebuild-before-freeze) | ✅ LIVE + git-synced | 2026-07-09 applied live; `freeze_completed_weeks()` rebuilds via `rebuild_incentive_weekly_stats()` FIRST then locks — a week can't freeze on stale data (root cause of payout/sheet void gaps). **2026-07-15: migration `20260715000001_freeze_rebuild_first.sql` pushed (commit 2c32688).** W3/W4/W5 re-corrected & re-frozen (W5 voids 150→153). |
| IA6 | SSOT name-mapping (sheet → DB) | ✅ one-time · ✅ recurring | 2026-07-09. Master sheet gid 572681529 = single source of truth. 92 mappings upserted to `jc_name_aliases`; jc_log re-stamped; rebuild ran; Venkatesh cross-wiring fixed. Coverage 12,856→13,147 stamped. **2026-07-15: Recurring sync built + deployed** — `sync-hr-employees` v7 (ACTIVE, confirmed via MCP + commit 88cda84) adds block 3: normalizeJcName(jcRaw)→employee_id upserted to `jc_name_aliases` daily at 00:00 IST (pg_cron job 36). FK-safe: skips empIds not in hr_employees. Verify: after first cron fire check `jc_name_aliases` for `created_by='sync'` rows. ~10 techs still need emp_ids from hub managers (BANASWADI SOREI top priority). **2026-07-15: v8 dedup fix git-synced (commit 9e1df8d), then superseded by v11.** **v11 (commit bd65cfb) — Nomenclature Map (gid 572681529) is now the SINGLE master; old HR sheet dropped.** One run upserts `incentive_technicians` + `jc_name_aliases` + `hr_employees` (employee_name = sheet's Normalized Name); empId guard `/^[A-Z]+[0-9]+$/`, email guard rejects `'-'`/malformed, Map dedup, FK `jc_name_aliases.employee_id→hr_employees` dropped (applied in DB). DB cleanup applied manually (spurious rows + bad emails removed; backup `incentive_technicians_bkp_20260715`, 117 rows). ⚠️ **edge fn source-of-record only — live still v7 until MCP deploy of v11.** Leaderboard (incentive.html, same commit) shows normalized names via `jc_name_aliases→hr_employees.employee_name` (LIVE via Pages; falls back to raw until v11 populates hr_employees). |
| IA7 | Invites to non-logged-in techs | ⏸ PARKED | 23 real techs (excl. superadmin + 1 internal) invited Jun 27, never logged in. Rich English Resend invite drafted + approved. Blocked on Resend API key — user handling later. |
| IA3 | Metric 2 — JC Labour Time tab | ⏸ | BLOCKED: needs per-JC labour minutes from DMS + attendance hours (ops sheet logs headcount only). |
| IA4 | Hyderabad attendance backfill | ⬜ | Ops to fill Fathe nagar (Jun 1–28) + add Miyapur to `hub_productivity_daily` — both hubs invisible in JC/tech/day denominator. |
| IA9 | Active-technicians day-on-day chart | ✅ LIVE (commit aba0e40, 2026-07-16) | New L0 chart in Analytics tab: `technician_available` (hub_productivity_daily) summed across hubs per day, city-filtered, thin daily line + bold 7-day trailing avg. Missing attendance days = line-break gaps (spanGaps:false), never fake zeros. Built by Claude Code directly (not Cowork). Pairs with pooled JC/tech/day to separate headcount dilution from real productivity gain. Inherits the same attendance-lag caveat as IA8 (gaps until the feed is complete). |
| IA8 | Harden attendance pipeline (hub_productivity_daily) | ⬜ NEW (2026-07-16) | **Root cause of chronic partial weeks** (W6 = 2/7 days; W4/W5 stuck at 6/7 even weeks later). Loader EXISTS: per migration `20260708000002` table comment, **`oos-productivity-sync` GAS loads OOS sheet → `hub_productivity_daily` daily @ 9:30 AM IST** ("tab date = data date + 1 day"). That GAS is NOT mirrored in this repo (Apps Script lives in Google); `RRR/Productivity_Consolidator.gs` builds the `MASTER_Productivity` tab, and `RRR_MetabaseSync_v2.gs` has `supabaseUpsert()` but only for incentive tables, not productivity. So the gap is upstream/silent-failure, not a missing loader. Durable fix = **audit + harden the existing GAS**: (1) confirm its time trigger is installed & firing (execution log); (2) determine whether it reads `MASTER_Productivity` or the daily tabs (needs GAS source); (3) add failure/empty-data alerting (silent skip → invisible "N/7 att"); (4) upstream — reduce manual daily-tab data entry (form / rolling sheet). Schema: `hub_productivity_daily(date, hub_name, technician_available numeric(4,1), …)` UNIQUE(date,hub_name). **BLOCKED until the `oos-productivity-sync` Apps Script source + trigger config are provided.** **Immediate (ops, no code):** fill W6 daily tabs (6–12 Jul) + re-run consolidator → next 9:30 AM sync loads them → W6 becomes measured. |

---

## Preventive Maintenance (v8/maintenance.html)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| PM1 | Firmware / IoT status tags per vehicle card | ✅ LIVE (2026-07-16) | `fwTag()` pills for DIU Check / IoT Glue / MCU FW (60A): amber "⚠ Pending" / green "✓ Done / N/A" under a "Firmware / IoT" sub-header (card body, between parts and flags). `hasFw` gate hides the block when no FW value; `false`="Done / N/A" (so an absent pill never implies pending). Cowork-built, Claude Code verify+push (commits d66afa0, a93703c). |
| PM2 | JC History sync bar merged into hero | ✅ LIVE (2026-07-16) | Data-as-of + Next-run + "↺ Sync All" moved from a floating white bar into a subtle line inside the dark hero (original element IDs kept, so `syncAllJC()`/sync-status JS unchanged). Cowork-built, Claude Code push (commit 8d60c19). |
| PM3 | JC History item-column full-name wrap | ✅ LIVE (2026-07-16) | Item cell wraps (`white-space:normal;150–240px`) instead of ellipsis-truncating; long part names readable without hover. Overrides `.jc-tbl td{white-space:nowrap}`; table still h-scrolls via `.jc-wrap`. Commit 3c0b3b0. |

---

## Deployment Queue (session 18 — 2026-06-22)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| DQ1 | Blocked bikes in deployment_queue_cache with real scores | ✅ | Metabase Q1 fea85b30 updated; COALESCE on fifo/allotment scores |
| DQ2 | Pending bookings cache excludes renewals + test bikes | ✅ | `AND b.id = b.first_booking` + test reg filter |
| DQ3 | Allocated bikes show real guardrail in kanban | ✅ | commit ef7ae05; small blue Allocated tag alongside OK/STARVATION/OVERUSE |
| DQ4 | Swap suggestion uses real cached score | ✅ | commit fe61f4f; pipelineBikes excludes blocked; computeRowStatus uses assigned_reg lookup |
| DQ5 | All Hubs dropdown + hub tag on cards | ✅ | commit ef7ae05; localStorage remembers hub |
| DQ6 | 5-min auto-refresh + tab visibility pause | ✅ | setInterval inside loadQueue(); visibilitychange listener |
| DQ7 | computeBikeTier dead code removal | ⬜ | Minor cleanup; function has no callers since session 18 |

---

## Performance & Infrastructure (session 13)

| # | Task | Status | Notes |
|---|------|--------|-------|
| P1 | Remove Supabase Realtime `postgres_changes` → Broadcast pub/sub | ✅ | rsa.html + rsa-ticket-sync v19; zero WAL polling |
| P2 | Add 15-min idle guard on rsa.html + fw-map.html | ✅ | Stops polling when tabs left open overnight |
| P3 | Add off-hours guard to rsa-ticket-sync (midnight–6am IST skip) | ✅ | rsa-ticket-sync v19; saves ~180 cron runs/day |
| P4 | VACUUM rsa_tickets_cache + weekly cleanup-cron-history job | ✅ | Dead tuples 17.3% → 0%; cron.job_run_details auto-trims |
| P5 | Drop `rsa_ticket_locations_old` + `rsa_team_locations_old` | ✅ | migration 20260614000001; freed 3.7MB buffer cache |
| P6 | Investigate services loaded in RAM — optimize or drop what's unused | ✅ | PostGIS dropped (~80MB); pg_stat_statements dropped (~10MB); 7 remaining services are Supabase-managed, can't be removed |
| P7 | Upgrade compute Micro → Small (2 GB RAM) | ⬜ | BLOCKED: budget. Costs $5/month extra. Fixes red dot permanently |

---

## Hotfixes (production issues fixed outside phase order)

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| H1 | rsa-ticket-sync cron (job 13) dead since June 9 — over-escaped headers | ✅ | Recreated as job 17 with clean escaping. First success 2026-06-12 20:10 UTC |
| H2 | queue.html Est. Time showed 30m for every row | ✅ | 2026-06-19, commit `91d39e1` (live). `estMins` read unselected `labour_mins` + hardcoded `+30`; now renders `estimated_mins` as-is. See Fleetpro-context.md §2026-06-19 |
| H3 | recovery-ticket-sync creating 0 tickets + T&H heartbeats never recorded | ✅ code · ⏸ deploy | 2026-07-01. Q1 numeric `user_id` inserted into a uuid column → every batch insert failed (0 new tickets); fixed via `uuidOrNull`→null. `sync_heartbeats.status` CHECK allows only success/failure — recovery-ticket-sync/zone-cluster/recovery-blocked-sync were writing ok/warn/error (0 heartbeats). recovery-ticket-sync deployed; zone-cluster + recovery-blocked-sync **pending MCP redeploy**. See Fleetpro-context.md §2026-07-01 |

---

## Admin Tools

Superadmin-only operational tooling. Sits with Manage Technicians + Permissions in the
sidebar's **Admin** section.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| A1 | Manual JC Approval Check (`jc-approval.html`) | ✅ live · ⚠️ context buckets pending deploy | Search a vehicle → automated verdict (T0–T6) on whether to approve a manual draft-JC creation request. Replaces manual manager review. **2026-06-23**: extended 5 → 8 lookup sections — added Booking History / Ops Log / JC Status Log context buckets + In-Trip (RR) flag + JC Hub + amber hub-mismatch warning. Migration `20260623000001` applied (3 tables + `intrip`/`jc_hub_name`). Context sync split into 3 single-table fns (`jc-booking-sync`/`jc-ops-sync`/`jc-status-log-sync`) after the combined `jc-context-sync` timed out. ⚠️ 3 fns pushed to git, **pending MCP deploy + staggered crons + drop of old `jc-context-sync` cron (job 28)**; `jc-approval-sync` redeploy + jc-approval card re-publish needed for `Intrip`/`JC Hub Name` to populate. |
| A2 | Technician Incentive Portal (`incentive.html`) | ✅ | Magic-link dashboard/leaderboard/admin. `sync-incentive-data` every 5 min. 68 techs invited + Incentive Tech group. Auth gate on all 5 pages. 4-lang i18n + lang_pref. **2026-07-02**: PWA; daily nudge emails; leaderboard Hub/Tech sub-tabs + Total JCs + earner threshold (>50). **2026-07-04**: `sync-incentive-data` v19 (conflict-key fix — reverted to `jc_billed_datetime,technician_name_raw,reg_number`); Jun 22 data restored manually; `rebuild_incentive_weekly_stats` alias-merge fix (`GROUP BY COALESCE(employee_id, technician_name)`) applied live; rank delta ▲/▼/NEW on leaderboard (commit `a74ed6d`); `send-feedback` edge fn deployed (v4, Resend + `incentive_feedback`); migration `20260702000004` confirmed live; new superadmin `ahsrahd@gmail.com`. ⚠️ `send-feedback` needs `verify_jwt: false` toggle in Supabase dashboard. **2026-07-05**: `sync-incentive-data` v20 (purges stale NULL-normalized rows before rebuild via `purge_stale_jc_log_rows`, migration `20260705000001`) — fixes dup-key rollback that left stats stale; ✅ all incentive edge fns + migrations now reconciled to git (v20, send-feedback v4, alias-merge `20260704000001`, incentive-nudge — prior "need git push" items done). ⚠️ Freeze/rebuild crons not yet in `cron-jobs.sql`. ⚠️ `set_week_payment_done` granted to authenticated (all techs) — confirm it has internal admin check, not just UI gate. **2026-07-08** (✅ LIVE commit 40c1318): Standalone technician incentive portal deployed at bounceops.online/v8/incentive.html — 46 KB self-contained HTML, no build step. Features: magic link auth (vamsee@bounceshare.com + vamsee@scalability.club allowlist), 4 KPI cards (eligible JCs, est. payout, voided JCs, rank), payout progress bar with tier visualization, 8-week trend table, public leaderboard (city filters, top-3 medals), admin tab (XLSX upload for seed data, burn overview, tech directory). XLSX parser accepts both snake_case (Metabase export) and Title Case columns; computes week_start from jc_billed_date. Name normalization: 45 technician mappings baked in (ABHISHEK KUMAR → ABHISHEK - SAKET, etc.). Payout tiers: threshold=50, Tier 1 (51–60 @ ₹25), T2 (61–80 @ ₹50), T3 (81–90 @ ₹75), T4 (91+ @ ₹100), cap ₹5,000/week. **2026-07-09** (🔄 IN PROGRESS): Technician directory loader — Python script `/tmp/load_technicians.py` ready (fetches public Google Sheet CSV, maps columns, upserts to incentive_technicians with on_conflict="email"). ⏳ BLOCKED waiting for Supabase service role key. Also pending: seed XLSX upload test, magic link auth test, admin name mapping editor implementation. **2026-07-09** (✅ pushed, Claude Code): fixed My Dashboard blank-on-first-load — double-boot race (`getSession()` + `onAuthStateChange` both ran `populateWeekSelector`+`loadDashboard`, overlap reset the week select → fell back to an empty week); added a boot guard (`_dashBooted`). Favicon (`icon-192.png`) added to all 14 v8 pages (tabs were showing the default globe). |
| A3 | Page Analytics (`admin-analytics.html`) | ✅ | Superadmin-gated; reads `page_events`; `logPageView()` on fw-map/incentive/trace-ho. **2026-07-02**: Sync Jobs panel fully wired — `admin-cron` edge fn ACTIVE (verify_jwt=true) + migration `20260702000001` applied (admin_cron_list/set_schedule/set_active RPCs). **2026-07-08 (⚠️ UNPUSHED):** tabbed layout (Page Analytics / Sync Jobs), cron group headers, status pills, per-job last-run history via new RPC `admin_cron_last_runs` (migration `20260708000001`). Needs push of `admin-analytics.html` + `admin-cron/index.ts` + migration, and admin-cron redeploy. ⚠️ Confirm `page_events` INSERT RLS + extend logging to remaining pages. |

### A1 — Manual JC Approval Check

**What it does.** A manager searches a vehicle (reg or chassis) and gets a stable
tier verdict instead of manually checking booking/payment/DMS state. Tiers:

| Tier | Verdict | Meaning |
|---|---|---|
| T1 | NOT APPROVED | Booking in progress — rider is out now; never JC a live trip |
| T2 | APPROVED | Prior JC was deleted — safe to recreate |
| T3 | NO ACTION | Draft already exists for this trip |
| T4 | APPROVED | DMS push failed — recreate is the fix |
| T5a/b/c | PENDING | Payment pending / push stuck / push in flight |
| T6 | MANUAL REVIEW | Insufficient data |

**Architecture (security-reviewed — no public Metabase card in client).**
- **Query**: `sql/rrr/RRR_Manual_JC_Approval_Check.sql` — dual-booking model
  (current booking = "is rider out now?"; JC's own `booking_id` = "was a draft made for
  this trip?"). Lives in a **private** Metabase card.
- **Edge fn**: `jc-approval-sync` (cron **every 5 min**, JOB 20) fetches the card CSV
  server-side, rebuilds `jc_approval_status` (one row/vehicle, delete+reinsert) and diffs
  `jc_approval_alerts` (append-only log of T4/T5b/T6). Card UUID lives ONLY in the edge fn.
- **Frontend**: `jc-approval.html` reads `jc_approval_status` with the user's session
  token (RLS authenticated-read). Superadmin-gated via `is_superadmin` app_metadata.
  Design language mirrors `maintenance.html` (centered search hero, FleetPro topbar,
  random "Try:" pills, last-synced line, site-footer).

**Migration**: `supabase/migrations/20260619000001_jc_approval.sql`
(`jc_approval_status` + `jc_approval_alerts`, RLS + indexes).

**2026-06-23 — context buckets + split sync fns.** Grew the lookup from 5 → 8 sections:
Booking History (last 8), Ops Log (`bike_operations_log`, last 10), JC Status Log
(`job_card_status_log` incl. DMS JC #, last 10); plus In-Trip (RR) flag + JC Hub on the
Job Card section and an amber hub-mismatch warning on the Bike section.
- Migration `20260623000001_jc_context_tables.sql` (APPLIED): `jc_booking_history`,
  `jc_ops_log`, `jc_jc_status_log` (PK `id bigint`, RLS auth-read/service-write);
  `jc_approval_status` += `intrip`, `jc_hub_name`.
- RRR SQL emits `Intrip` + `JC Hub Name` (hub via `rental_locations.location_name` — no
  `public.hub`); `jc-approval-sync` maps them.
- Combined `jc-context-sync` timed out (HTTP 546, ~26.5s, 3 cards sequentially) → split
  into **`jc-booking-sync` / `jc-ops-sync` / `jc-status-log-sync`** (one card each,
  `jc-history-sync` pattern). Cards c1efbecd / 98f2dc7c / b1470077 exist.

**Pending**
- ⬜ **Deploy the 3 split fns via MCP** + register 3 staggered crons (`:00`/`:05`/`:10`,
  every 15 min) + **drop the old `jc-context-sync` cron (job 28) & fn** + trigger once to
  populate. Redeploy `jc-approval-sync` and re-publish the jc-approval Metabase card so
  `Intrip` + `JC Hub Name` populate. (Code pushed to git; nothing live until this runs.)
- ⬜ Email notification on new T4/T5b/T6 alerts (`TODO(email)` in edge fn — transport
  not yet wired; the append-only log works without it).
- ⬜ Alert Centre page (reads `jc_approval_alerts`, lists actionable situations).

---

## Phase 0 — Get everything into git (½ day)
*Prerequisite for all else*

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.0 | Push v8 files to GitHub | ✅ | tag: `phase-0.0` |
| 0.1 | Tag repo `v8-final` | ✅ | tag: `v8-final` |
| 0.2 | Move `v6/` and `v7/` to `archive/` | ✅ | Preserved in archive/, gitignored |
| 0.3 | Pull all edge fn source into `supabase/functions/` | ✅ | tag: `phase-0.3` — all 13 fns captured + CNAME restored |
| 0.4 | DB dump → baseline migration `supabase/migrations/00000000000000_baseline.sql` | ✅ | tag: `phase-0.4` |
| 0.5 | Cron job definitions → `supabase/cron-jobs.sql` | ✅ | 9 jobs captured, keys redacted |
| 0.6 | Write / update README so fresh clone can rebuild backend | ✅ | tag: `phase-0.6` |

---

## Phase 1 — Security hardening (1–2 days)
*Do before sharing URLs any wider*

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Rotate admin secret (`Login_key` / `Bounce@123`) in Supabase env vars | ✅ | Rotated 2026-06-13; no code change needed (user enters secret manually) |
| 1.2 | Remove all plaintext secrets from `Fleetpro-context.md` | ✅ | PAT + Bounce@123 redacted |
| 1.3 | Add `role` claim (`admin`/`ops`/`tech`) to `app_metadata` via admin-create-tech fn | ✅ | edge fn v5 deployed; role dropdown added to admin-techs.html; set_role action added |
| 1.4 | Replace RSA_EMAILS allowlist in fw-map with Supabase Auth + role check | ✅ | DB-driven via groups/group_features/user_groups. RSA_EMAILS kept as fallback. admin-permissions.html built for matrix management. |
| 1.5 | Replace admin-techs unlock screen with Supabase Auth + role check | ✅ | Two-stage: magic link → role=admin check → Login_key secret |
| 1.6 | RLS on `rsa_tickets_cache`: SELECT authenticated, INSERT/UPDATE service role only | ✅ | Removed anon policy; authenticated_select only; service_role bypasses |
| 1.7 | RLS on `bike_rider_cache` (rider PII): authenticated ops/admin only | ✅ | Removed public read policy; authenticated only |
| 1.8 | RLS on location tables: service-role write, authenticated read | ✅ | bike_location_cache, rsa_ticket_locations, rsa_team_locations — RLS enabled authenticated-only |
| 1.9 | Expose hub list via curated view, not base table | ✅ | `hubs` view created + migration 20260613000001; live in Supabase |
| 1.10 | `verify_jwt=true` on all browser-facing edge fns | ⏸ | Parked — do after Vite migration (Phase 3) when shared auth lib exists |
| 1.11 | Re-test all pages after RLS changes | ✅ | All edge fn logs 200; crons healthy; authenticated reads confirmed; anon blocked |

---

## Phase 2 — Data model: cache → system of record ✅ COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Change rsa-ticket-sync to upsert on `ticket_number` (stop delete+reinsert) | ✅ | rsa-ticket-sync v16 deployed |
| 2.2 | Create `ticket_events` table (append-only, extends rsa_tech_actions) | ✅ | migration 20260614000002; RLS authenticated only |
| 2.3 | Update tech.html to INSERT event instead of UPDATE rsa_tickets_cache | ✅ | Dual-write: ticket_events + rsa_tickets_cache kept until 2.5 |
| 2.4 | Create `rsa_tickets_live` view (effective_status precedence logic) | ✅ | migration 20260614000003; new cols: effective_status, latest_event_type, latest_event_at, event_technician |
| 2.5 | Switch rsa.html + admin panels to query `rsa_tickets_live` | ✅ | effStatus() helper; all 10 status refs switched; security_invoker on view; anon blocked; override tested |
| 2.6 | Partition `rsa_ticket_locations` + `rsa_team_locations` by month | ✅ | migration 20260614000006; RANGE on synced_at; June+July+DEFAULT partitions; pg_cron job 18 auto-creates next month on 25th; old tables kept as *_old |
| 2.7 | pg_cron job: export partitions >90 days to Parquet in Supabase Storage | ✅ | migration 20260614000007; edge fn archive-location-partition; Arrow IPC format (.arrow) in location-archives bucket; pg_cron job 19 on 1st of month 02:00 UTC; ⚠️ needs ARCHIVE_CRON_SECRET set (see migration header) |

---

## Phase 2½ — ML data foundation (1–1.5 days)
*Start capturing history now — every week of delay = less training data*

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2½.1 | Create `vehicles` dimension table (`chassis_number` PK, reg, model, city) | ✅ | Applied to DB + migration file |
| 2½.2 | Create `ticket_status_history` table + trigger on `rsa_tickets_cache` upsert | ✅ | phase-2half-additive-2 |
| 2½.3 | Create `fw_pending_history` table + daily pg_cron snapshot | ✅ | Applied to DB + migration file |
| 2½.4 | Create `bike_telemetry_history` table (partitioned) + hourly insert in bike-location-sync | ⬜ | High volume — design partitioning first |
| 2½.5 | Enforce `resolution_type` as constrained enum on ticket_events | ⬜ | Label quality for ML |
| 2½.6 | Add `synced_at` + raw-payload JSONB column to `rsa_tickets` upserts | ⬜ | Cheap insurance for re-featurization |

---

## Phase 3 — Frontend consolidation: Vite + shared core (3–4 days)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Scaffold Vite multi-page app (keep same URLs) | ⬜ | |
| 3.2 | Extract `src/lib/supabase.ts` (single client, env-injected keys) | ⬜ | |
| 3.3 | Extract `src/lib/time.ts` (`parseUtcTs`, `fmtTime`, `tatMins`, `fmtTat`) | ⬜ | Fix once, works everywhere |
| 3.4 | Extract `src/lib/mapkit.ts` (pins, flash rings, trails, recenter) | ⬜ | |
| 3.5 | Extract `src/lib/auth.ts` (guard + role check) | ⬜ | |
| 3.6 | Extract `src/lib/ui.css` (design tokens) | ⬜ | |
| 3.7 | Migrate `rsa.html` to Vite page | ⬜ | First — most complex |
| 3.8 | Migrate `tech.html` to Vite page | ⬜ | |
| 3.9 | Migrate `fw-map.html` to Vite page | ⬜ | |
| 3.10 | Migrate remaining pages | ⬜ | |
| 3.11 | Replace hand-rolled SW with `vite-plugin-pwa` (workbox) | ⬜ | Fixes Android PWA install |
| 3.12 | GitHub Actions: build `dist/` → deploy to Pages or Vercel | ⬜ | Decide D1 first |

---

## Phase 4 — Environments + CI (1 day)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Create Supabase branch for staging (Pro feature) | ⬜ | Seed with Phase 0 migrations |
| 4.2 | GitHub Actions: PR → build + typecheck + preview deploy (staging) | ⬜ | |
| 4.3 | GitHub Actions: merge to main → deploy prod | ⬜ | |
| 4.4 | Write 20-line smoke script (check `rsa_tickets_live`, cron heartbeats) | ⬜ | Run post-deploy |

---

## Phase 5 — Observability + cost control (1 day)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | Create `sync_heartbeats` table | ✅ | Applied to DB + migration file |
| 5.2 | Update each edge fn to write to `sync_heartbeats` | ✅ | All 7 fns wired (session 14) — commit 146d5c4 |
| 5.3 | Update Cowork 8 AM health check to read `sync_heartbeats` | ✅ | health-check fn reads sync_heartbeats, flags stale/error, emails alert (session 14) — commit fdb1dc3 |
| 5.4 | Add Sentry (free tier) to shared lib | ⬜ | All pages get error reporting |
| 5.5 | Add `Cache-Control` headers on static assets (Vercel/Pages config) | ⬜ | Egress guardrail |
| 5.6 | Egress + DB health alert | ✅ | health-check fn emails at 70% egress; cron job 16 daily 08:30 IST |

---

## Phase 6 — Multi-city + product readiness (ongoing)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Create `cities` config table (code, name, bounds, center, zones) | ⬜ | Replace hardcoded BLR defaults |
| 6.2 | Update all pages to use `cities` table instead of hardcoded `inferCity` | ⬜ | |
| 6.3 | Generalize `rental_locations` → `hubs` keyed by city | ⬜ | |
| 6.4 | Add nullable `org_id` to core tables (tenancy stub) | ⬜ | Cheap now, RLS-by-org later |
| 6.5 | Create `feature_flags` table (`key, city, enabled`) | ⬜ | Per-city rollout control |

---

## Open Decisions (needed before Phase 3+)

| # | Decision | Options | Lean |
|---|----------|---------|------|
| D1 | Hosting after build step | GitHub Pages vs **Vercel** | Vercel (preview deploys, Vercel MCP connected) |
| D2 | Staging backend | **Supabase branch** vs 2nd project | Branch (Pro feature, less key juggling) |
| D3 | TypeScript scope | **Lib-only TS**, pages stay JS | Lib-only |
| D4 | Metabase dependency | **Keep polling** vs go direct to Bass | Keep for now |
| D5 | Realtime strategy | **Broadcast pub/sub** (implemented) vs postgres_changes | Broadcast — done ✅ |
| D6 | Frontend framework | **Vite** (Phase 3 plan) vs **Next.js** (Amit suggestion) vs stay HTML | Next.js has better AI coding reliability + Server Components reduce PostgREST load; decide before Phase 3 |

---

## Permission System (built session 7)

| Object | Type | Notes |
|--------|------|-------|
| `groups` | Table | id, name, description. Current: RSA Field Team, RSA Warroom, Admin |
| `group_features` | Table | group_id → feature_key. RSA Field: fw-map. RSA Warroom: fw-map+rsa-warroom. Admin: all |
| `user_groups` | Table | user_id → group_id (one-to-many). Nishanth+Pavan in RSA Field Team |
| `admin-permissions` | Edge fn | list_groups, list_users, toggle_user_group, toggle_group_feature, create_group, delete_group. Protected by Login_key |
| `admin-permissions.html` | Page | Groups×Features matrix + Users×Groups matrix. Live checkbox toggles. |
| `loadUserPermissions()` | fw-map.html fn | Fetches user's features from DB. Falls back to RSA_EMAILS if no DB groups. |
| `window.FP_FEATURES` | Global | Feature map {key:true} set after login. Use fpCan('feature-key') anywhere on page. |

**Feature keys:** fw-map · rsa-warroom · tech-app · admin-panel · export-data · all-cities

**Permission tasks — completed session 14:**
- ✅ Superadmin role protected from group changes (admin-permissions edge fn, 403 on toggle_user_group)
- ✅ index.html sidebar + settings danger zone gated by FP_FEATURES['admin-panel'] (commit 5564db9); admin links in sidebar
- ✅ tech-app feature assigned to RSA Field Team in group_features
- ✅ rsa.html + all 5 gated pages have perm-veil + fpCan() checks (session 14)
