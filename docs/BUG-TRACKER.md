# 🐛 Bug Tracker — FleetPro

Living log of bugs found and fixed, with their branch/PR trail. Update this file as part
of the same commit that closes out a fix (add a row when you open the PR; update the
"Merged to staging" column once it lands).

Status legend: 🔧 In progress · 🟡 PR open, awaiting review · ✅ Merged to staging ·
🚀 Merged to main (live in prod) · ⏸️ Reported, decision pending

---

## Fixed & tracked through this workflow

| Bug | File(s) | Branch | PR | Merged to staging | Status |
|---|---|---|---|---|---|
| Unstyled white-box Pin button on RSA Warroom sidebar | `v8/rsa.html` | `feature/fix-rsa-warroom-pin-btn` | [#5](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/5) | 2026-08-17 | ✅ (bundled in [#9](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/9) staging→main) |
| Hardcoded `vamsee@scalability.club` bypass in Permission Manager pre-auth email gate — reintroduced a pattern `CLAUDE.md` says was removed 2026-08-12; restored the `is_approved_user` RPC check | `v8/admin-permissions.html` | `feature/fix-rsa-warroom-pin-btn` | none — merged directly to staging (commit `e8e14de`, no PR opened) | 2026-08-22 | ✅ (bundled in [#9](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/9)) |
| Login error message wasn't displaying on Permission Manager's magic-link screen | `v8/admin-permissions.html` | `feature/fix-rsa-warroom-pin-btn` | none — same branch as above | 2026-08-22 | ✅ (bundled in [#9](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/9)) |
| Unstyled white-box Pin button on Trace (`trace-ho.html`) sidebar — `sidebar.js` injects the button markup on every page, but the base `.pin-btn` CSS has to be defined per-page; `trace-ho.html` never got it | `v8/trace-ho.html` | `fix/trace-sidebar-white-pin-btn` | [#10](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/10) | 2026-08-24 | ✅ (bundled in [#9](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/9)) |
| FW Pending Map had no city concept at all (no toggle, bike data fetched with zero city filtering). Added city toggle (All/BLR/NCR/HYD) mirroring RSA Warroom's `CITY_CONFIG` + `inferCity()` + pan/zoom-on-selection-change exactly — bikes bucketed by lat/lng since `fw_bikes_live`/`mcu_bikes_live` have no city column. Defaults to All (not BLR, unlike RSA). Mumbai intentionally not included — separate follow-up pending confirmed operational data | `v8/fw-map.html` | `feature/fw-map-city-toggle` | none — merged directly to staging (commit `7c4c815`, no PR opened) | 2026-08-25 | ✅ confirmed working on bounceops.info by Manasa |

## In progress

| Bug | File(s) | Branch | Status | Blocked on |
|---|---|---|---|---|
| Magic-link redirect: technician clicking their magic link could get silently bounced to `index.html` (a different app) with no explanation whenever the permission check couldn't confirm `tech-app` access. Fixed to show an in-page "no active technician profile" message + Try Again/Sign Out instead of redirecting away | `v8/rsa-tech.html` | `fix/rsa-tech-magic-link-redirect` | 🔧 Code complete, pushed, not yet merged to staging | Testing paused — Manasa asked Sriranga clarifying questions first (2026-08-25) |

## Fixed independently (found during the 2026-08-24 full-codebase audit, already resolved by someone else)

| Bug | File(s) | Note |
|---|---|---|
| Hardcoded `vamsee@scalability.club` / domain-only allowlist instead of `is_approved_user` RPC | `index.html`, `maintenance.html`, `queue.html`, `jc-approval.html` | Landed on `staging` via commits `ad1a301` / `04b8b16` — author outside this session, discovered already-fixed when checking staging state on 2026-08-24 |

## Known, not yet fixed (from the 2026-08-24 full-codebase audit — see session notes for detail)

| Bug | File(s) | Severity |
|---|---|---|
| `logPageView()` references undeclared variable `K` — sends `Authorization: Bearer undefined`, page-view analytics silently broken | `v8/trace-hunter.html` | Low — analytics only, no user-facing impact |
| Dead code: `renderTechTable()` targets DOM IDs that no longer exist (throws every admin-tab load, silently caught); unreachable `processUpload()` references an undeclared global | `v8/incentive.html` | Low — silent console error, no user-facing impact |
| Boot order fires `hideAuthScreen()` before `loadAndApplyPermissions()` resolves (unawaited); leftover `#perm-veil`; no superadmin short-circuit | `v8/rsa.html` | Medium — structural, needs a decision before touching |
| Same `#perm-veil` retirement + permissions-first ordering needed | `v8/maintenance.html`, `v8/queue.html`, `v8/deployment.html`, `v8/fw-map.html` | Medium |
| Missing superadmin short-circuit (superadmin without an explicit group row gets bounced to `index.html`) | `v8/maintenance.html`, `v8/queue.html`, `v8/deployment.html`, `v8/rsa.html` | Medium |
| `checkGlobalLogout()` ("force logout all sessions") not wired up | `v8/maintenance.html`, `v8/queue.html` | Low |
| Dead/orphaned page, zero references anywhere in the codebase, fully superseded by `rsa-tech.html` | `v8/tech.html` + `tech-manifest.json` + `tech-sw.js` | Cleanup, no urgency |

## Reported, decision pending

| Bug | File(s) | Waiting on |
|---|---|---|
| Sign-out reloads the *same* page and shows that page's own login screen, instead of redirecting to a central login page — but this is consistent across **all 13 pages** (`index.html`, `admin-permissions.html`, `rsa.html`, etc. all do this identically), so it may be intentional per-page-auth design rather than a bug | All pages | Manasa is asking Vamsee whether the intended behavior is per-page reload (current, consistent) or redirect-to-hub (would be a design change across all 13 pages) |

---

## Production promotion

All rows marked ✅ above flow into the standing **staging → main** PR:
**[#9](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/9)** — this is the one PR that actually needs Vamsee's review to reach `bounceops.online`. Individual fix PRs (like #5, #10) merging into `staging` update #9's diff automatically; no separate action needed once they're in.
