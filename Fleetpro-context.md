# Fleetpro — Context File
*Last updated: 2026-07-17 (session 28 cont. — W6 attendance lag diagnosed as manual chain (IA8 logged); ops instruction drafted for W6 daily-tab fill; all prior hotfixes (c05aaab, 1eb7b71, 900d95b) recorded below. Prior session 27: sync-hr-employees v11 pending MCP deploy. Also 2026-07-16: maintenance.html Firmware/IoT status tags + JC-history bar-into-hero + item wrap, verify+pushed & live — block below.)*

## 🆕 2026-07-16 — maintenance.html UI (Cowork-built, Claude Code verify+push)

Three maintenance.html changes verified (diff-only-the-feature + brace/paren balance + inline `node --check` + secret scan) then pushed & live:

- **Firmware / IoT status tags per vehicle card (commits d66afa0 + a93703c).** New `fwTag()` helper renders amber "⚠ …: Pending" / green "✓ …: Done / N/A" pills for **DIU Check**, **IoT Glue**, **MCU FW (60A)** under a "Firmware / IoT" sub-header (inserted in the card body between parts and flags). A `hasFw` gate hides the whole block when the vehicle has no FW status value; a `false` value renders **"Done / N/A"** (covers genuinely-done + not-applicable, so an absent pill never implies "pending").
- **JC History sync bar merged into the dark hero (commit 8d60c19).** The standalone white "📋 JC History as of…" bar floated awkwardly between the hero and the results table. Removed it; the same info (data-as-of + Next-run + "↺ Sync All" button) now sits as a subtle dimmed line **inside the hero** under the main sync-time. Kept the original element IDs (`jc-sync-bar`/`jc-sync-time-val`/`jc-next-run-val`/`jc-global-sync-btn`) so `syncAllJC()` and the sync-status JS work unchanged.
- **JC History item-column full-name wrap (commit 3c0b3b0).** The Item cell truncated names with ellipsis (`max-width:160px;overflow:hidden`) — full name only on hover. Now `white-space:normal;min-width:150px;max-width:240px;line-height:1.35`, so long part names ("Head Light Lower Cover") wrap to a second line and read in full. Overrides the table's `.jc-tbl td{white-space:nowrap}`; table remains horizontally scrollable via `.jc-wrap`.

## 🆕 2026-07-15 — session 27 (incentive data integrity + recurring SSOT sync live)

**Ghost-row cleanup (W1–W4 IST-timezone duplication) — ✅ done.** Pre-v19 sync stored IST timestamps as UTC; v19 appended +05:30 → same JC landed as two rows 5h30m apart, different conflict keys → duplicates survived (W1–W4 ~2× inflated). Deleted the ghost twins, rebuilt weekly stats, re-froze. (Corrected numbers already reflected in frozen W3/W4/W5 from session 26b.)

**`freeze_completed_weeks()` rebuild-before-freeze — ✅ LIVE + git-synced.** Migration `20260715000001_freeze_rebuild_first.sql` pushed **commit 2c32688** (vehicle-parts-check). Function already live in Supabase since 2026-07-09; this reconciled git. Prevents freezing on stale data (root cause of payout↔sheet void gaps).

**Recurring SSOT sync — ✅ BUILT + DEPLOYED + PUSHED.** `sync-hr-employees` extended to v7: pulls the **Nomenclature Map (sheet `17-Ix…`, gid 572681529)** and upserts `hr_employees` + `incentive_technicians` + `jc_name_aliases` (FK-safe: aliases only for emp_ids present in hr_employees; `normalizeJcName` collapses spacing; `NOT_A_PERSON` filtered). v7 aliases stamped `created_by='sync'`. **Deployed via Supabase MCP (version 7, ACTIVE) 2026-07-15; git-synced commit 88cda84.** Cron **job 36 `sync-hr-employees-daily` `30 18 * * *` = 18:30 UTC / 00:00 IST** runs it nightly → the sheet is now the live single source of truth, refreshed automatically.
- **v8 → v11: Nomenclature Map is now the SINGLE master — git-synced commit bd65cfb (2026-07-15), NOT yet deployed to Supabase.** v11 drops the old HR sheet (`1BQLXsY…`) entirely; the **Nomenclature Map (gid 572681529)** is the sole source. One run does three upserts — `incentive_technicians` + `jc_name_aliases` + `hr_employees` — where `hr_employees.employee_name` is now the sheet's **Normalized Name** (e.g. "Ajit Sharma"). empId guard `/^[A-Z]+[0-9]+$/` rejects emoji/summary rows; email guard rejects `'-'` placeholder + malformed addresses; Map-based alias dedup (supersedes v8's fix); **FK `jc_name_aliases.employee_id → hr_employees` dropped** (sheet is authority, applied manually in DB). Cron job 36 unchanged. ⚠️ **Source-of-record only — live edge fn is still v7 until an MCP deploy of v11.**
- **DB cleanup (manual, already applied 2026-07-15):** deleted spurious summary rows from `incentive_technicians`; cleared bad emails (`prajapatilaldeep@gmail. Com`, `'-'`); backup at `incentive_technicians_bkp_20260715` (117 rows).
- **`v8/incentive.html` leaderboard — ✅ LIVE (commit bd65cfb, GitHub Pages auto-deploy):** shows normalized display name via `jc_name_aliases → hr_employees.employee_name`, falls back to raw JC name for unmapped techs. ⚠️ Shows normalized names only once `hr_employees.employee_name` is populated by v11 block 3 — i.e. after v11 is MCP-deployed and the cron (or a manual run) fires; until then it falls back to raw names.

**Analytics tab — W6 pooled JC/tech/day fix + leaderboard drill-down — ✅ LIVE (commit 900d95b, 2026-07-16).** Live tab showed W6 = **23.04** JC/tech/day (vs ~6 baseline) because `anPooled()` divided the WHOLE week's JCs (`incentive_weekly_stats.total_jcs`) by only the attendance days actually synced to `hub_productivity_daily` — W6 had just **2 of 7 days** loaded (2,800 ÷ 122 ≈ 23). Root cause = attendance-table data lag, not a formula error in the numerator. Fix: `anPooled` now projects tech-days as **(Σ per-hub avg techs/day) × days-in-week** — identical to the reference dashboard `RRR/Incentive_Metric1_JCperTech.html` (`buildChart0`, `td = Σtechs × m.days`). W6 → **6.58** (+9% vs 6.05 baseline). Under-bar labels now show **"N/7 att"** when a week's attendance is incomplete, so a projected week reads as an estimate. Same commit also carries **Cowork's** leaderboard Total/Void columns + Weekly-Trend row drill-down modal (per-JC detail) + 4-language i18n. ⚠️ Underlying data lag remains — backfilling `hub_productivity_daily` for W6 (5 missing days) would make it a measured value instead of a 2/7 projection. Reference file `Incentive_Metric1_JCperTech.html` is READ-ONLY (do not edit).

**Analytics follow-ups (same day, 2026-07-16):**
- **Drill-down field hotfix (commit 1eb7b71):** modal queries `incentive_jc_log.technician_name` (normalized) not `technician_name_raw` — `incentive_weekly_stats.tech_name` = normalized name, so `_raw` returned 0 rows for every drill-down.
- **Drill-down time in IST + chronic badge (commit c05aaab):** `jc_billed_datetime`/`first_comeback_datetime` shown as MM/DD HH:MM converted UTC→IST (+5:30); `weight≥2` rows get an amber "×N chronic" badge + amber row bg.
- **New L0 "Active technicians — day on day" chart (commit aba0e40, IA9):** `technician_available` (hub_productivity_daily) summed across hubs per day, city-filtered, thin daily line + bold 7-day trailing avg (avg = mean of non-null days in the trailing 7-cal-day window; missing days = line-break gaps, never fake zeros). Built by Claude Code directly. Pairs with pooled JC/tech/day to separate headcount dilution from real gain.
- **Attendance loader identified:** `hub_productivity_daily` is loaded by an external GAS **`oos-productivity-sync` @ 9:30 AM IST** — named ONLY in the table comment of migration `20260708000002`; the GAS is not mirrored in this repo. Chronic partial weeks (W6 = 2/7; W4/W5 stuck at 6/7) are that loader's silent lag, not an app bug. Hardening tracked as **IA8** (needs the GAS source). See memory `hub-productivity-attendance-sync`.

**`sync-incentive-data` v18-regression scare + v21 recovery — ✅ resolved 2026-07-16/17.** A "v17/v18" edit was made against the STALE `incentive/edge-functions/sync-incentive-data.ts` copy (a pre-v19 v16 fork missing `toIstTimestamptz` +05:30 and `purge_stale_jc_log_rows`) and deployed — regressing void/timestamp handling (would reintroduce ghost rows). Recovered by redeploying v20 as **v21 (Supabase version 26)**; `incentive_weekly_stats` rebuilt (W2 = ₹15,650); `jc_name_aliases` RLS auth-read policy added. Canonical file already trusts Metabase `rr_count_3d_comeback` directly (no false-void datetime filter) — there was never a filter to revert. **Git comment reconciled v20→v21, commit 8b8eae8** (comment-only, no logic change). ⚠️ **Canonical edge fn = `supabase/functions/sync-incentive-data/index.ts` ONLY; the `incentive/edge-functions/` copies are stale traps** — see memory `sync-incentive-data-canonical-path`.
- ⏳ **Open verification:** after tonight's 00:00 IST cron, confirm `jc_name_aliases` has fresh rows with `created_by='sync'` (distinguishes from the manual `created_by='sheet-sync'` one-time reconciliation done 2026-07-09). User will check via Supabase editor. If none appear, suspect the v7 dup-name crash → deploy v8 via MCP.
- ~10 techs still need emp_ids from hub managers (BANASWADI SOREI top priority) — once added to the sheet, they flow in automatically on the next nightly run.

