-- 20261124000002_validation_check.sql: DMS vehicle validation results (RFD validation), one row per check.
-- Applied 24 Nov 2026 by Claude Code (Vamsee's window) on Vamsee's "Apply"; dry-run first (3 real rows, access tests, rolled back).
-- Source: Metabase card "Validation check" (public 79990b1c-2c4f-41a8-a52c-bee10621ab69, card id 5799, database 2). The card returns a
-- rolling last-48-hours window (read 24 Nov 2026: 5,743 rows, 22 Nov 13:44 to 24 Nov 13:43 UTC, about 2,800 a day).
-- Columns are the card's columns, same names (so a CSV of old data imports straight in): id is the source row id (unique), created_at is UTC.
-- Asked by Vamsee 24 Nov 2026: create the table; Vamsee imports the old data once; then a sync (edge function + cron every 5 min) inserts new rows
-- (insert ... on conflict (id) do nothing).
-- Access: row security on; signed-in users read (like rfd_violations_cache, for RFD Check); anon nothing; writes only by the service role (sync)
-- and the table owner (dashboard import).
begin;
create table public.validation_check (
  id          bigint primary key,           -- source row id
  ops_user_id integer,                      -- who ran the check (DMS ops user id)
  bike_id     integer,
  odometer    integer,
  result      text,                         -- 'Vehicle passed the validation', or the failed checks joined with ' - '
  created_at  timestamptz,                  -- time of the check, UTC
  synced_at   timestamptz not null default now()
);
comment on table public.validation_check is 'DMS vehicle validation results from Metabase card 5799 (public 79990b1c), created 24 Nov 2026; sync every 5 min, insert new ids only.';
create index validation_check_bike_time_idx on public.validation_check (bike_id, created_at desc);
create index validation_check_time_idx on public.validation_check (created_at);
alter table public.validation_check enable row level security;
create policy validation_check_read on public.validation_check for select to authenticated using (true);
revoke all on public.validation_check from anon;
revoke insert, update, delete, truncate on public.validation_check from authenticated;
commit;
