-- Migration: speedometer_pending table
-- Synced from Google Sheet (B2B Speedometer tab) by sync-speedometer-pending edge fn
-- Applied via Supabase MCP 2026-09-23

create table if not exists speedometer_pending (
  serial_number   text primary key,
  system_status   text,
  zone            text,
  hub             text,
  reg_number      text,
  bike_status     text,
  completion      text,
  technician_name text,
  lat             double precision,
  lng             double precision,
  loc_time        timestamptz,
  vehicle_status  text,
  synced_at       timestamptz default now()
);

create index if not exists idx_speedometer_pending_completion on speedometer_pending(completion);
create index if not exists idx_speedometer_pending_reg_number on speedometer_pending(reg_number);

alter table speedometer_pending enable row level security;

create policy "auth_read_speedometer_pending"
  on speedometer_pending for select
  to authenticated
  using (true);