**Still parked (unchanged):** invites to 23 non-logged-in techs (blocked on Resend key); W4+W5 incentive calc (#3, never run).

**Credential hygiene:** old `ghp_ViYXar8Z…` PAT confirmed dead (revoke if still listed); fresh `github_pat_11CAWE2I…` used for commits 2c32688/88cda84 — rotate (it's in session history). Supabase management token + a transcript service-role key both rotated/dead as of 2026-07-15.

## 🆕 2026-07-09 — UI fixes (Claude Code): favicon + dashboard first-load (all pushed & live)

- **Favicon on all 14 v8 pages:** tabs showed the default globe (only `apple-touch-icon`/manifest existed).
  Added `<link rel="icon" type="image/png" href="/v8/icon-192.png">` after `<title>` on every page.
  (`trace-hunter.html` also carried a previously-unpushed `logPageView()` analytics call — now reconciled.)
- **incentive.html "My Dashboard" blank on first load — fixed:** the boot ran twice concurrently
  (`getSession()` path + `onAuthStateChange` SIGNED_IN both called `populateWeekSelector()`+`loadDashboard()`);
  the overlap reset the week `<select>` mid-read → `getSelectedWeek()` fell back to a week with no data →
  "No data for this week" + stuck payout "Loading…" until a manual week re-select. Fix: **boot guard**
  (`_dashBooted` — run once, reset on sign-out) + await the initial load + clear the stuck "Loading…" on the
  genuine no-data path. Guard is a no-op if the page only booted once, so it can't regress.

## 🆕 2026-07-09 — session 26b (analytics tab pushed, freeze structural fix, SSOT mapping sync)

**Analytics tab — ✅ LIVE (commit 5b16277):** the `v8/incentive.html` Analytics tab (built earlier this session) was pushed to GitHub Pages. Superadmin/incentive-admin gated, live data from `incentive_weekly_stats` + `hub_productivity_daily`. ⚠️ If the in-tab yellow banner shows, `hub_productivity_daily` needs `CREATE POLICY "auth read" ON hub_productivity_daily FOR SELECT TO authenticated USING (true);` (anon read confirmed blocked; authenticated read still unverified — check on the live tab).

**Freeze structural fix — ✅ LIVE + git-synced (migration `20260715000001_freeze_rebuild_first.sql`, commit 2c32688 — 2026-07-15):** root cause of payout/sheet gaps = `freeze_completed_weeks()` only flipped `is_frozen` on whatever the last rebuild left, then locked it (frozen weeks are skipped by later rebuilds → stale numbers protected). Rewrote it to **rebuild-from-live-jc_log FIRST, then freeze**, so a week can never freeze on stale data. Cron `incentive-freeze-thursday-noon` (job 35, `30 6 * * 4` = Thu 12:00 IST) + guard `week_start + 10 days + 6:30h < NOW()` were already correct.

**W3/W4/W5 data corrected + re-frozen:** unfroze → `rebuild_incentive_weekly_stats()` (matured voids now included) → re-froze via the new freeze fn. W5 voids 150→153 (matches payout sheet), W3 185→188. Frozen totals now: W3 ₹17,600 (13 earners), W4 ₹15,600 (14), W5 ₹10,300 (18).

**SSOT name-mapping — ✅ established + synced:** the Google master sheet **"Technician Nomenclature Map" (gid 572681529** in sheet `17-Ix-tVo2ekew5dogOFm9K8XsuMsdCb0MjQcnQGdxFs`) is now the single source of truth (HR list `hr_employees`, 102 rows, is reference only). One-time reconciliation done: 92 sheet mappings upserted into `jc_name_aliases` (was 73); `incentive_jc_log.employee_id` re-stamped via **whitespace-normalized match** (`upper(regexp_replace(name,'\s+','','g'))`) so sheet spacing-variants (`SOUMEN BAR-BELLANDUR` vs ` - `, tab chars, `PRITAM -OKHLA`) all resolve; rebuild ran. Stamped JCs 12,856→13,147. Frozen weeks preserved. **Venkatesh cross-wiring fixed** (K VENKATESH→WRC2232, T VENKATESH→WRCT0142; re-stamp corrected the Apr–May mis-stamped rows). ✅ **2026-07-15: Recurring sync live** — `sync-hr-employees` v7 (commit 88cda84, deployed) now upserts `jc_name_aliases` nightly via pg_cron job 36.
- **Hub column:** computed most-frequent hub per raw name over each tech's last-2-weeks activity; **cross-city check clean** (no raw name / emp_id spans >1 city → no mis-mappings; within-city hub moves = shortage cover, expected). Hub-update paste-list handed to user; user updating sheet. Hub reflects recent deployment (drifts weekly) — dashboard already computes it live, so sheet Hub is reference only.
- **Still unmapped (need emp_ids from hub/service managers):** BANASWADI SOREI (107 JCs, paid earner, top priority), MANIKANTAN BANASWADI (53), ABHISHEK-GURUGAON+GURUGRAM (merge, 49), SANTH BANASWADI (34), IMRAN BILEKAHALLI (19), RAVI CHANDRAN BILEKAHALLI (14), LASKAR-HSR LAYOUT (2), MOHAMMED SAIF-BANASWADI (1, inactive since Jun 11).

**Invites (#2) — PARKED:** 23 real technicians (25 never-logged-in in auth.users minus superadmin `ahsrahd@gmail.com` + internal `rohit.mishra@bounceshare.com`) invited Jun 27 but never logged in. Approved plan: rich English invite via Resend (benefit-first copy drafted). ⚠️ Blocked on Resend API key (edge-fn secret, not readable from Management API) — user will handle later.

**Last-2-week incentive calc (#3) — NOT run** (user paused). Scope agreed: W4 + W5 (last two completed/matured weeks).

## 🆕 2026-07-09 — session 26 (incentive impact analytics — dashboard lives in Bounce repo, not fleetpro)

**Artifact: `Bounce/RRR/Incentive_Metric1_JCperTech.html`** — snapshot analytics dashboard (data through 2026-07-08), L0→L2 structure, two tabs (JC Count live / JC Labour Time placeholder), city filter Overall/Bangalore/NCR/Hyderabad, sticky filter bar. NOT deployed anywhere — local HTML opened directly in browser.

**Key corrections established this session (affect any future incentive analytics):**
- **Timeline corrected:** incentive ANNOUNCED 2026-06-23 (start of W4 Jun 22–28); W3 (Jun 15–21) was paid retroactively in the first payout Sat 2026-07-04. Pre-announcement baseline = W1–W3.
- **Void% definition:** voided ÷ ALL billed JCs (NOT ÷ intrip JCs — earlier tile double-counted). W5 Overall = 5.6%. Void window: JC voidable up to 3 days after billing → a week is final only Wednesday of following week.
- **W1 (Jun 1–7) void flags are under-captured** (near-zero Jun 1–4, before comeback detection live) — W1 excluded from quality charts; quality baseline = W2–W3 (~7%).
- **Fathe nagar + Miyapur are Hyderabad** (weekly_stats city column); Fathe nagar had NO ops-sheet attendance until W5 (Jun 29+); Miyapur has none ever — both invisible in JC/tech/day until ops backfills `hub_productivity_daily`.
- **Cohort finding (announcement-corrected):** same-tech avg weekly eligible 41.6 → 38.6 (−7%) W1–W3 vs W4–W5; 30 declined/20 improved; 13→9 sustained earners; 22 new techs, 0 earning. Headcount grew ~50→61 techs/day; pooled JC/tech/day 5.85 baseline → 6.35 W5 (+8.5%, first real lift, coincides with portal+payout proof).
- **ROI metric:** ₹/incremental JC = payout ÷ (ΔJPT × tech-days), NOT ÷ raw volume growth (headcount pollutes). W5: ₹10,300 ÷ ~199 incremental JCs ≈ ₹52/JC.
- **EndTrip (OOS) voids ~1.5–2× intrip** every week — quality problem is OOS→RFD work; NCR worst (EndTrip 10.3% W5).

**Analytics tab BUILT + PUSHED 2026-07-09 (commit 5b16277):** `v8/incentive.html` now has an Analytics tab (gated `incentive-admin`, shown via `applyRoleView`). Live data: `incentive_weekly_stats` paginated fetch (all metrics incl. hub intrip split via dominant-hub attribution); `hub_productivity_daily` fetched with adaptive column detection (date/hub/tech columns auto-found) + hub-name normalization (yeshwantpura→yeshwanthpur, hebbala→hebbal); if unreadable, JC/tech/day sections degrade gracefully + banner shows the one-line RLS fix (`CREATE POLICY "auth read" ON hub_productivity_daily FOR SELECT TO authenticated USING (true);` — anon read confirmed blocked 2026-07-09, authenticated read untested). Dynamic week list (current week partial + projection jpt×avg techs×7; voids final Wednesday); constants: announce 2026-06-22 week, payout 2026-06-29 week, quality from 2026-06-08. Chart.js 4.4.1 CDN added to head. RRR snapshot dashboard unchanged.

## 🆕 2026-07-08 — session 25 (technician incentive portal deployment + directory integration)

**Technician Incentive Portal (✅ LIVE — commit 40c1318):**
- **`v8/incentive.html`** (46 KB): Complete standalone web app for technician incentive tracking
  - **Features:** Magic link auth (email OTP), 4 KPI dashboard cards, payout progress bar with tier visualization, 8-week trend table, public leaderboard (city-filterable, top-3 medals), admin tab (XLSX upload, burn overview, tech directory)
  - **Auth:** Allowlist vamsee@bounceshare.com + vamsee@scalability.club (can be expanded)
  - **Data:** Connected to Supabase (clkfvmmlgwcvntxnolsv) tables: incentive_technicians, incentive_jc_log, incentive_weekly_stats, incentive_upload_batches, incentive_nudge_log
  - **XLSX parsing:** Flexible — accepts both snake_case (Metabase export) and Title Case columns; computes week_start from jc_billed_date; detects void from rr_count_3d_comeback
  - **Name normalization:** 45 technician name corrections baked in (ABHISHEK KUMAR → ABHISHEK - SAKET, DEEPAK M → DEEPAK M - BILEKAHALLI, etc.)
  - **Payout tiers (v6, threshold=50):** Base 1-50 (₹0), Tier 1 (51-60 @ ₹25), T2 (61-80 @ ₹50), T3 (81-90 @ ₹75), T4 (91+ @ ₹100), cap ₹5,000/week
  - **RLS:** Leaderboard public (anon read), dashboard/admin require auth + superadmin check
  - **Deployed:** 2026-07-08 23:45 UTC via GitHub Pages (commit 40c1318)

**Supabase Schema (✅ LIVE via Supabase MCP):**
- All 5 tables + RLS policies created 2026-07-08 05:00 UTC
- RLS: incentive_weekly_stats = public read-all (anon), incentive_technicians/jc_log/nudge_log = authenticated read-all, all writes = service_role only
- Schema SQL: `/RRR/Incentive_Scheme/INCENTIVE_SCHEMA.sql` (188 lines, 5 tables, dedup index on jc_log)

**Technician Directory Loader (🔄 READY, WAITING FOR CREDENTIALS):**
- Python script `/tmp/load_technicians.py` written and ready to run
  - Fetches CSV from public Google Sheet (1BQLXsYQS2KfFS9MRkQWQMBgUH9kr5TizmhyB4r2hbRU)
  - Maps columns: Candidate Name → name_normalized, Working Location → hub_name, City → city, Email ID → email, Designation → role, active=true (hardcoded)
  - Upserts to incentive_technicians with on_conflict="email" (safe re-run)
  - Skips rows with blank name or email
- **BLOCKED:** Waiting for Supabase service role key to execute

**Documentation (✅ COMPLETE):**
- `HUB_MANAGER_ONBOARDING_MESSAGE.txt` — plain-text, copy-paste ready for hub managers to send to technicians
- `DEPLOYMENT_STATUS.md` — 5-phase deployment checklist (Supabase setup ✅, GitHub push ✅, seed data ⏳, testing ⏳, runbook ⏳)
- `INCENTIVE_README.md` — feature guide (414 lines)
- `INCENTIVE_QUICKSTART.txt` — 5-step deployment guide
- Updated `incentive_context.md` with portal reference + current dates

**Pending Actions (next steps for live rollout):**
1. ⏳ Provide Supabase service role key → run technician directory loader → populate incentive_technicians table
2. ⏳ Upload seed XLSX (query_result_2026-06-22T17_52_38.376606446Z.xlsx) via Admin tab → populate incentive_jc_log + rebuild weekly_stats
3. ⏳ Test magic link auth (vamsee@scalability.club) → confirm dashboard shows current week data + 8-week trend
4. ⏳ Admin name mapping editor (commit message ready, implementation status TBD)

**Notes:**
- Portal is production-ready for pilot (2-week manual payout test Jun 23 – Jul 7)
- Leaderboard already live and public (reads weekly_stats)
- Name map in HTML is authoritative (overrides any upstream corrections)

## 🆕 2026-07-05 → 07-08 — session 24 (incentive pipeline reconcile + Sync Jobs history)

**2026-07-05 (pushed & live):**
- **`sync-incentive-data` v20:** calls `purge_stale_jc_log_rows()` before each rebuild. v16-v18 had
  synced phantom rows with NULL `technician_name_normalized`; those produced duplicate
  `(tech_name, week_start)` on rebuild → UNIQUE violation → whole rebuild rolled back → stale stats.
  Purge fn (migration `20260705000001`) deletes only NULL-normalized rows in **non-frozen** weeks
  (frozen/paid weeks protected). Function was created live before v20 deploy, so DB + edge fn are in sync.
- **git↔live reconcile (incentive rebuild RPC now fully in git):** `20260704000001_rebuild_alias_merge.sql`
  is the verbatim `pg_get_functiondef()` dump of the live `rebuild_incentive_weekly_stats` —
  MODE() dominant hub + `SUM(jc_weight)` weighted counts + frozen-safe DELETE + **`GROUP BY
  COALESCE(employee_id, technician_name)`** (merges JC-name aliases into one technician). Any FUTURE
  change to this RPC must be dumped from live, never reconstructed from git (payout-regression risk).
- **`incentive-nudge`** captured in git for the first time (was deploy-only) + 550ms Resend rate-limit.

**2026-07-08 (⚠️ LOCAL — not yet pushed/deployed):**
- **admin-analytics Sync Jobs panel enhanced:** tabbed layout (Page Analytics / Sync Jobs), cron
  group-header rows, status pills, and **per-job last-run history** via new RPC `admin_cron_last_runs`
  (reads `cron.job_run_details`). Touches `v8/admin-analytics.html`, `supabase/functions/admin-cron/index.ts`,
  and new migration `20260708000001_admin_cron_last_runs.sql`. **All three need a /tmp-clone push; the
  migration + admin-cron redeploy must land or the "list" action errors on the missing RPC.**

## 🆕 2026-07-04 — session 23 (all live unless noted)

Incentive data recovery + alias-merge bug fix + leaderboard rank delta + send-feedback deployment + new user.

- **`sync-incentive-data` v19 deployed:** Root cause of Jun 22+ data loss: v18 used `onConflict: 'jcsl_id'` but `jcsl_id` is absent from the Metabase card output → always null → the partial unique index `incentive_jc_log_unique_jc` never fired → upsert fell through to insert → Jun 22+ rows weren't inserted at all. v19 reverts conflict key to `jc_billed_datetime,technician_name_raw,reg_number` (the actual index columns). Also uses `toIstTimestamptz()` to append `+05:30` before storing IST timestamps. Cron at 19:00 UTC daily. ⚠️ Source file `supabase/functions/sync-incentive-data/index.ts` updated locally; **needs git push via /tmp clone.**

- **Jun 22 week data restored:** Could not trigger edge fn directly (pg_net call got 401 — SYNC_SECRET is edge fn env var, not in vault; no SQL path to retrieve it). Could not connect via psycopg2 (Supabase pooler DNS blocked in sandbox). Resolution: generated 3 SQL INSERT files (~1,623 rows total); user ran them manually in Supabase SQL editor. Then ran `SELECT rebuild_incentive_weekly_stats()` + re-froze Jun 22 via `SELECT freeze_completed_weeks()`. Jun 22 week now frozen with correct data.

- **`rebuild_incentive_weekly_stats` alias-merge bug fixed:** Function was `GROUP BY l.technician_name` — so two raw names for the same employee (JATIN - HOODI → WRCT0164, JAUTIN SAHOO - HSR LAYOUT → WRCT0164) produced two separate rows. The 2-JC row (JAUTIN SAHOO) was below the ≥51 threshold and invisible; the 56-JC row (JATIN) was missing 2 JCs. Fix: `GROUP BY COALESCE(l.employee_id, l.technician_name)` + `MODE() WITHIN GROUP (ORDER BY l.technician_name) AS tech_name` for display name. Result: JATIN now shows 58 eligible JCs, ₹200 payout — matches reference sheet. Applied live via execute_sql MCP. ⚠️ **NOT captured in a migration file** — must create `20260704000001_rebuild_alias_merge.sql` and push.

- **Leaderboard rank delta (▲/▼/NEW):** Week-over-week rank change shown next to each technician name in the incentive leaderboard. Previous week fetched in parallel (`Promise.all`); `prevRankMap` built by `tech_name`. Ranks up → green ▲N, ranks down → red ▼N, no prior week entry → purple NEW badge. Pushed as commit `a74ed6d` via Claude Code.

- **`send-feedback` edge fn deployed (v4):** Saves feedback text + audio URL to `incentive_feedback` table; emails vamsee@bounceshare.com via Resend. Audio: frontend uploads to `feedback-audio` Storage bucket first, passes URL to edge fn. Migration `20260702000004` (tables already existed from prior session — `apply_migration` confirmed "policy already exists"). ⚠️ Edge fn deployed with `verify_jwt: true` but called with anon key from incentive.html — must toggle to `verify_jwt: false` in Supabase dashboard. ⚠️ Source `supabase/functions/send-feedback/index.ts` **needs git push.**

- **New user `ahsrahd@gmail.com`:** Created directly in `auth.users` via execute_sql with `is_superadmin: true` in `raw_app_meta_data` and `email_confirmed_at: NOW()`. Magic link works immediately (no email confirmation step needed). No group assignment needed — superadmin flag grants all features.

### ⚠️ Still needs action (2026-07-04)
| Item | Action needed |
|------|---------------|
| `sync-incentive-data/index.ts` (v19) | Git push via /tmp clone |
| `send-feedback/index.ts` | Git push via /tmp clone |
| `send-feedback` edge fn | Toggle `verify_jwt: false` in Supabase dashboard (currently true — anon-key calls will 401) |
| `rebuild_incentive_weekly_stats` alias-merge fix | Create migration `20260704000001_rebuild_alias_merge.sql` + git push |
| `feedback-audio` Storage bucket | Confirm bucket exists with authenticated-write policy (audio uploads will fail if missing) |

## 🆕 2026-07-02 — session 22 (all live)

Incentive PWA + nudge emails + Sync Jobs panel + leaderboard polish + hub attribution fix.

- **incentive.html PWA:** `incentive-manifest.json` + `incentive-sw.js` added; meta tags in `<head>` + SW registration. Android "Add to Home Screen" installs as standalone app.
- **Daily nudge emails (`incentive-nudge` edge fn, ACTIVE):** Personalized email to every active tech at 08:00 + 20:00 IST (pg_cron job 37, `30 2,14 * * *`). Shows JC count, payout, tier badge, nudge to next tier. Sends via Resend API (`RESEND_API_KEY` + `NUDGE_FROM_EMAIL=incentive@bounceops.online` in Supabase secrets). `bounceops.online` DNS records added to BigRock — pending propagation (4-6 hrs). `get_nudge_targets` SECURITY DEFINER RPC (migration `20260702000002`) joins `incentive_weekly_stats → jc_name_aliases → hr_employees` for email. Tier calc is incremental/bracket-based (51-60→₹25, 61-80→₹50, 81-90→₹75, 91+→₹100, cap ₹5,000).
- **Sync Jobs panel (`admin-cron` edge fn, ACTIVE, verify_jwt=true):** Superadmin can view + edit all pg_cron job schedules from `admin-analytics.html`. Three RPCs: `admin_cron_list()`, `admin_cron_set_schedule()`, `admin_cron_set_active()` (migration `20260702000001`, service_role-only SECURITY DEFINER).
- **Hub attribution fix (`rebuild_incentive_weekly_stats`):** `MAX(hub_name)` → `MODE() WITHIN GROUP (ORDER BY hub_name)` so dominant hub wins when a tech worked across hubs. Applied live via MCP. Git reconciliation migration: `20260702000003_rebuild_incentive_mode_hub_fix.sql` (preserves SUM(jc_weight) v17, frozen-weeks DELETE, all prior patches).
- **Leaderboard polish (Claude Code, committed):** Hub/Technician sub-tabs (Export CSV in the sub-tab row),
  Technician tab default, column sub-header on hub expand (Technician / City / Tier / Eligible JCs / Est. Payout),
  Total JCs column added to hub table. Hub-expand rows had medal icons removed + columns aligned 1:1 to headers.
  - **Earner threshold made consistent (>50):** the KPI earner count used `>=50` while payout is `≤50 → ₹0`
    (so a true earner is `>50`/≥51). Fixed count to `>50` and updated both labels "Earners (≥50)" → "Earners (>50)".
  - **Week-over-week rank delta** (▲/▼/NEW) shown per technician in the leaderboard.
- **Frozen-week banner + Help/Feedback FABs (incentive.html):** Feedback floating button captures text **and
  audio** (MediaRecorder) → `send-feedback` edge fn (NEW; Resend email, env-var secrets, service-role) →
  `incentive_feedback` table. Frozen-week banner reads/writes `incentive_week_config` (payment-done marker).
  Both tables + the `set_week_payment_done` RPC are in migration `20260702000004_incentive_week_config.sql` (NEW).
  Also added a PWA install prompt (`beforeinstallprompt`) to incentive.html.
  ⚠️ **Not yet deployed:** Cowork must (a) deploy `send-feedback` edge fn and (b) run migration `20260702000004`
  — the Feedback FAB + frozen banner error until then. ⚠️ `set_week_payment_done` is `GRANT`ed to **authenticated**
  (all techs) — confirm it has an internal admin/superadmin check, not just UI gating.
- **Sidebar sweep (Claude Code):** `v8/sidebar.js` shared component — ONE source of truth for sidebar
  content *and* appearance across all 12 pages. Injects canonical markup (sections + `data-feature`
  gates), `toggleSidebar/togglePin/closeSidebar` globals, and a `<style>` appended to `<head>`.
  - Each page's static `#sb` emptied (dead markup removed); per-page gating still runs after injection.
  - `admin-techs.html` had no FleetPro chrome — re-shelled additively (dark sidebar CSS + `#ov`/`#sb`/`#hbg`
    shell + include; auth/data untouched; hamburger only shows post-unlock inside `#main-content`).
  - **Theme unified:** colour-only `#sb …` overrides (dark `#1A1A2E`) flip the 4 previously-white sidebars
    (rsa/trace-ho/admin-permissions/admin-analytics) to match the other 7. Layout/z-index left per-page.
  - **Scroll fix:** injected `#sb{overflow-y:auto}` — pages with `overflow:hidden` were clipping bottom
    items (Admin/Coming Soon/Settings) on short viewports.
  - `sync-status.js` heartbeat badges removed from the sidebar footer (7 pages) — that info now lives in
    the Analytics Sync Jobs panel. Feature keys in sidebar.js verified vs `admin-permissions` ALL_FEATURES.
- **cron-jobs.sql:** Updated with job 37 (`incentive-nudge-daily`, `30 2,14 * * *`).

⚠️ `bounceops.online` domain verification in Resend still pending DNS propagation — nudge emails will start firing automatically once green.

## 🆕 2026-06-28 → 07-01 — session 21 (commits `de40efc`→`5f53f14`, all live)

Incentive portal polish + new analytics + RSA GPS + admin/nav consolidation.

- **Incentive UX (i18n & dashboard):** 4 languages (EN/HI/KN/TE) with `data-i18n` + `lang_pref` persisted
  to `user_metadata`; leaderboard KPI summary strip; week-selection persist; eligible/payout KPI highlight;
  per-week rank in trend; frozen-week "Payout" vs "Est. Payout" label; ₹5,000 cap reframed aspirationally;
  admin dropdown deduped by base name + week-scoped; sidebar z-index/overlay fixes.
- **Analytics (NEW):** `admin-analytics.html` (superadmin-gated, light theme) reads `page_events`;
  `logPageView()` added to fw-map/incentive/trace-ho (writes email+page, fire-and-forget). Analytics
  sidebar link + full admin section (techs/permissions/jc-approval/analytics) swept across ALL pages.
  🟡 Confirm `page_events` has an INSERT RLS policy for authenticated users, else logging silently no-ops.
- **admin-permissions redesign:** FleetPro theme + sidebar + Supabase magic-link auth → **superadmin gate**
  (non-SA → denied) → admin-secret unlock. ⚠️ Secret now persisted in `localStorage('fp_admin_secret')`
  (convenience 2nd-factor; primary superadmin gate unchanged — confirm the secret isn't reused elsewhere).
- **RSA (`rsa.html`):** customer name + clickable phone in ticket popup (added `customer_name/phone` to the
  `rsa_tickets_cache` SELECT — ⚠️ rider PII now shown to all `rsa-warroom` users); **Live GPS ↔ Ticket GPS
  toggle** (commits `4f19ba5`, `5f53f14`): `_gpsMode` ('ticket'|'live'), `_liveGpsMap{}`, `fetchLiveGps()`
  reads `bike_location_cache` incl. new Intellicar cols; renders tickets first, re-renders async when
  live GPS arrives. Added Bhoja (KA05AR0387) to RSA team (rsa + fw-map).
- **Intellicar dual-source GPS (`bike-location-sync` v9, deployed 2026-07-01):** Edge fn now reads both
  BaaS and Intellicar GPS columns from Metabase card `18f2864d`. Picks fresher timestamp:
  `useIntellicar = icarTs > baasTs && icarLat != null`. Writes resolved `lat`/`lng` (best source) plus
  raw `baas_lat/lng`, `intellicar_lat/lng`, `intellicar_location_time`, `best_source` to
  `bike_location_cache`. ⚠️ **New columns added via Supabase MCP SQL only — no migration file captured.**
  User must add to a migration before any DB reset/branch.
- **`rsa_tickets_live` view fix (2026-07-01):** View was missing `customer_name` and `customer_phone`
  columns. PostgREST returned 400 silently — polling loop's try-catch swallowed it, causing RSA Warroom
  to stick on "Syncing from Metabase (~60s)…" indefinitely. Fix: `DROP VIEW rsa_tickets_live` +
  `CREATE VIEW` with both columns added. ⚠️ Applied via Supabase MCP SQL only — no migration file.
  (`CREATE OR REPLACE VIEW` was rejected by Postgres — "cannot change name of view column" on column
  reorder; had to DROP+CREATE.)

## 🆕 2026-06-28 — Incentive Portal: Tech Onboarding, Auth & UX (session 20)

### Tech Invites & Group Setup
- **68 technicians** now invited to Supabase auth and added to `Incentive Tech` group (`eaa3b153`).
- 52 existing users added via SQL INSERT to `user_groups`; 13 new users invited via `bulk-invite-techs` edge fn (`verify_jwt:false`); 3 bad-email techs (`gail.com`/`gamil.com`/`email.com`) fixed via `sync-hr-employees` v3 then re-invited.
- All 76 techs who were in both `Default Users` + `Incentive Tech` groups had Default Users membership removed — they were seeing PM/OOS Queue/Deployment tiles incorrectly.
- `admin-panel` feature added to Admin group in `group_features` (was missing — caused Admin sidebar section to hide on maintenance.html etc.).
- `incentive-tech` and `incentive-admin` added to `ALL_FEATURES` list in `admin-permissions.html` (commit `2172051`) so they appear in the permissions matrix.

### Auth Gate (all 5 pages)
- `index.html`, `incentive.html`, `maintenance.html`, `queue.html`, `jc-approval.html` now allow magic links for **any email in `hr_employees` OR `incentive_technicians`** (not just `@bounceshare.com`). Badge updated to "Bounce technicians & staff".
- RLS fixes: `incentive_technicians` anon SELECT policy added (pre-login email check was blocked); `hr_employees` authenticated SELECT policy added (zero policies = nobody could read it).
- `no-access` fallback added to `index.html`: users with zero features see "🔒 No modules assigned yet" instead of blank page.

### Session / Storage Key Fix
- `incentive.html` was using `storageKey:'incentive_session'`; all other pages use `'fleetpro_session'`. Changed to `fleetpro_session` (commit `5156745`) — cross-page SSO now works (navigating from home → incentive carries the session).

### Routing & Nav UX
- `index.html`: after permissions load, shows only `incentive-tech` tile + sidebar item for techs; other tiles hidden by `data-feature`. No-access message if zero features.
- `incentive.html` sidebar: `applyNavPermissions` hides ungated nav items (Home) for tech-only users; logo/topbar link now routes to `index.html` for admins and stays on `incentive.html` for tech-only users (commit `b9cca5a`).

### Data Refresh
- `sync-incentive-data` cron (job 34) changed from `30 2 * * *` (daily 2:30am) → `*/5 * * * *` (every 5 min). Job 35 (Thursday 6:30am IST, weekly reset) unchanged.

### Commits this session (all live)
`e33fa94` auth gate incentive.html → `5647881`+`2676374` auth gate 4 pages → `8292d71` no-access msg → `7a6f0e1` incentive-tech redirect (later reverted) → `23c5af4` logo links → `9a18823` revert redirect → `2172051` permissions matrix → `5156745` shared session key → `b9cca5a` role-aware logo

### Groups & Features (current live state — 2026-06-28)
| Group | Features |
|-------|----------|
| Admin | fw-map, rsa-warroom, tech-app, maintenance, oos-queue, deployment, trace-ho, trace-hunter, incentive-admin, incentive-tech, **admin-panel** (added this session) |
| Incentive Tech | incentive-tech |
| (dd57c013 — Incentive Admin?) | incentive-tech, incentive-admin |
| Default Users | maintenance, oos-queue, deployment (techs removed from this group) |
| FPI Hunter | trace-hunter |
| FPI Admin | trace-ho, trace-hunter |

## 🆕 2026-06-23 → 27 — Technician Incentive Portal (`v8/incentive.html`)

New superadmin-gated page (sidebar Admin section). Magic-link auth; Dashboard (KPI cards,
payout tiers, 8-week trend), Leaderboard (rankings, city filter, medals, email under name,
This-Week/Last-Week filter with date ranges), Admin (technician directory + name mapping).
Reads Supabase `incentive_weekly_stats` / `incentive_jc_log` / `incentive_technicians`.

### Data sync: XLSX upload → "Sync Now" edge function
- Originally a manual XLSX upload (Excel serial/ISO date parsing via `cellDates:true` + `raw:true`).
- Replaced (2026-06-26) by a **"Sync Now" button** → `sync-incentive-data` edge fn, which pulls
  JCs from the Bounce production DB server-side and rebuilds the incentive tables.
- **Admin directory:** read-only emp/name/email, hub/city auto from JC stats, multi-select JC-name
  mapping (excludes already-normalized names), `sync_technician_mapping` RPC ("Save & Sync").

### `sync-incentive-data` edge function — status (2026-06-27)
- Deployed via Cowork MCP. CORS fixed in v3 (OPTIONS→204, `Access-Control-Allow-*` on all responses).
- **Source captured in repo** at `supabase/functions/sync-incentive-data/index.ts` (commit `7e905ca`).
  Source-of-record file: `RRR/edge-functions/sync-incentive-data.ts`.
- 🔴 **BLOCKED — `BOUNCE_DB_URL` secret not set.** Debug (2026-06-27) showed 500 `AggregateError`
  → unwrapped to `ECONNREFUSED 127.0.0.1:5432` + `bounce_db_set:false`. With the env var unset,
  `postgres(undefined)` defaults to localhost → refused. **Fix: set `BOUNCE_DB_URL` secret on the
  function** (Bounce prod DB connection string), then re-curl to confirm sync. Consider a hard
  guard instead of the `!` non-null assertion at line 6 so it fails loudly if unset.
- **Auth model (decided 2026-06-27, Option A):** `verify_jwt=true` (gateway validates JWT) + **SYNC_SECRET
  check removed** from the function. The "Sync Now" button (user session JWT) and anon-key calls both pass.
  Rationale: SYNC_SECRET-as-Bearer is dead under verify_jwt (gateway 401s any non-JWT bearer with
  `UNAUTHORIZED_INVALID_JWT_FORMAT` before the fn runs). ⚠️ **Known tradeoff:** the anon key is public
  (shipped in page source), so verify_jwt=true allows *anyone with the anon key* to trigger the sync —
  NOT only authenticated users. Accepted as low-stakes (sync is idempotent, refresh-only — no data
  loss/exposure, worst case extra Metabase load). To restrict to logged-in users later, check JWT
  `role='authenticated'` in the fn. For cron/machine calls, use Option B (valid JWT + `x-sync-secret` header).
- **2026-06-27 — #1 RESOLVED.** Test POST returned `{ok:true, rows_fetched:2000, rows_upserted:2000,
  weeks_updated:1, employee_id_resolved:499, employee_id_unresolved:1501}`, HTTP 200, 21s. The earlier
  `ECONNREFUSED`/`bounce_db_set:false` was an older deployed version; v9 is clean. (Endpoint returns its
  own error — the ECONNREFUSED *was* from sync-incentive-data at curl time, since fixed.)
- ✅ **CLOSED (2026-06-27, v10): 2000-row cap.** v9 used Metabase `/query` (capped at 2000 by
  `max-results-bare-rows`). v10 switched to the export endpoint `/query/json` (POST; returns
  `[{col:val}]` not `{data:{cols,rows}}`, so parsing changed too). Verified: `rows_fetched` 2000→**20719**,
  `weeks_updated` 1→**9**. Confirms v9 was dropping ~90% of data. (The `LIMIT 50000`-in-card shortcut was
  rejected — the API cap ignores SQL LIMIT, would've stayed at 2000.) See [[metabase-full-export-endpoint]].
  - 🟡 Minor: `lookback_days:14` returned 9 weeks back to 2026-04-27 — the param likely does NOT constrain
    the Metabase fetch (card returns full history; fn buckets all into weeks). Harmless for full rebuild;
    cosmetic/misleading for incremental use.
- 🟡 **OPEN (ops, not code): name mapping.** 1501/2000 rows unresolved to employee_id (only 499 mapped via
  18 alias + 50 legacy). Leaderboard/payouts incomplete until ops maps names in the admin (`jc_name_aliases`).
- **Migration captured:** `supabase/migrations/20260620000001_incentive_identity_schema.sql`
  (`hr_employees`, `jc_name_aliases`, `backfill_employee_ids()`, `incentive_jc_log` cols) — commit `eec12bf`.
- **Edge fn v16 + 4 migrations captured** (2026-06-27): `supabase/functions/sync-incentive-data/index.ts`
  (canonical path) commit `435f4d6`; migrations `20260627000001-4` (dedup ts, rebuild RPC, frozen weeks,
  Jun15 patch) commit `d47b746`. UI tweaks (week selector in tab-nav, burn total uses stored
  `payout_amount`) commit `de40efc`.
- **Freeze timing → Thursday 12 noon IST** (2026-06-27, commit `c0c0420`,
  `20260627000005_freeze_thursday_noon_ist.sql`): `freeze_completed_weeks()` now gates on
  `week_start + 10d + 06:30 UTC`. ⚠️ **Two gaps the migration does NOT cover:**
  (a) the **cron schedule** must be moved to `30 6 * * 4` in Supabase for noon timing — not in any migration;
  (b) the incentive **freeze + weekly-rebuild crons are NOT in `supabase/cron-jobs.sql`** at all — they live
  only in Supabase. A fresh repo rebuild would have the functions but nothing scheduling them. Cowork to
  capture both crons in `cron-jobs.sql`. See [[edge-fn-deploy-via-mcp]] / [[cowork-deploys-may-diverge-from-git]].

### Commits (live, 2026-06-23 → 27): `a570de6` (portal) → … → `7e905ca` (edge fn source)
Reminder: this local `fleetpro/` is NOT a git repo — pushes go via `/tmp` clone of
`vamseebounce/vehicle-parts-check`. Cowork deploys edge fns via MCP (may diverge from git;
reconcile after — as happened with the v2→v3 CORS source).

### 2026-06-27 — Blank-page-on-logout fix + GitHub Pages cache gotcha
- **Bug:** deployment/queue/maintenance/fw-map/rsa showed a **blank white page when logged out**.
  Cause: `#perm-veil` (white overlay, z-index 8000) was only removed inside `loadAndApplyPermissions`
  (logged-in path). Logged-out → `showAuthScreen()` un-hid the auth screen (z-1000) but the veil
  stayed on top. **Fix (commit `fcda48e`):** `showAuthScreen()` now removes the perm-veil. Applied
  to all 5 affected pages. (trace-ho/jc-approval/index/incentive use the newer no-veil pattern.)
- **GitHub Pages cache gotcha:** Pages serves HTML with `cache-control: max-age=600` (10 min) and
  it's **not overridable on Pages**. After any push, users who had the old page cached see the stale
  version (need cmd+shift+R) until the 10-min cache expires. Self-resolves; not a code bug. During
  heavy iteration, expect a ~10-min "some users on old version" window per push. This is the concrete
  argument for **D1 → Vercel** (custom `Cache-Control: no-cache` on HTML = instant propagation).
  See PRODUCTIZATION-TASKS Phase 5.5.

## 🆕 2026-06-23 — JC Approval Check: context buckets + split sync fns

Extends Manual JC Approval Check (A1) from 5 → 8 lookup sections. Canonical detail in
`docs/jc-approval-context.md`; tracker `PRODUCTIZATION-TASKS.md` A1.

- **3 new context buckets** on `jc-approval.html` (superadmin lookup): Booking History
  (last 8), Ops Log (`bike_operations_log`, last 10), JC Status Log (`job_card_status_log`
  incl. DMS JC #, last 10). Plus an **In-Trip (RR) flag** + **JC Hub** on the Job Card
  section, and an **amber hub-mismatch warning** in the Bike section (JC hub ≠ bike's
  current hub).
- **Migration `20260623000001_jc_context_tables.sql`** (APPLIED via MCP): tables
  `jc_booking_history`, `jc_ops_log`, `jc_jc_status_log` (all PK `id bigint`, RLS
  auth-read/service-write); `jc_approval_status` += `intrip`, `jc_hub_name`.
- **RRR SQL** (`sql/rrr/RRR_Manual_JC_Approval_Check.sql`, outer Bounce repo) now emits
  `Intrip` + `JC Hub Name`; hub name resolves via `rental_locations.location_name`
  (there is no `public.hub` table — `hubs` is a VIEW over it). `jc-approval-sync` maps
  the two new columns.
- **Context sync split (timeout fix):** the combined `jc-context-sync` timed out
  (HTTP 546, ~26.5s) processing 3 large cards sequentially — died before the JC-status
  table. Replaced by **three single-table fns** — `jc-booking-sync`, `jc-ops-sync`,
  `jc-status-log-sync` (each = the `jc-history-sync` pattern, one hardcoded card UUID:
  c1efbecd / 98f2dc7c / b1470077, which already exist).

**⚠️ Pending deploy (Supabase MCP + Metabase UI):** deploy the 3 split fns; register 3
staggered crons (`:00` / `:05` / `:10`, every 15 min); **drop the old `jc-context-sync`
cron (job 28) + fn**; trigger the 3 fns once to populate; redeploy `jc-approval-sync`
and re-publish the jc-approval Metabase card so `Intrip` + `JC Hub Name` flow through.
Until then the 3 new sections show empty states and In-Trip / JC Hub show "—".

## 🆕 2026-06-22 — Deployment Queue Upgrade

### Metabase queries updated
- **Fleet Deployment Queue Q1 (`fea85b30`)**: added `blocked_bikes` CTE (bikes blocked for a waiting customer via `booking.id = booking.first_booking`); `bike_base` filter now includes blocked bikes; `vehicle_metrics` relaxed to include blocked bikes even without `rfd_start_dt` (defaults `rfd_age_days` to 0); `COALESCE(..., 0)` on `fifo_score` and `allotment_score` so all-zero groups show `0.000` not `—`; final WHERE allows `LOWER(rental_status) LIKE 'blocked for booking%'` regardless of `deploy_rank`.
- **Fleet Pending Bookings** (pending_bookings_cache source): added `AND b.id = b.first_booking` to exclude renewal bookings; added `AND (b.bike_id IS NULL OR LOWER(bk_cur.reg_number) NOT LIKE '%test%')` to exclude test bikes.

### `deployment.html` commits pushed 2026-06-22
| Commit | What changed |
|--------|-------------|
| `42673d3` | Stats tiles reset to zero when hub empty; allocated bikes shown in kanban (initial synthetic approach) |
| cleanup | Removed synthetic allocBikes; blocked bikes now from cache with real scores; `computeRowStatus` uses real cached score via `assigned_reg` lookup |
| `fe61f4f` | `computeRowStatus` excludes blocked bikes from `pipelineBikes` (swap suggestion vs RFD only) |
| `ef7ae05` | Real guardrail (OK/STARVATION/OVERUSE) on allocated bikes + small blue "🔵 Allocated" tag; "All Hubs" dropdown; hub tag on cards; `last_hub` localStorage; Allocate tab conditional for All Hubs |
| (auto-refresh) | 5-min `setInterval` inside `loadQueue()`; `visibilitychange` pauses/resumes |

### Deployment Queue — current behaviour (2026-06-22)
- **Pipeline**: kanban by model+tier; blocked bikes show real guardrail + Allocated tag; All Hubs shows 134 bikes.
- **Allocate**: pending customers excluding renewals and test bikes; swap suggestion uses real cache score; cross-hub suggestions suppressed in All Hubs mode.
- **Cache**: `refresh-deployment-cache` pg_cron job 6 every 15 min. Last manual trigger: 134 bikes, 55 customers, 4.1s.
- **Swap logic verified via SQL**: Indirapuram has 2 swap candidates; RR Nagar has 1; Hebbal all Fine.

## 🔎 2026-06-20 — Sync Audit (corrects the stale "PENDING DEPLOY" notes below)

Audited live DB + the real GitHub repo. Findings:

- **Local `fleetpro/.git` is an UNRELATED git history** to the production repo
  (`vehicle-parts-check`, 96 commits). No common ancestor — the local repo is an
  artifact of the FUSE-push workaround. **Source of truth = the GitHub repo only**
  (cloned to `/tmp` for pushes). Never commit to the local `fleetpro/.git`; it deploys nothing.
- **Trace & Hunter backend is LIVE**, not pending: `recovery_tickets` 346 rows,
  `recovery_tickets_cache` 346 rows (HO dashboard source populated — NOT blank).
  All 5 T&H migrations applied; 3 T&H edge fns + frontend committed & live (HTTP 200).
- **jc-approval is LIVE**: `jc_approval_status` 11,122 rows, `jc-approval-sync` cron
  succeeding every 5 min. Frontend committed + sidebar link present (superadmin-only via
  `admin-panel`/`is_superadmin` — kept that way, decision 2026-06-20). The two missing
  *source* files (migration `20260619000001_jc_approval.sql` + `functions/jc-approval-sync/`)
  were committed to the real repo this session (commit `e11f198`).
- **`zone_configs` empty** is expected, not a bug: zone-cluster runs once daily (12:35 UTC)
  AND both roster tables are empty (`roster_template`/`roster_overrides` = 0 rows).
  No roster → no hunter assignment → no zones. Roster UI is an unbuilt Phase 2 item.
- **`recovery-ticket-sync` DOES write heartbeats** (off-hours guard skips midnight–6am IST).

### 2026-06-19 — queue.html "Est. Time = 30m for every row" fixed (commit `91d39e1`, live)
- **Data-model gotcha (the durable fact):** in `oos_work_queue`, the edge fn writes
  `labour_mins == estimated_mins` (both = Metabase `"Est. Time (mins)"`), and the source SQL's
  `estimated_mins` already includes **+60 min when parts are involved** (`RRR_Sheet10_OOS_Work_Queue.sql`).
  So the frontend must render `estimated_mins` **as-is** — do NOT add any per-row overhead, and do NOT
  read a bare `labour_mins` (it isn't the display value). The old `estMins` did `(r.labour_mins||0)+30`
  while never selecting `labour_mins`, so every row collapsed to a flat 30m. `estMins` now uses
  `estimated_mins` (fallback `labour_mins`, then 30 only for no-work rows) and drives per-row, Cumul.,
  the Est. Total hero stat, and CSV export. Cumul. is recomputed client-side so hub-filtered views stay correct.

### 2026-06-22 — Stale-clone trap (Cowork) + multi-window framework
- **Incident:** Cowork computed "what's in sync" from a `/tmp/fleetpro-push` clone that was
  15 commits behind, falsely reporting 5 files as unpushed. Pushing from it would have
  REVERTED real commits. Recovered by re-cloning fresh. **Rule (now in COWORK-PRIMER):
  always delete + re-clone `/tmp/fleetpro-push` before any push or sync-check — never reuse.**
- **Live HEAD verified `d4e7265`.** Everything (T&H, jc-approval, doc reconciliation) is pushed
  and in sync; local == Cowork == repo, all locks free.
- **Framework for every window/session:** machine-global `~/.claude/CLAUDE.md` (loads in every
  Claude Code session), per-dir `CLAUDE.md` + Stop hook, `LOCKS.md` protocol, and
  `../START-HERE.md` (paste-prompts: START on open, END on close). Cowork bridged by
  `../docs/COWORK-PRIMER.md` (it can't auto-load CLAUDE.md).

### 2026-06-22 — Deployment Queue (deployment.html) iteration
Commits 42673d3 → b512a21 (all live). Net behaviour:
- **Allocated bikes** now read from `deployment_queue_cache` directly (real `allotment_score` /
  `guardrail`, detected via `rental_status` starts-with `'blocked for booking'`). The earlier
  synthetic `allocBikes`-from-`pending_bookings_cache` approach + `computeApproxScore()` were removed.
- Cards show the **real guardrail** (OK/STARVATION/OVERUSE) plus a small blue 🔵 Allocated tag.
- `computeRowStatus` excludes blocked bikes from the "better option" pipeline comparison.
- **"All Hubs" view** (`value='all'`): conditional hub filter in `loadQueue` + `loadAllocList`,
  📍 hub tag on cards, saved hub in `localStorage('last_hub')` (default `all`). Edge case: the
  Allocate "better option" suggestion returns null in all-hubs mode (no cross-hub suggestions — intentional).
- **5-min auto-refresh** armed inside `loadQueue()`; pauses on tab-hidden, refreshes+rearms on visible.
- Dead code left in place (out of scope): `computeBikeTier()` now unused.

**PENDING (not done this session):** Metabase card `fea85b30` `fifo_score`/`allotment_score`
COALESCE fix — must be applied in the Metabase UI (not repo-editable). Local source-of-record
`sql/fleet/Fleet_Deployment_Queue.sql` already fixed (outer repo, uncommitted). After the card is
fixed, trigger `refresh-deployment-cache` to rebuild scores.


## 🏗 Architecture Roadmap (session 5)
- `ARCHITECTURE-PROPOSAL.md` created at repo root — 6-phase productization roadmap (PROPOSAL ONLY, nothing executed)
- Phases: 0 git/migrations → 1 security (RLS+single auth) → 2 data model (upsert + ticket_events) → 3 Vite shared lib → 4 staging+CI → 5 observability → 6 multi-city
- Execution happens in the OTHER window (Sonnet); execute phases in order; see §6 "Execution notes" + verify-first list in the proposal
- 5 open decisions (D1–D5) in proposal §5 need Vamsee's call before execution: hosting, staging type, TS scope, Metabase dependency, realtime strategy
- Verified this session: fw_bikes_live exposes rider_phone via anon REST; tech.html line 673 updates rsa_tickets_cache directly from client; RSA_EMAILS allowlist client-side at fw-map.html:736; admin secret NOT hardcoded in admin-techs.html (user-entered) but is plaintext in this file
- Added §7 "Phase 2½ ML data foundation" to proposal: bike_telemetry_history, ticket_status_history, fw_pending_history, vehicles dim table, Parquet archival tiering — because Vamsee wants predictive systems later and current pipeline overwrites all history (bike_location_cache latest-only every 5 min)

> **Session rules:** Use grep/sed instead of reading full files. Keep bash output minimal. All changes go in `/Bounce/fleetpro/`. RRR is a separate project — ignore it in this window.
> **At session end: update this file with any changes.**

---

## 🔑 Source of Truth (verified 2026-06-16 from live DB)

### Groups & Features (live from group_features table — updated 2026-06-28)
| Group | Features |
|-------|----------|
| Admin | fw-map, rsa-warroom, tech-app, maintenance, oos-queue, deployment, trace-ho, trace-hunter, incentive-admin, incentive-tech, admin-panel |
| Default Users | maintenance, oos-queue, deployment (techs removed from this group 2026-06-28) |
| RSA Field Team | fw-map, tech-app |
| RSA Warroom | fw-map, rsa-warroom |
| FPI Hunter | trace-hunter |
| FPI Admin | trace-ho, trace-hunter |
| Incentive Tech | incentive-tech |
| Incentive Admin (dd57c013) | incentive-tech, incentive-admin |

**`admin-panel`** now in Admin group (added 2026-06-28). Also granted to superadmins via `app_metadata.is_superadmin=true`. Only `vamsee@bounceshare.com` has the superadmin flag.

### Feature Key → Page/Capability
| Feature key | Gates |
|-------------|-------|
| `fw-map` | fw-map.html, sidebar link |
| `rsa-warroom` | rsa.html, sidebar link |
| `maintenance` | maintenance.html, sidebar link, tile |
| `oos-queue` | queue.html, sidebar link, tile |
| `deployment` | deployment.html, sidebar link, tile |
| `tech-app` | tech.html (RSA technician PWA) |
| `export-data` | future export feature |
| `all-cities` | pan-India view in fw-map/rsa |
| `admin-panel` | admin-techs.html, admin-permissions.html, sidebar Admin section, Settings danger zone |

### Group Memberships (live)
| Group | Members |
|-------|---------|
| Admin | vamsee@bounceshare.com, vamsee@scalability.club, cheekoti.manideep@bounceshare.com, jagadishcp@bounceshare.com, nithish@bounceshare.com |
| RSA Field Team | nishanthshetty2024@gmail.com, pavanmahesh120@gmail.com, sreeranga100@gmail.com |
| RSA Warroom | sreeranga@bounceshare.com, venkatesh.r@bounceshare.com, nabina.behera@bounceshare.com |
| Default Users | All other signed-up users (auto-assigned by trigger) |

**Superadmin:** `vamsee@bounceshare.com` — `app_metadata.is_superadmin=true`, group assignments cannot be changed via admin-permissions fn (returns 403). `vamsee@scalability.club` is a regular Admin group member (no superadmin flag).

### Table Columns (live schema)
| Table | Columns |
|-------|---------|
| `rsa_tickets_cache` | ticket_number (PK), status, category, reg_number, technician_name, fault_details, created_at_ist, inprogress_at_ist, resolved_at_ist, tat_minutes, synced_at, city, lat, lng, bass_location_time_ist, live_lat, live_lng, **customer_name, customer_phone** (added 2026-06-30, commit `2d48ba5`) |
| `bike_location_cache` | id, chassis_number (unique), reg_number, lat, lng (resolved best), baas_location_time, current_soc, vehicle_status, synced_at, **baas_lat, baas_lng, intellicar_lat, intellicar_lng, intellicar_location_time, best_source** (added 2026-07-01 via SQL — no migration yet) |
| `bike_rider_cache` | chassis_number (PK), rider_name, rider_phone, synced_at |
| `fw_pending_cache` | chassis_number (PK), hub, reg_number, synced_at |
| `sync_heartbeats` | id, function_name, status, duration_ms, rows_affected, error_message, synced_at |
| `user_groups` | id, user_id, group_id |
| `groups` | id, name, description, created_at |
| `group_features` | id, group_id, feature_key |
| `rsa_technicians` | id (=auth.users.id), name, email, phone, is_active, created_at |
| `rsa_tech_actions` | id, ticket_number, technician_id, technician_name, technician_email, action, resolution_type, notes, evidence_urls[], created_at |
| `rsa_team_locations` | id, name, chassis, reg_number, lat, lng, synced_at — partitioned by month |
| `rsa_ticket_locations` | id, ticket_number, status, lat, lng, synced_at — partitioned by month |
| `ticket_status_history` | id, ticket_number, old_status, new_status, changed_at, synced_at |
| `app_settings` | key (PK), value, updated_at |
| `vehicles` | chassis_number (PK), reg_number, model, city, created_at, updated_at |

### D-Decisions Log
| ID | Decision | Status |
|----|----------|--------|
| D6 | Next.js vs Vite for Phase 3 | ✅ **Vite** (session 14) — static output, GitHub Pages compatible, no server needed |

---

## Git / GitHub (set up session 6)

- **Repo:** https://github.com/vamseebounce/vehicle-parts-check
- **Branch:** `main` → GitHub Pages → bounceops.online
- **PAT:** never stored in any file. Pass inline to the clone URL only, then scrub. (The
  old leaked token in the deleted phantom `.git/config` was retired 2026-06-20 — rotate before next push.)
- **Push workflow (2026-06-20 onward):** the mounted `fleetpro/` folder is NO LONGER a git repo
  (phantom local `.git` deleted — it was an unrelated history that deployed nothing). To deploy:
  `git clone https://<PAT>@github.com/vamseebounce/vehicle-parts-check.git /tmp/fleetpro-push`,
  copy changed files in, `git add/commit/push origin main` from `/tmp`, then scrub the token + `rm -rf /tmp/fleetpro-push`.
  This GitHub repo is the SINGLE source of truth — there is no longer any local git history to drift from.
- **Rollback tags:** `phase-0.0`, `v8-final`, `phase-0.3`, `phase-0.4`, `phase-0.5`, `phase-0.6`, `phase-2half-additive` (vehicles, sync_heartbeats, fw_pending_history), `phase-2half-additive-2` (ticket_status_history)
- **Latest commits (session 11):** fa2f545 (2.6 partition), e574773 (2.7 archival), bbe4d29 (vault fix)
- **Latest commits (session 14):** 27e9759 (perm-veil all 5 pages), 32c5117 (Realtime→polling), 146d5c4 (5.2 heartbeats wired to all 7 edge fns), fdb1dc3 (5.3 health-check reads sync_heartbeats)
- **Task tracker:** `PRODUCTIZATION-TASKS.md` in repo root — 47 tasks across Phase 0–6 + Phase 2½
- **.gitignore:** excludes `.DS_Store`, `v6/`, `v7/`, `archive/`, `*.lock`

### Phase 0 status (paused here)
| Task | Status |
|------|--------|
| 0.0 Push v8 to GitHub | ✅ `phase-0.0` |
| 0.1 Tag v8-final | ✅ `v8-final` |
| 0.2 Move v6/v7 to archive/ | ✅ gitignored |
| 0.3 Capture all 13 edge fns → supabase/functions/ | ✅ `phase-0.3` |
| 0.4 DB dump → baseline migration | ✅ `phase-0.4` |
| 0.5 Cron job definitions → supabase/cron-jobs.sql | ✅ `phase-0.5` |
| 0.6 README | ✅ `phase-0.6` |

## Window Split
- **RRR window** → Analysis, SQL queries, RRR project work
- **Fleetpro window** → All HTML/code, Supabase schema, crons, deployments

---

## Current Status

**v8 is latest.** All files in `/Bounce/fleetpro/v8/`. Push all to GitHub.

---

## 🟡 Pending Issues

### 0. ✅ FIXED (session 6): rsa-ticket-sync cron dead since June 9 — RESOLVED
- pg_cron job 13 (`rsa-ticket-sync-2min`): 1,299 consecutive failures, "job startup timeout", 0 successes
- rsa.html data only fresh via users clicking Refresh (manual edge fn calls work fine — Metabase card f79c5050 alive, 45 tickets synced 12:48 UTC June 11)
- Suspected cause: job 13 command has over-escaped headers JSON (`\\\"` doubled) vs working job 11 — likely bad edit during June 9 fw-sheet-sync 401 fix session
- Fix applied 2026-06-12: unscheduled job 13, recreated as job 17 with clean escaping (no auth headers, verify_jwt=false). First run succeeded at 20:10 UTC.
- Side effects while down: rsa_ticket_locations trails + edge-fn team tracking not appending (rsa-team-track-2min SQL job unaffected, healthy)
- Also confirmed: Supabase/Fleetpro CANNOT delete Metabase tables — edge fn only GETs a public card URL, holds no Metabase credentials (Vamsee saw a Tickets table removed in Metabase; cause is upstream, not this project)

### 1. Historical data null lat/lng + null city
- Tickets synced before edge fn v9 (old card 6f11e26e) have null city/GPS
- Fix: select date range in rsa.html + click Refresh → edge fn v9 re-syncs with Bass_Lat/Bass_Lng/city from card f79c5050
- Known gap: BT-3763 (HYD, June 9) missing — re-sync 09/06-10/06 to recover it

### 2. rsa_ticket_locations and rsa_team_locations empty
- Both tables have 0 rows — no open tickets existed during a v9 cron run yet
- Will self-populate once a NEW/IN_PROGRESS ticket is active and cron fires
- Team locations need Nishanth/Pavan chassis to be active in bike_location_cache

### 3. fw-sheet-sync 401 — FIXED ✅
- Root cause: pg_cron job (id=10) called edge fn with no Authorization header, but fn has verify_jwt=true
- Fix: updated cron job command to include Authorization + apikey headers (anon key)
- Gotcha: bike-location-sync + fw-map-rider-sync have no auth in cron but work fine — those fns have verify_jwt=false

### 4. tech.html PWA install not working on Android
- "Add to Home Screen" creates shortcut instead of standalone PWA
- Manifests updated with scope/id/proper icons — push to GitHub + retest
- `beforeinstallprompt` not firing — Install App button added as fallback

### 5. Supabase egress outage (resolved)
- June 11: hit 402% egress (20GB/5GB), Supabase returned 546 for all edge fns
- Fix: upgraded to Pro ($25/mo, 250GB egress)
- All crons recovered after upgrade

---

### Files in v8 (latest)
| File | Key changes |
|------|-------------|
| `fw-map.html` | unchanged from v7 |
| `index.html` | unchanged from v7 |
| `maintenance.html` | unchanged from v7 |
| `queue.html` | unchanged from v7 |
| `deployment.html` | unchanged from v7 |
| `rsa.html` | Session 4: timestamp fix (parseUtcTs), negative TAT shows '--', PWA manifest added |
| `tech.html` | **NEW** — Technician PWA (Supabase auth, ticket view, GPS nav, complete+evidence) |
| `tech-manifest.json` | PWA manifest for tech.html |
| `tech-sw.js` | Service worker for tech.html |
| `rsa-manifest.json` | PWA manifest for rsa.html |
| `rsa-sw.js` | Service worker for rsa.html |
| `admin-techs.html` | **NEW** — Admin panel: create/manage tech accounts, view actions log. Session 7: role dropdown added (tech/ops/admin) |
| `admin-permissions.html` | **NEW (session 7)** — Groups×Features + Users×Groups permission matrix manager |
| `index.html` | Session 7: data-feature attributes on FW Map + RSA tiles; loadUserPermissions + applyTilePermissions wired |

---

## RSA Warroom (rsa.html)

### What it does
Live ops map for RSA (Roadside Assistance) tickets. Central team monitors open tickets across cities, tracks RSA technician locations, filters by status/TAT/city/zone.

### Data pipeline
```
Metabase (card f79c5050, last 30 days) → rsa-ticket-sync edge fn (v23) → rsa_tickets_cache → rsa_tickets_live view → rsa.html
```
- **Today**: Polls every 30s (replaced Realtime subscription — session 14). `rsa_tickets_cache` and `rsa_team_locations` removed from `supabase_realtime` publication.
- **Historical**: user picks date range → edge fn syncs → polls until fresh data appears
- **Live location**: edge fn enriches open (NEW/IN_PROGRESS) tickets with live GPS from bike_location_cache → stored as live_lat/live_lng
- **Movement tracking**: every 2-min cron appends open ticket locations to rsa_ticket_locations + RSA team locations to rsa_team_locations

### Layout (3 rows)
1. **Global bar** (blue tint): City dropdown + From/To date + Refresh + sync status
2. **Tiles**: NEW · IN PROGRESS · DONE · Avg Closure TAT · Avg Response TAT · RSA >1hr % — scoped to City+Date only (ignore map filters)
3. **Map filters**: Zone · Status · TAT · Assigned + Search (right-aligned) — affect map only

### Features
- Default load: City=BLR, Status=NEW+IN_PROGRESS (hides DONE), today's date
- Map pins use `display_lat`/`display_lng`: open tickets → live GPS; DONE → Bass snapshot
- **Tile click**: flash matching pins on map for 5s with coloured ring (city-filtered, no pan-India jump)
- **Search**: zooms to matching reg/ticket in filtered set, amber ring flash for 2s
- **⊙ Recenter**: snaps map back to current city selection
- **🛤 Track panel** (slide-in right):
  - *RSA Team tab*: pick person + date range → polyline trail with start/end markers
  - *Ticket tab*: enter ticket number → dashed trail with grey pins, status-change labels
- **Popup actions**: 📍 Directions (Google Maps link) · 📋 Copy loc (coords to clipboard) · 🛤 Track
- **Popup fields (2026-06-30)**: ticket_number, status, reg+city, **customer_name + customer_phone** (tappable tel: link), category, fault_details, technician, timestamps, TAT. `customer_name`/`customer_phone` added to `rsa_tickets_cache` table + edge fn v23 + SELECT query in rsa.html (commit `2d48ba5`).
- Zone shading: selecting North/South draws light indigo rectangle over that half
- Hub icons: logo.jpg (same as fw-map)
- Realtime: subscribed to `rsa_tickets_cache` (event:'*'); 3s debounce → clean re-fetch from view (not payload patch — avoids accumulation bug)
- Fallback poll: 5-min interval, only fires if `_lastRealtimeUpdate` > 5 min ago
- RSA team location: refreshes every 2 min (matches cron cadence)

### Filters logic
- All checkboxes selected in a group → `getChecked()` returns `[]` → treated as "no filter"
- Zone filter uses `display_lat` (respects live GPS for open tickets)
- `inferCity(t)`: uses t.city if set, else infers from lat/lng bounds, defaults to 'BLR'
- `flashStatus(status, color)`: respects current city filter (no cross-city jumps)
- Date range: max 30 days; `date-to` min/max enforced in picker and code
- Map fit: only refits when city selection changes (`_lastCitySel` guard); status/TAT/assigned changes don't move map

---

## Technician PWA (tech.html)

### Auth
- Supabase email/password. Admin creates accounts via `admin-techs.html`.
- Edge fn `admin-create-tech` (verify_jwt=false, protected by `x-admin-secret` header).
- **IMPORTANT**: Set `ADMIN_SECRET=<your-secret>` in Supabase dashboard → Edge Functions → admin-create-tech → Secrets. Same secret goes in admin-techs.html unlock screen.

### Flow
1. Tech logs in with email/password
2. Profile fetched from `rsa_technicians` (name must match `technician_name` in rsa_tickets_cache)
3. Active tickets shown (NEW/IN_PROGRESS assigned to tech)
4. Actions: On My Way, On Site, Mark Complete (with resolution type + notes + photos/videos)
5. Evidence uploaded to `rsa-evidence` Supabase Storage bucket
6. Mark Complete also writes `status='DONE'` to `rsa_tickets_cache` (overwrites until next cron)

### New Supabase Objects
| Object | Type | Notes |
|--------|------|-------|
| `rsa_technicians` | Table | id (=auth.users.id), name, email, phone, is_active |
| `rsa_tech_actions` | Table | ticket_number, technician_id, action, resolution_type, notes, evidence_urls[] |
| `rsa-evidence` | Storage bucket | photos/videos, 50MB limit, authenticated upload only |
| `admin-create-tech` | Edge fn | create/deactivate/reset_password/list/set_role — protected by ADMIN_SECRET. v5: sets app_metadata.role (admin/ops/tech) on create |
| `groups` | Table | 4 groups: Admin (5 members), RSA Field Team (3), RSA Warroom (3), Default Users (0, auto-assigned on signup) |
| `group_features` | Table | group_id → feature_key. Feature keys: fw-map, rsa-warroom, tech-app, admin-panel, export-data, all-cities, maintenance, oos-queue, deployment |
| `user_groups` | Table | user_id → group_id. RLS: authenticated users read own row only. group_features/groups: authenticated read all. |
| `login_events` | Table | Append-only login log. `user_last_login` view = DISTINCT ON(user_id) most recent. fw-map writes on SIGNED_IN. |
| `assign_default_group()` | Trigger fn | AFTER INSERT ON auth.users → auto-adds to Default Users group. Looks up by name, not UUID. |
| `admin-permissions` | Edge fn | Protected by Login_key. list_groups, list_users, toggle_user_group, toggle_group_feature, create_group, delete_group. |
| `admin-permissions.html` | Page | Tab 1: Groups×Features matrix. Tab 2: Users×Groups matrix. Live checkbox toggles. |

**Permission system bug (session 10 — FIXED):** user_groups/group_features/groups had RLS enabled with ZERO SELECT policies → authenticated users got empty results → loadUserPermissions returned null → fpCan=false → signOut for all DB-group users. Fixed by adding SELECT policies (migration 20260614000004).

**enforce12hReauth fix (session 10):** Added `if(fpCan('fw-map'))return` bypass so DB group members skip 12h check. Also writes login_events on SIGNED_IN so timestamp stays fresh.

**Tile gating (session 10):** maintenance, oos-queue, deployment tiles gated by data-feature in index.html. RSA Field Team and RSA Warroom don't have these → tiles hidden. Admin + Default Users have them.

**Current user→group assignments:**
- Admin: vamsee@bounceshare.com, vamsee@scalability.club, cheekoti.manideep@bounceshare.com, jagadishcp@bounceshare.com, nithish@bounceshare.com
- RSA Field Team: nishanthshetty2024@gmail.com, pavanmahesh120@gmail.com, sreeranga100@gmail.com
- RSA Warroom: sreeranga@bounceshare.com, venkatesh.r@bounceshare.com, nabina.behera@bounceshare.com
- Pending (not yet signed up): jaikumar.jayachandran@bounceshare.com → add to Admin once they sign up

---

## New Tables (session 6 — Phase 2½ + 5.1)

| Table | Purpose | Notes |
|-------|---------|-------|
| `vehicles` | Dimension table: one row per chassis (reg, model, city) | ML training anchor. Empty — needs backfill from bike_location_cache |
| `sync_heartbeats` | One row per edge fn run (status, duration_ms, rows_affected). **`status` CHECK = only `'success'`/`'failure'`** — writing `ok`/`warn`/`error` makes the INSERT silently fail. | **✅ Session 14: original 7 fns wired. 2026-07-01: 3 T&H fns fixed (had been writing ok/warn/error → 0 rows).** |
| `fw_pending_history` | Daily snapshot of fw_pending_cache (chassis, hub, reg) | Cron `fw-pending-daily-snapshot` runs 18:25 UTC (23:55 IST) daily |
| `ticket_status_history` | Immutable log of every ticket status transition | Trigger `trg_ticket_status_history` on rsa_tickets_cache INSERT/UPDATE |

---

## Supabase Objects

### Tables
| Table | Rows | Purpose |
|-------|------|---------|
| `fw_pending_cache` | ~1,318 | FW-pending bikes from Google Sheet (full refresh every 15 min) |
| `bike_location_cache` | ~9,812 | All bike GPS locations (5-min cron) |
| `bike_rider_cache` | ~9,795 | Rider name+phone (hourly cron) |
| `rsa_tickets_cache` | ~58/day | RSA tickets + customer_name + customer_phone (added 2026-06-30). Full cols: ticket_number, status, category, reg_number, technician_name, fault_details, created_at_ist, inprogress_at_ist, resolved_at_ist, tat_minutes, city, synced_at, lat, lng, bass_location_time_ist, live_lat, live_lng, customer_name, customer_phone |
| `rsa_team_locations` | append-only, **partitioned by month on synced_at** | Nishanth/Pavan GPS trail. PK: (id, synced_at). Partitions: _2026_06, _2026_07, _default. Old table kept as rsa_team_locations_old. |
| `rsa_ticket_locations` | append-only, **partitioned by month on synced_at** | Per-ticket bike movement trail for open tickets. PK: (id, synced_at). Same partition structure. Old table kept as rsa_ticket_locations_old. |
| `partition_archive_log` | archive log | One row per archived partition: table_name, partition_name, row_count, file_bytes, storage_path, archived_at |
| `rental_locations` | 15 | Bounce hub locations (NCR only, city_id=1) — BLR/HYD hub data not yet imported |
| `oos_work_queue` | 570 | OOS job queue |
| `dms_jc_history` | — | Job card history |
| `vehicle_parts_check_flag` | 10,563 | Maintenance check data |

### Views
| View | Purpose |
|------|---------|
| `fw_bikes_live` | fw_pending_cache ⨝ bike_location_cache ⨝ bike_rider_cache — 1,366 FW-pending bikes with location+rider |
| `rsa_tickets_live` | rsa_tickets_cache — adds `display_lat`/`display_lng`: DONE→Bass snapshot (lat/lng), NEW/IN_PROGRESS→COALESCE(live_lat, lat) |
| `hubs` | rental_locations WHERE status='active', exposes id/location_name/lat/lng/address/short_address/dms_code/city_id |

### Edge Functions
| Function | Schedule | Purpose |
|----------|----------|---------|
| `bike-location-sync` | `*/5 * * * *` | **v9 (2026-07-01):** Metabase card `18f2864d` → bike_location_cache. Dual-source GPS: picks fresher of BaaS vs Intellicar timestamps; writes resolved lat/lng + raw baas_lat/lng + intellicar_lat/lng/ts + best_source. |
| `fw-sheet-sync` | `*/15 * * * *` | Google Sheet → fw_pending_cache (full refresh, delete+insert) |
| `fw-map-rider-sync` | `0 * * * *` | Metabase → bike_rider_cache (hourly) |
| `rsa-ticket-sync` | `*/2 * * * *` | **v9** (verify_jwt=false, CORS headers). Per run: (1) fetch Metabase card f79c5050, (2) enrich open tickets with live GPS from bike_location_cache → live_lat/live_lng, (3) delete+reinsert rsa_tickets_cache, (4) append open ticket locations to rsa_ticket_locations, (5) append RSA team locations to rsa_team_locations. Accepts start_date/end_date for historical re-sync. Dedup: 100s. |
| `rsa-history` | on-demand | Proxy for RSA historical Metabase fetch (likely unused now) |
| `archive-location-partition` | called by pg_cron job 19 | Reads a stale location partition, exports as Apache Arrow IPC (.arrow) to `location-archives` Supabase Storage bucket, then drops the partition. Auth: `ARCHIVE_CRON_SECRET` header (set in edge fn secrets ✅ + vault ✅). |

### pg_cron Jobs (all active)
| Job ID | Name | Schedule | What it does |
|--------|------|----------|--------------|
| 1 | metabase-hourly-sync | `0 * * * *` | vehicle_parts_check_flag |
| 2 | OOS_QUEUE-hourly | `5 * * * *` | oos_work_queue |
| 6 | refresh-deployment-cache | `*/15 * * * *` | deployment + pending_bookings |
| 7 | jc-history-daily-sync | `30 20 * * *` | jc_history (02:00 IST) |
| 9 | fw-map-rider-sync-10min | `0 * * * *` | bike_rider_cache (hourly) |
| 10 | fw-sheet-sync-15min | `*/15 * * * *` | fw_pending_cache |
| 11 | bike-location-sync-5min | `0 * * * *` | bike_location_cache |
| 14 | rsa-team-track-2min | `*/2 * * * *` | rsa_team_locations (pure SQL) |
| 16 | health-egress-daily | `0 3 * * *` | egress+health alert (08:30 IST) |
| 17 | rsa-ticket-sync-2min | `*/2 * * * *` | rsa_tickets_cache + trails (replaced job 13) |
| 18 | create_monthly_location_partitions | `0 0 25 * *` | pre-creates next month's location partitions |
| 19 | archive-old-location-partitions | `0 2 1 * *` | archives + drops partitions >90 days (via edge fn) |

### PostGIS Functions
| Function | Purpose |
|----------|---------|
| `get_ticket_trail_km(ticket_number text)` | Total km bike moved during ticket lifecycle (from rsa_ticket_locations) |
| `get_team_trail_km(name text, from timestamptz, to timestamptz)` | Total km covered by RSA team member in time window |
| `get_rsa_summary()` | Aggregate metrics (unused — metrics now client-side) |

### PostGIS
- Extension enabled on project
- `rsa_ticket_locations.location` and `rsa_team_locations.location` are `geography(Point, 4326)`
- Trigger `set_location_from_latlong()` auto-populates geography from lat/lng on every insert
- GIST spatial indexes on both tables
- `rsa_tickets_cache` **removed from** `supabase_realtime` publication (session 14 — replaced with 30s polling)

---

## RSA Team Bikes (GPS tracked)
| Name | Chassis | Reg | Contact | Status |
|------|---------|-----|---------|--------|
| Nishanth | P6EBE1JYK25000288 | KA05AR5056 | — | internal use — in bike_location_cache |
| Pavan | P6EBE1JYK25000072 | KA05AR3238 | — | internal use — in bike_location_cache |
| Bhoja | P6EBE1JYH25000416 | KA05AR0387 | 8660362696 | added 2026-06-30 — in bike_location_cache |

Both have 7-day session (no 12h reauth) in fw-map.html. RSA_EMAILS kept in fw-map.html as fallback only — primary auth is now DB-driven via user_groups → group_features. Both are assigned to RSA Field Team group in user_groups.

---

## Egress Status
- June 11: hit 20GB/5GB (402%) → Supabase applied 546 errors → **upgraded to Pro** ($25/mo, 250GB egress)
- Root cause: fw-map fetching 9,812+9,795 rows every 1 min (fixed with fw_bikes_live view + 5-min interval)
- RSA page egress: ~109 MB/month
- Now on Pro — no egress restriction

## Observability
- Daily health check scheduled via Cowork at 8:00 AM IST
- Checks: cron last run (>10min=WARN, >30min=FAIL), DB reachable, tickets today, open tickets
- Task ID: `fleetpro-health-check` in Cowork Scheduled sidebar
- **Egress alert (task 5.6):** `health-check` fn updated — calls Supabase Management API (`MGMT_TOKEN` secret) daily via pg_cron job 16 (03:00 UTC / 08:30 IST). Emails `vamsee@bounceshare.com` if egress ≥ 70% (175 GB of 250 GB). Also emails on DB health failure.
- **Phase 5.3 (session 14):** `health-check` fn now reads `sync_heartbeats` — reports latest status, minutes_since, duration_ms, rows_affected per function. Flags stale (per-function thresholds: rsa-ticket-sync/bike-location-sync=5m, fw-map-rider-sync/fw-sheet-sync/refresh-deployment-cache=35m, jc-history-sync/metabase-sync=65m) and erroring syncs. Sends alert email if any problems found.

---

## Permission System (session 7)

### Groups & Feature Keys
| Group | Features |
|-------|----------|
| Default | (none — can see everything except fw-map and rsa-warroom) |
| RSA Field Team | fw-map, tech-app |
| RSA Warroom | fw-map, rsa-warroom |
| Admin | all 6 features |

Feature keys: `fw-map` · `rsa-warroom` · `tech-app` · `admin-panel` · `export-data` · `all-cities`

### How it works
- `loadUserPermissions(userId)` — queries `user_groups` → `group_features` → returns `{key:true}` map, or `null` if user has no groups (null = fallback to legacy RSA_EMAILS in fw-map, show-all in index.html)
- `applyTilePermissions(features)` in index.html — hides `[data-feature]` elements whose key is absent from features map
- `fpCan(key)` in fw-map.html — checks `window.FP_FEATURES` for access gate
- Superadmin (`vamsee@bounceshare.com`): `app_metadata.is_superadmin=true`, cannot be modified by admin-permissions fn (403 returned)
- `window.FP_FEATURES` global — set after login, available for any page-level feature check

### index.html tile gating
- `data-feature="fw-map"` on FW Pending Map tile + sidebar link
- `data-feature="rsa-warroom"` on RSA Warroom tile + sidebar link
- Elements with missing feature are set to `display:none` — design unchanged, tiles simply disappear
- Existing session: optimistic show → load permissions async → hide if no access
- Fresh sign-in: await permissions before applying tile visibility

### Admin tools
- `admin-permissions.html` — manage groups/features/users via checkbox matrices
- Login_key rotated session 7 to `Hatric1@3` (stored in Supabase env, never in code)

---

## Key Gotchas
1. `rental_locations` has 15 rows (NCR hubs, city_id=1, status=active) — BLR/HYD hub data not yet imported. BLR/HYD bikes at Mark Found will get no hub_id (distance guard rejects >75km matches)
2. RSA city codes from Metabase: `BLR`, `NCR` (Delhi). `HYD` filter ready; no HYD tickets yet.
3. Metabase date params don't work via URL query string — edge fn fetches ALL tickets, filters by `Created_at_IST` in Deno
4. `_syncLock` in fw-map.html prevents edge fn call pile-up (Metabase takes 30-60s)
5. Timestamps from Supabase come as `"2026-06-09 14:15:57+00"` — strip `+00` before treating as UTC
6. fw-sheet-sync: old approach was upsert-only (stale bikes stayed). Now: delete range + insert.
7. GitHub Pages deployment warning (Node.js 20 deprecated) — self-resolves June 16, 2026
8. `inferCity(t)`: uses t.city first, then lat/lng bounds inference, defaults to 'BLR' — tickets with null city/GPS always appear under BLR filter
9. Realtime removed (session 14) — rsa.html polls every 30s; deployment.html polls every 60s for global logout. `rsa_tickets_cache` + `rsa_team_locations` dropped from supabase_realtime publication.
10. `rsa_team_locations` and `rsa_ticket_locations` now have RLS **enabled** (authenticated SELECT) — added when partitioned in session 11. Edge fn inserts work (service role bypasses RLS).
10a. **Partition PK gotcha:** PK is now `(id, synced_at)` — not just `(id)`. Any future `ON CONFLICT (id)` will fail. Both tables use plain INSERT (no upsert on id), so this is safe today.
11. `rsa_team_locations` now populated by dedicated pg_cron job `rsa-team-track-2min` (pure SQL, no edge fn dependency)
12. `rsa_ticket_locations` populates when open NEW/IN_PROGRESS tickets exist during edge fn v11 cron run
13. Track panel shows "No trail yet" message if `rsa_ticket_locations` empty for that ticket — not an error
18. `parseUtcTs(ts)` — shared parser in rsa.html that handles `+00` (2-digit offset), `+05:30`, `Z`. Old regex `[+-]\d{2}:?\d{2}` didn't match `+00` → fixed to `[+-]\d{2}(?::?\d{2})?`. Both `fmtTime` and `tatMins` now use this.
19. Negative TAT (`tatMins` returns <0) → `fmtTat` shows `--` — happens when Metabase reports future-dated `created_at_ist` (data issue, not code bug)
12. `fmtTime(ts)` strips timezone, adds 'Z', converts UTC→IST with `timeZone:'Asia/Kolkata'` — safe for all timestamp columns
13. All timestamp columns (`created_at_ist`, `inprogress_at_ist`, `resolved_at_ist`, `synced_at`, `bass_location_time_ist`) stored as UTC in Supabase — `_ist` suffix is Metabase naming convention, not storage format
14. Popup buttons: 📍 Copy map link (copies `https://maps.google.com/?q=lat,lng`) + 🛤 Track (no Directions button)
15. `flashStatus(status, color)` respects city filter — uses `globalFiltered` not `_all`
16. `resetTiles()` called on date change and Refresh — prevents stale count flash from previous date range
17. `computeMetrics`: RSA >1hr% divides by DONE tickets only (not all); Avg Response TAT filters diffs <0 or >600 min
10. `flashStatus()` must use `globalFiltered` (city-scoped), NOT `_all` — otherwise clicking DONE in BLR shows pan-India view
11. Edge fn v9 is the current deployed version. Previous versions: v7=verify_jwt fix, v8=live_lat+team tracking, v9=ticket trail tracking

---

## Live URLs
- bounceops.online → redirects to v8/index.html (FleetPro hub, magic link auth)
- bounceops.online/v8/fw-map.html → FW Flash Map (restricted allowlist)
- bounceops.online/v8/rsa.html → RSA Warroom
- bounceops.online/v8/tech.html → Technician PWA (Supabase auth, email/password)
- bounceops.online/v8/admin-techs.html → Tech admin panel (unlock: Login_key secret from Supabase env)
- bounceops.online/v8/admin-permissions.html → Permission matrix manager (same Login_key secret)
- bounceops.online/v8/maintenance.html, /queue.html, /deployment.html
- bounceops.online/v8/trace-ho.html → **Trace & Hunter HO Dashboard** (trace-ho feature)
- bounceops.online/v8/trace-hunter.html → **FPI Hunter PWA** (trace-hunter feature, installable)
- All v8/ assets in git including logo.jpg (was missing, restored session 6)

## Supabase
- Project ID: `clkfvmmlgwcvntxnolsv` (Tokyo, ap-northeast-1)
- Plan: **Pro** ($25/mo, 250GB egress) — upgraded June 11, 2026
- Anon key in all HTML files
- Admin edge fn secret: env var `Login_key` — value stored in Supabase dashboard only (Task 1.1: rotate before sharing URLs wider)

---

## 🆕 Trace & Hunter — Phase 1 (sessions 15–16, completed 2026-06-18)

### Overview
Standalone FPI recovery ops product inside the FleetPro shell. **Purely additive — zero existing tables/features touched.**

### Groups & Feature Keys Added
| Group | Feature Keys | Purpose |
|-------|-------------|---------|
| FPI Hunter | `trace-hunter` | Ground agents — Hunter PWA |
| FPI Admin | `trace-ho`, `trace-hunter` | HO Dashboard + roster management |
| Admin (existing) | `trace-ho`, `trace-hunter` | Added to existing Admin group |

### New Tables (migration 20260618000002_trace_hunter_tables.sql)
| Table | Purpose |
|-------|---------|
| `recovery_tickets` | Core ticket: bike_id, reg_number, city_name, city_id, zone, status, assigned_hunter_id, marked_at_utc, call_status, is_base_list, model_name, last_user_name, last_user_phone, in_transit_at, mark_found_at, at_hub_at, cancelled_at, cancel_reason, is_deprioritized |
| `recovery_ticket_events` | Immutable event log per ticket (event_type, created_by, metadata) |
| `recovery_blocked_vehicles` | Reg numbers blocked from recovery (loaded from Google Sheet daily) |
| `zone_configs` | Per city per day zone assignments: zone_label (NE/NW/SE/SW), hunter_id, centroid_lat/lng, vehicle_count, date |
| `roster_template` | Weekly hunter schedule (hunter_id, day_of_week, city_id, shift_start/end) |
| `roster_overrides` | Per-date override (hunter_id, date, city_id, status: active/leave/weekoff) |

**RLS:** All tables have RLS enabled. `auth_update_recovery_tickets` allows any authenticated user to UPDATE. Inserts/deletes restricted to service role only (edge fns).

**Storage:** `recovery-photos` bucket — authenticated upload, path `{ticket_id}/{timestamp}.{ext}`. Public read.

### Status State Machine (recovery_tickets.status)
`marked` → `assigned` (zone-cluster or mid-day) → `called` (hunter called user) → `en_route` (navigator opened) → `mark_found` (photo uploaded) → `in_transit` (on porter, photo uploaded) → `at_hub` (Q2 reconciliation) | `cancelled` (Q2: customer_renewed)

### is_base_list Semantics
- New tickets from Q1 cron default to `is_base_list = false`
- zone-cluster sets `is_base_list = true` at 6 PM for all tickets assigned at that run
- Mid-day auto-assign additions always stay `is_base_list = false`

### Edge Functions (all verify_jwt=false, deployed active)
| Function | Schedule | Key logic |
|----------|----------|-----------|
| `recovery-ticket-sync` | `*/5 * * * *` | Q1: fetch marked bikes from Metabase → insert new tickets (skip blocked, skip existing anchors) → mid-day auto-assign if zone_configs exist for today (nearest centroid via Haversine). Q2: reconcile open tickets → cancel/in_transit/at_hub transitions |
| `recovery-blocked-sync` | `30 12 * * *` (6 PM IST) | Full-replace `recovery_blocked_vehicles` from Google Sheet (Step 0). Fail-safe: keeps existing if Sheet unreachable |
| `zone-cluster` | `35 12 * * *` (6:05 PM IST) | Step 1: per-city balanced k-means (equal-count, deterministic max-spread init, rebalance loop), NE/NW/SE/SW labeling via dot-product greedy assignment, roster lookup (overrides→template, exclude leave/weekoff), hunter preference match, upsert zone_configs, UPDATE recovery_tickets (zone, assigned_hunter_id, city_id, status=assigned, is_base_list=true) |

### pg_cron Jobs Added (Jobs T1–T3)
| Job | Name | Schedule | Notes |
|-----|------|----------|-------|
| T1 | recovery-ticket-sync-5min | `*/5 * * * *` | No auth header (verify_jwt=false) |
| T2 | recovery-blocked-sync-daily | `30 12 * * *` | 6 PM IST |
| T3 | zone-cluster-daily | `35 12 * * *` | 6:05 PM IST (5 min after blocked-sync) |

### Frontend Files Added
| File | Purpose |
|------|---------|
| `v8/trace-ho.html` | HO Dashboard — stats bar, city tabs (NCR/BLR/HYD), Leaflet map with color-coded pins (amber/coral/orange/red by hours_in_recovery), per-city zone cards, location-unknown table. Auto-refresh 60s. feature: `trace-ho` |
| `v8/trace-hunter.html` | Hunter PWA — mobile-first, List+Map tabs, vehicle cards sorted by Haversine distance, Call+Navigate+Mark Found+In Transit actions, photo upload to recovery-photos bucket, GPS staleness indicator. feature: `trace-hunter` |
| `v8/trace-hunter-manifest.json` | PWA manifest (installable, standalone display, scope=/v8/) |
| `v8/trace-hunter-sw.js` | Service worker — network-first, precaches shell (trace-hunter.html + manifest + logo.jpg) |

### Key Implementation Notes
- **GPS source:** always live from `bike_location_cache` via `reg_number` join — never stored on ticket
- **City resolution:** `resolveCityId(cityName)` in edge fns maps NCR/Delhi/Noida/Gurugram→1, Bangalore/BLR→2, Hyderabad/HYD→5 (case-insensitive includes)
- **Haversine:** shared function in both zone-cluster and recovery-ticket-sync for distance calculations
- **Hunter names:** Phase 1 shows hunter UUID (last 6 chars). Phase 2 needs a profiles/roster table with display names
- **Pin colors:** amber=#F59E0B (0–24h), coral=#F97316 (24–48h), orange=#EF4444 (48–72h), dark-red=#991B1B (72h+)
- **Call action:** logs event + sets status=called, call_status=informed, then opens tel: link
- **Mark Found / In Transit:** camera capture → upload to recovery-photos/{ticket_id}/{ts}.ext → update ticket status + insert event
- **Sidebar nav:** both pages add "FPI Recovery" section with trace-ho + trace-hunter links

### Auth Bug Discipline (mandatory — do not relax)
Before marking any auth bug as fixed: (1) grep for every `signOut()` call, (2) for each one, trace the exact condition that triggers it and simulate against the affected user's current state (email, group membership, last_login_at, hours elapsed), (3) confirm user completes a full session without hitting any of them. Do not declare fixed until all signOut paths are explicitly cleared.

### Phase 2 / 3 Items (NOT built — out of scope for Phase 1)
- Hunter profiles table (display names for zone cards)
- Roster management UI (admin roster editor)
- Dual-source GPS fallback (IoT/Intellicar + BaaS)
- Call outcome tracking (busy, no answer, etc.)
- OTP verification for user-reported location
- Analytics dashboard (recovery rate, avg age, zone heatmaps)

### 2026-07-01 — Edge-fn hotfixes (recovery-ticket-sync insert bug + heartbeat status)
- **recovery-ticket-sync was creating 0 tickets** despite new source rows. It inserted the Q1 `user_id` — a *numeric* booking user id (e.g. 447673) — into `recovery_tickets.user_id`, which is a **uuid** column, so every batch insert failed with `invalid input syntax for type uuid`. Fix: `uuidOrNull()` coerces non-uuid → null (numeric ids are dropped). To actually persist the numeric id, the column type must change (uuid → bigint/text) — **not done**; `user_id` is null for now.
- **`sync_heartbeats.status` CHECK allows only `success`/`failure`.** All three Trace & Hunter edge fns were writing `ok`/`warn`/`error`, so every heartbeat INSERT silently failed (0 heartbeats ever recorded for them — health-check was blind to them). Fixed in `recovery-ticket-sync`, `zone-cluster`, `recovery-blocked-sync`: `ok`→`success`, `warn`/`error`→`failure` (error_message retained). Caveat: blocked-sync's soft "Google Sheet unreachable → kept existing list" case now logs as `failure` (the CHECK leaves no `warn`).
- **Deploy state:** `recovery-ticket-sync` live (deployed via Cowork MCP). `zone-cluster` + `recovery-blocked-sync` heartbeat fix committed to git but **pending MCP redeploy**.
