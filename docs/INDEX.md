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
| Incentive edge fn source | `supabase/functions/sync-incentive-data/index.ts` | ✅ | Deployed **v19** (2026-07-04): conflict key reverted to `jc_billed_datetime,technician_name_raw,reg_number` (v18 used `jcsl_id` which is absent from Metabase card — was always null). ⚠️ File needs git push. |
| Incentive nudge edge fn | `supabase/functions/incentive-nudge/index.ts` | ✅ | Daily personalized email to techs (08:00 + 20:00 IST, job 37). Resend API, bounceops.online domain. `get_nudge_targets` RPC (migration 20260702000002). |
| Incentive migrations | `supabase/migrations/20260620000001*`, `20260627000001-5*`, `20260702000002*`, `20260702000004*` | ✅ all applied | identity schema + dedup/rebuild/frozen-weeks/Jun15 patch/noon-IST freeze + nudge helper + week-config/feedback tables. `000004` confirmed applied 2026-07-04 (tables existed). |
| Rebuild RPC (live) | `supabase/migrations/20260702000003_rebuild_incentive_mode_hub_fix.sql` | ✅ git · ⚠️ alias-merge fix live but unmigrated | git: MODE() hub fix. Live DB has additional fix (2026-07-04): `GROUP BY COALESCE(employee_id, technician_name)` merges aliases. Needs migration `20260704000001_rebuild_alias_merge.sql`. |
| Incentive PWA | `v8/incentive-manifest.json`, `v8/incentive-sw.js` | ✅ | Android installable PWA for incentive.html (2026-07-02) |
| Page Analytics + Sync Jobs | `v8/admin-analytics.html` | ✅ | Page-view analytics + Sync Jobs panel (admin-cron edge fn, migration 20260702000001). See Fleetpro-context.md §2026-07-02 |
| Admin-cron edge fn | `supabase/functions/admin-cron/index.ts` | ✅ | Superadmin-only: list/edit pg_cron jobs from the UI. verify_jwt=true. |
| Send-feedback edge fn | `supabase/functions/send-feedback/index.ts` | ✅ deployed (v4) · ⚠️ needs verify_jwt=false | Deployed 2026-07-04. Incentive Feedback FAB (text+audio) → `incentive_feedback` table + Resend email to vamsee@bounceshare.com. Audio to `feedback-audio` Storage bucket. Currently `verify_jwt: true` — must toggle to `false` in Supabase dashboard (called with anon key from incentive.html). File needs git push. |
| Shared sidebar | `v8/sidebar.js` | ✅ | ONE source of truth for the sidebar on all 12 pages (markup + `data-feature` gates + injected dark theme + scroll). Edit here, not per-page (2026-07-02). |

## Launch notes
| Doc | Path | Purpose |
|-----|------|---------|
| In-trip soft launch | `Intrip_SoftLaunch_*.md` | Soft-launch announcement + note |

## ⚠️ Known cleanups
- A stale divergent copy of the T&H context exists in the **outer** repo at
  `../Trace & Hunder/context.md` (misspelled folder). The copy *here* is canonical.
- Future: when Phase 3 (Vite) lands, move `Fleetpro-context.md`, `ARCHITECTURE-PROPOSAL.md`,
  `PRODUCTIZATION-TASKS.md` into this `docs/` folder and update this index.
