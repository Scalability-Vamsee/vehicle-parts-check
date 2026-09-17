# Edge Function Registry

All active Supabase edge functions for the FleetPro project (`clkfvmmlgwcvntxnolsv`).

**Metabase base URL:** `http://metabaselatest-dy7gqwqrma-el.a.run.app`  
**Public card URL pattern:** `{base}/api/public/card/{uuid}/query/csv` (or `/json`)  
**Actual Metabase link:** internal URL (fill in by opening the card in Metabase → share → copy link)

---

## JC / Workshop

| Edge Function | Public Card UUID | Actual Metabase Query Link | Frequency | Remarks |
|---|---|---|---|---|
| `jc-failure-alert` | `703fa2b6-0b00-4383-aead-9b06ae176a3b` | _(backfill)_ | Every 10 min | Polls for draft JC creation failures; sends email alert to Vamsee + 5 fixed CCs + hub HM/SM from `hub_contacts` |
| `jc-history-sync` | `a2c3e48b-1b15-4c14-830d-5d65199d143f` | _(backfill)_ | Every 2h + every 3h | 90-day rolling JC history sync (streaming reader to avoid OOM); writes to `jc_history` |
| `jc-approval-sync` | `c100308c-250f-46b2-b389-e8bc4a419d4c` | _(backfill)_ | Every 5 min | JC HO approval status sync |
| `jc-booking-sync` | `c1efbecd-4686-49da-8117-795ba4a7e2f2` | _(backfill)_ | Every 15 min | JC booking data sync |
| `jc-ops-sync` | `98f2dc7c-a97f-47e8-9995-96e8aa19c56a` | _(backfill)_ | Every 15 min (:05,:20,:35,:50) | JC operational data sync |
| `jc-status-log-sync` | `b1470077-f81c-4484-b78a-b5a86124d20c` | _(backfill)_ | Every 15 min (:10,:25,:40,:55) | JC status log sync — technician names, billed status; used by `csat_enriched` view |
| `OOS_QUEUE` | `13db90ad-9379-45d5-82ed-fbfd204dc9f7` | _(backfill)_ | Every hour (:05) | OOS work queue sync |

---

## Firmware / Deployment

| Edge Function | Public Card UUID | Actual Metabase Query Link | Frequency | Remarks |
|---|---|---|---|---|
| `fw-map-rider-sync` | `55e3b2b1-b266-4f99-947b-2ce0dde6d9bb` | _(backfill)_ | Every 10 min | FW pending rider/bike sync for fw-map.html |
| `fw-sheet-sync` | — (Google Sheets) | — | Every 15 min | FW sheet data sync (not Metabase) |
| `refresh-deployment-cache` | Queue: `fea85b30-3ca8-4c07-b434-1f6e6c05875d` · Pending: `84353543-a136-4f4a-ba0d-cb97218e0b59` | _(backfill)_ | Every 15 min | Refreshes deployment queue cache from 2 Metabase cards |
| `indofast-station-sync` | `6a53446d-848e-4ea5-8f9d-66605f84c77c` | _(backfill)_ | Daily 02:30 IST | Indofast station visit stats sync; top 10 shown on fw-map by `total_bikes_visited`; lat/lng seeded in migration and preserved on conflict |

---

## RSA Operations

| Edge Function | Public Card UUID | Actual Metabase Query Link | Frequency | Remarks |
|---|---|---|---|---|
| `rsa-ticket-sync` | `f79c5050-213f-4a6e-962f-1369de907cdb` | _(backfill)_ | Every 2 min | Live RSA ticket sync to `rsa_tickets_cache` + `rsa_tickets_live` |
| `rsa-history` | `6f11e26e-044f-440a-8d4d-576ebfafce74` | _(backfill)_ | On-demand (no cron) | RSA ticket history lookup |

---

## Trace & Hunter (Recovery)

| Edge Function | Public Card UUID | Actual Metabase Query Link | Frequency | Remarks |
|---|---|---|---|---|
| `recovery-ticket-sync` | Q1: `8ef20d85-0485-4e85-b25a-9d7c96279d8e` · Q2: `67f2823d-e46c-49c0-90c1-51c8bc9e8340` | _(backfill)_ | Every 5 min | New ticket creation (Q1) + open reconciliation (Q2); Step 3 rebuilds `recovery_tickets_cache` with GPS pre-joined |
| `recovery-blocked-sync` | — (Google Sheets) | — | Daily 12:30 IST | Blocked vehicles (police station / impounded) sync from Google Sheet |
| `zone-cluster` | — (internal DB) | — | Daily 12:35 IST | Balanced k-means + Voronoi (d3-delaunay) zone clustering; reads `roster_template`; writes `zone_configs` |

