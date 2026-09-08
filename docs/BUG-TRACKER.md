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
| Unstyled white-box Pin button on RSA Warroom sidebar | `v8/rsa.html` | `feature/fix-rsa-warroom-pin-btn` | [#5](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/5) | 2026-08-17 | 🚀 live in prod (via [#9](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/9), merged 2026-08-31) |
| Hardcoded `vamsee@scalability.club` bypass in Permission Manager pre-auth email gate — reintroduced a pattern `CLAUDE.md` says was removed 2026-08-12; restored the `is_approved_user` RPC check | `v8/admin-permissions.html` | `feature/fix-rsa-warroom-pin-btn` | none — merged directly to staging (commit `e8e14de`, no PR opened) | 2026-08-22 | 🚀 live in prod (via [#9](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/9)) |
| Login error message wasn't displaying on Permission Manager's magic-link screen | `v8/admin-permissions.html` | `feature/fix-rsa-warroom-pin-btn` | none — same branch as above | 2026-08-22 | 🚀 live in prod (via [#9](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/9)) |
| Unstyled white-box Pin button on Trace (`trace-ho.html`) sidebar — `sidebar.js` injects the button markup on every page, but the base `.pin-btn` CSS has to be defined per-page; `trace-ho.html` never got it | `v8/trace-ho.html` | `fix/trace-sidebar-white-pin-btn` | [#10](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/10) | 2026-08-24 | 🚀 live in prod (via [#9](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/9)) |
| FW Pending Map had no city concept at all (no toggle, bike data fetched with zero city filtering). Added city toggle (All/BLR/NCR/HYD) mirroring RSA Warroom's `CITY_CONFIG` + `inferCity()` + pan/zoom-on-selection-change exactly — bikes bucketed by lat/lng since `fw_bikes_live`/`mcu_bikes_live` have no city column. Defaults to All (not BLR, unlike RSA). Mumbai intentionally not included — separate follow-up pending confirmed operational data | `v8/fw-map.html` | `feature/fw-map-city-toggle` | none — merged directly to staging (commit `7c4c815`, no PR opened) | 2026-08-25 | ✅ confirmed working on bounceops.info by Manasa; queued in [#11](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/11) for prod |
| Dead orphaned technician app (`tech.html`, `tech-manifest.json`, `tech-sw.js`) — original technician app, fully superseded by `rsa-tech.html`, zero real references anywhere in the codebase. Root-level `/tech.html` redirect stub deliberately left in place pending confirmation it was never handed out to technicians directly | `v8/tech.html`, `v8/tech-manifest.json`, `v8/tech-sw.js` | `chore/remove-dead-tech-app` | none — merged directly to staging (commit `71714ba`, no PR opened) | 2026-09-02 | ✅ merged to staging |
| `logPageView()` referenced undeclared variable `K` in Hunter PWA — accessing it threw a `ReferenceError` before `fetch()` could run (silently swallowed), so page-view analytics were completely blind, not just missing an auth header. Added `K=ANON_KEY` declaration + `K=session.access_token` in `activateSession()`, matching the pattern already used in `rsa-tech.html` | `v8/trace-hunter.html` | `fix/trace-hunter-page-view-logging` | none — merged directly to staging (commit `3c23ac0`, no PR opened) | 2026-09-02 | ✅ merged to staging |
| Dead code in Technician Incentives admin: `renderTechTable()`/`filterTechTable()` targeted DOM IDs (`#tech-tbody`, `#tech-count`, `#tech-search`, `#tech-filter-status`) removed from the HTML at some point — `renderTechTable()` still ran once per admin-tab load and threw every time (caught, console-only). `processUpload()` (+ a duplicate empty stub, silently shadowed by hoisting) and `handleFileSelect()` were abandoned scaffolding for a never-built bulk-upload-via-Excel feature, referencing an undeclared `selectedFile`. `xlsx.full.min.js` CDN script left in place (out of scope, decided explicitly) | `v8/incentive.html` | `chore/remove-incentive-dead-code` | none — merged directly to staging (commit `7b11c99`, no PR opened) | 2026-09-02 | ✅ merged to staging |
| `checkGlobalLogout()` ("force logout all sessions") wired up in `maintenance.html`/`queue.html` — task description was inaccurate (claimed the function existed but was uncalled; it didn't exist there at all, and `rsa-tech.html` was wrongly cited as a reference — only `fw-map.html` actually implements this). Ported the function verbatim, called it at both existing `enforce24hReauth()` trigger points, and added the same 5-min `setInterval` poll `fw-map.html` uses so an open session gets caught within minutes, not just on next reload. Trigger UI (the admin-only Force Logout All button) intentionally stays only in `fw-map.html` — one trigger, many listeners. `rsa.html` and other pages still don't listen — separate follow-up if full coverage is ever wanted. **Note found while fixing item below:** `deployment.html` already independently has this fully wired (function + both trigger points + 5-min poll) — landed from outside this session's workflow, not something we did | `v8/maintenance.html`, `v8/queue.html` | `feature/global-logout-maintenance-queue` | none — merged directly to staging (commit `998b001`, no PR opened) | 2026-09-08 | ✅ merged to staging |
| Missing superadmin short-circuit: `loadAndApplyPermissions()` in `maintenance.html`/`queue.html`/`deployment.html`/`rsa.html` only checked `user_groups` membership — a superadmin whose access came purely from the `app_metadata.is_superadmin` flag (never manually added to a group) got bounced to `index.html` on all four pages. Changed the function signature from `(userId)` to `(session)` in all four (matching `trace-hunter.html`'s reference pattern) and added the short-circuit: grant the needed feature key(s) directly, skip the `group_features` lookup. `rsa.html` grants both `rsa-warroom` and `rsa-admin` since it's the only one of the four with a second gated UI element (the Admin tab) | `v8/maintenance.html`, `v8/queue.html`, `v8/deployment.html`, `v8/rsa.html` | `fix/superadmin-short-circuit` | none — merged directly to staging (commit `7a90f6c`, no PR opened) | 2026-09-08 | ✅ merged to staging |

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
| Boot order fires `hideAuthScreen()` before `loadAndApplyPermissions()` resolves (unawaited); leftover `#perm-veil` (superadmin short-circuit now fixed, see below) | `v8/rsa.html` | Medium — structural, needs a decision before touching |
| Same `#perm-veil` retirement + permissions-first ordering needed | `v8/maintenance.html`, `v8/queue.html`, `v8/deployment.html`, `v8/fw-map.html` | Medium |

## Reported, decision pending

| Bug | File(s) | Waiting on |
|---|---|---|
| Sign-out reloads the *same* page and shows that page's own login screen, instead of redirecting to a central login page — but this is consistent across **all 13 pages** (`index.html`, `admin-permissions.html`, `rsa.html`, etc. all do this identically), so it may be intentional per-page-auth design rather than a bug | All pages | Manasa is asking Vamsee whether the intended behavior is per-page reload (current, consistent) or redirect-to-hub (would be a design change across all 13 pages) |

---

## Production promotion

PR #9 (`staging → main`) merged on 2026-08-31 — everything through the FW Map city toggle is now live on `bounceops.online`.

The **current** standing staging → main PR is **[#11](https://github.com/Scalability-Vamsee/vehicle-parts-check/pull/11)** — rows marked ✅ above dated after 2026-08-31 (FW Map city toggle confirmation, dead tech-app cleanup) flow into this one. Individual fix branches merging into `staging` update #11's diff automatically; no separate action needed once they're in. Once #11 merges, a new standing PR will need to be tracked here the same way.

Also worth noting: two fixes landed on `staging` from outside this session's workflow and are included in #11 — a switch from CARTO map tiles (now key-gated) to OpenStreetMap tiles across all map pages (commit `261c9f5`, already separately merged to `main`), and the Indofast top-stations query fix (commits `d97aef6` + `57e3ed6`, the second commit correcting a wrong column name — `avg_bikes_visited` doesn't exist, `total_bikes_visited` does — caught by verifying directly against the live database before recommending merge).
