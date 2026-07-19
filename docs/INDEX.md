# 📑 Documentation Index — FleetPro

The single map of every FleetPro doc. ONE canonical context file, ONE checklist per
area. If you find a duplicate, fold it into the canonical and delete the copy.

> FleetPro is its OWN git repo (`vehicle-parts-check`) and deploys to GitHub Pages.
> It is gitignored by the outer Bounce repo — edit & commit *here*, push via the
> `/tmp` clone (see CLAUDE.md). Outer-repo commits never deploy.

## Engineering rules & locks
| Doc | Path | Purpose |
|-----|------|---------|
| Project memory / rules | `CLAUDE.md` | Auth pattern, deploy, tables, do-not-violate decisions. Always-loaded. |
| Edit locks | `LOCKS.md` | Claim a page before editing. Protocol at top. |
| Cowork primer | `../docs/COWORK-PRIMER.md` | Paste into Cowork at session start (it doesn't auto-load CLAUDE.md). Includes the always-re-clone rule. |
| Daily prompts | `../START-HERE.md` | START prompt on open, END prompt on close (per window/project). |
| This index | `docs/INDEX.md` | Map of all FleetPro docs. |

## Core context & roadmap
| Doc | Path | Canonical? | Purpose |
|-----|------|-----------|---------|
| FleetPro context | `Fleetpro-context.md` | ✅ | Live source-of-truth: groups, features, table schemas, session log |
| Architecture proposal | `ARCHITECTURE-PROPOSAL.md` | ✅ | 6-phase productization roadmap |
| Productization tracker | `PRODUCTIZATION-TASKS.md` | ✅ | THE checklist — phase status, open decisions D1–D6 |
| README | `README.md` | ✅ | Fresh-clone rebuild guide |

## Trace & Hunter module
| Doc | Path | Canonical? | Purpose |
|-----|------|-----------|---------|
| T&H context | `Trace and Hunter/context.md` | ✅ CANONICAL | Full Phase 1/2/3 spec |
| T&H improvements | `Trace and Hunter/IMPROVEMENTS.md` | ✅ | Review & rebuild plan |

## Admin Tools
| Doc | Path | Canonical? | Purpose |
|-----|------|-----------|---------|
| JC Approval context | `docs/jc-approval-context.md` | ✅ CANONICAL | Manual JC Approval Check — tiers, architecture, tables, Cowork↔Code collab |
| Incentive portal status | `Fleetpro-context.md` (§2026-06-27) | ✅ | Technician Incentive Portal + `sync-incentive-data` status (Option A auth, 2000-row cap closed) |
| Incentive edge fn source | `supabase/functions/sync-incentive-data/index.ts` | ✅ pushed | **v20** (2026-07-05): conflict key `jc_billed_datetime,technician_name_raw,reg_number`; calls `purge_stale_jc_log_rows()` before rebuild (migration `20260705000001`) to avoid dup-key rollback from v16-v18 NULL-normalized phantom rows. |
| Incentive nudge edge fn | `supabase/functions/incentive-nudge/index.ts` | ✅ | Daily personalized email to techs (08:00 + 20:00 IST, job 37). Resend API, bounceops.online domain. `get_nudge_targets` RPC (migration 20260702000002). |
| Incentive migrations | `supabase/migrations/20260620000001*`, `20260627000001-5*`, `20260702000002*`, `20260702000004*` | ✅ all applied | identity schema + dedup/rebuild/frozen-weeks/Jun15 patch/noon-IST freeze + nudge helper + week-config/feedback tables. `000004` confirmed applied 2026-07-04 (tables existed). |
| Rebuild RPC (live) | `…20260702000003…` + `20260704000001_rebuild_alias_merge.sql` | ✅ git == live (2026-07-05) | `000003` = MODE() hub; `000004…001` = verbatim live dump (MODE + `SUM(jc_weight)` + `GROUP BY COALESCE(employee_id, technician_name)` alias merge + frozen-safe DELETE). Future RPC edits: dump from live via `pg_get_functiondef`, never reconstruct from git (payout-regression risk). |
| Incentive PWA | `v8/incentive-manifest.json`, `v8/incentive-sw.js` | ✅ | Android installable PWA for incentive.html (2026-07-02) |
| Page Analytics + Sync Jobs | `v8/admin-analytics.html` | ✅ pushed | Page-view analytics + Sync Jobs panel (admin-cron, migration 20260702000001). Tabbed layout (Page Analytics / Sync Jobs) + cron group headers + per-job last-run history (migration `20260708000001`). All pushed prior sessions. |
| Admin-cron edge fn | `supabase/functions/admin-cron/index.ts` | ✅ pushed | Superadmin-only: list/edit pg_cron jobs. verify_jwt=true. Last-run history via RPC `admin_cron_last_runs` (migration `20260708000001_admin_cron_last_runs.sql`). All pushed prior sessions. |
| HR + alias sync edge fn | `supabase/functions/sync-hr-employees/index.ts` | ⚠️ v11 pushed bd65cfb · live still v7 | **v11 (2026-07-15, commit bd65cfb):** Nomenclature Map (gid 572681529) is the SINGLE master — old HR sheet dropped. One run upserts `incentive_technicians` + `jc_name_aliases` + `hr_employees` (employee_name = sheet Normalized Name). empId guard `/^[A-Z]+[0-9]+$/`, email guard rejects `'-'`/malformed, Map-based alias dedup, FK `jc_name_aliases.employee_id→hr_employees` dropped (sheet is authority). Runs nightly via pg_cron job 36 (18:30 UTC / 00:00 IST). ⚠️ git source-of-record only — **needs MCP deploy to go live** (live = v7). |
| Freeze-rebuild migration | `supabase/migrations/20260715000001_freeze_rebuild_first.sql` | ✅ pushed 2c32688 | Captures live `freeze_completed_weeks()` change (rebuild-before-freeze). Applied live 2026-07-09; git-reconciled 2026-07-15. |
| Send-feedback edge fn | `supabase/functions/send-feedback/index.ts` | ✅ deployed (v4) + pushed 2026-07-05 · ⚠️ auth | Incentive Feedback FAB (text+audio) → `incentive_feedback` + Resend email. Audio → `feedback-audio` bucket. ⚠️ `verify_jwt:true` + anon-key call = 401 — **recommend calling with the logged-in session JWT (keep verify_jwt=true)** rather than opening a public endpoint. Confirm `feedback-audio` bucket (auth-write, superadmin-read). |
| RFD Check | `v8/rfd-check.html` + `supabase/functions/rfd-check-sync` | ✅ pushed + live | Search-first admin tool — reg → **RFD CLEAR / INCOMPLETE** (IoT Glue, MCU FW 60A, JC Billed). Catches bikes force-activated by direct DB update. Backend: `rfd_violations_cache` ← `rfd-check-sync` v1 (Metabase Q `0cfdcf89`) on cron job 42 (every 2h). Feature key `rfd-check`. Full context: `Fleetpro-context.md` §2026-07-19. |
| Shared sidebar | `v8/sidebar.js` | ✅ | ONE source of truth for the sidebar on all 13 pages (markup + `data-feature` gates + injected dark theme + scroll). Edit here, not per-page (2026-07-02). |

## Launch notes
| Doc | Path | Purpose |
|-----|------|---------|
| In-trip soft launch | `Intrip_SoftLaunch_*.md` | Soft-launch announcement + note |

## ⚠️ Known cleanups
- A stale divergent copy of the T&H context exists in the **outer** repo at
  `../Trace & Hunder/context.md` (misspelled folder). The copy *here* is canonical.
- Future: when Phase 3 (Vite) lands, move `Fleetpro-context.md`, `ARCHITECTURE-PROPOSAL.md`,
  `PRODUCTIZATION-TASKS.md` into this `docs/` folder and update this index.