---

## Bike Location & Maps

| Edge Function | Public Card UUID | Actual Metabase Query Link | Frequency | Remarks |
|---|---|---|---|---|
| `bike-location-sync` | `18f2864d-eab9-44f9-806c-edd1542dee88` | _(backfill)_ | Every 5 min | Bike GPS sync to `bike_location_cache` |
| `fw-map-proxy` | `18f2864d-eab9-44f9-806c-edd1542dee88` | _(backfill)_ | On-demand (no cron) | Proxy endpoint for fw-map GPS data; reads same card as `bike-location-sync` |
| `hub-location-sync` | `85e16885-d60b-4040-b8ba-1d783e118c67` | _(backfill)_ | Daily 00:30 IST | Hub lat/lng sync to `rental_locations` |

---

## RRR Dashboard (rrr.bounceops.online)

| Edge Function | Public Card UUID | Actual Metabase Query Link | Frequency | Remarks |
|---|---|---|---|---|
| `rrr-events-sync` | _(no local source — deployed via MCP)_ | _(backfill)_ | Daily 01:30 IST | Full RRR events sync to `rrr_events` table; source of truth for the dashboard |
| `daily-active-bookings-sync` | _(no local source)_ | _(backfill)_ | Daily 01:35 IST | Daily active bookings count; feeds L0 RR% denominator |
| `daily-active-bookings-hub-sync` | _(no local source)_ | _(backfill)_ | Daily 01:40 IST | Same as above, hub-level breakdown |
| `daily-kms-sync` | _(no local source)_ | _(backfill)_ | Daily 01:45 IST | Daily km driven per bike; feeds L1 RR Frequency (km per failure) |
| `daily-hub-deployments-sync` | _(no local source)_ | _(backfill)_ | Daily 01:50 IST | Daily new deployments per hub; feeds Defect Rate denominator |
| `rider-feedback-sync` | _(no local source)_ | _(backfill)_ | Daily 01:55 IST | Rider CSAT feedback sync; used by `csat_enriched` view |

---

## Incentive

| Edge Function | Public Card UUID | Actual Metabase Query Link | Frequency | Remarks |
|---|---|---|---|---|
| `sync-incentive-data` | `9a4c0477-92b1-450d-93b2-6b4ccd1e3473` | _(backfill)_ | Every 5 min + Thu 12:00 noon IST freeze | Technician incentive data sync; `/query/json` used (no 2000-row cap) |
| `incentive-metabase-sync` | _(check source)_ | _(backfill)_ | On-demand | Secondary incentive Metabase sync |
| `incentive-nudge` | — | — | Daily 14:30 IST | Push nudge notifications to technicians |

---

## General / Infrastructure

| Edge Function | Public Card UUID | Actual Metabase Query Link | Frequency | Remarks |
|---|---|---|---|---|
| `metabase-sync` | `0d3d2aec-25c0-4ef7-bffa-38b2575fd496` | _(backfill)_ | Every hour (:00) | Vehicle parts check / PM flag data sync |
| `sync-hr-employees` | — (Google Sheets `17-Ix-tVo2ekew5dogOFm9K8XsuMsdCb0MjQcnQGdxFs`, gid `572681529`) | — | Daily 18:30 IST | HR employee roster → `hr_employees` (login gates + feature access) |
| `admin-cron` | — | — | On-demand | Admin utility cron tasks |
| `admin-create-tech` | — | — | On-demand | Creates new technician accounts |
| `admin-permissions` | — | — | On-demand | Permission management RPC wrapper |
| `archive-location-partition` | — | — | Monthly (1st, 02:00 IST) | Archives old `bike_location_cache` partitions |
| `health-check` / `db-health-check` | — | — | Daily 03:00 IST | Supabase health ping |
| `send-feedback` | — | — | On-demand | Sends user feedback emails |
| `rfd-check-sync` | — | — | Every 2h | RFD violations cache refresh for `rfd-check.html` |
| `jc-context-sync` | — | — | On-demand | JC context data sync |
| `bulk-invite-techs` | — | — | On-demand | Bulk technician invite utility |

---

## How to backfill "Actual Metabase Query Link"

1. Open Metabase → find the card (search by name or UUID)
2. Click **Share** → copy the public link
3. Paste into the table above and commit

_Last updated: 2026-09-17_
