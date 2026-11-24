-- 20261124000001_jc_sync_tables_close_writes.sql
-- 24 Nov 2026. Applied by Claude Code (Vamsee's window) on Vamsee's "Apply", found while promoting PR #35 (RFD Check reads jc_ops_log).
--
-- Problem: 20260623000001_jc_context_tables.sql created the "service" write policies without TO service_role, so they applied to EVERY role:
--   * jc_ops_log, jc_booking_history: anyone with the public anon key could INSERT rows (no sign-in needed);
--   * any signed-in user could DELETE rows (sign-up is open, so that is anyone).
--   Dry-run 24 Nov (rolled back, fake rows id -999001): anon insert OK; signed-in delete 1 of 1 on both tables.
-- The syncs do not need these policies: jc-ops-sync (cron 31) and jc-booking-sync (cron 30) use the service-role key, which bypasses row security.
-- No FleetPro page writes these tables (checked: v8/ only reads them).
-- After: anon and signed-in users cannot insert, update or delete; signed-in read (auth_read_* policies) and the service-role syncs are unchanged.
--   Dry-run after the fix: anon insert denied, anon/signed-in delete denied, signed-in read 1 of 1, service role delete 1 of 1.
-- jc_jc_status_log (same 23 Jun migration) already had its write policies removed before 24 Nov.
-- Same open-write pattern, NOT changed here (writers not checked yet): jc_approval_alerts, jc_approval_status, recovery_blocked_vehicles,
--   recovery_tickets, recovery_tickets_cache, zone_configs.
-- Rollback (re-opens the hole; not recommended):
--   create policy service_write_jc_ops_log on public.jc_ops_log for insert with check (true);
--   create policy service_delete_jc_ops_log on public.jc_ops_log for delete using (true);
--   (same two for jc_booking_history) and grant insert, update, delete, truncate on both tables to anon, authenticated.
begin;
drop policy if exists service_write_jc_ops_log on public.jc_ops_log;
drop policy if exists service_delete_jc_ops_log on public.jc_ops_log;
drop policy if exists service_write_jc_booking_history on public.jc_booking_history;
drop policy if exists service_delete_jc_booking_history on public.jc_booking_history;
revoke insert, update, delete, truncate on public.jc_ops_log, public.jc_booking_history from anon, authenticated;
do $chk$
declare t text;
begin
  foreach t in array array['public.jc_ops_log', 'public.jc_booking_history'] loop
    if has_table_privilege('anon', t, 'insert') or has_table_privilege('anon', t, 'delete') or has_table_privilege('anon', t, 'update')
       or has_table_privilege('authenticated', t, 'insert') or has_table_privilege('authenticated', t, 'delete') or has_table_privilege('authenticated', t, 'update') then
      raise exception 'check: % still writable by anon or authenticated', t; end if;
    if not (has_table_privilege('service_role', t, 'insert') and has_table_privilege('service_role', t, 'delete')) then
      raise exception 'check: % not writable by service_role (sync would break)', t; end if;
    if not has_table_privilege('authenticated', t, 'select') then raise exception 'check: % not readable by authenticated', t; end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('jc_ops_log', 'jc_booking_history') and cmd <> 'SELECT') then
    raise exception 'check: a write policy is left'; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename in ('jc_ops_log', 'jc_booking_history') and cmd = 'SELECT') <> 2 then
    raise exception 'check: read policies changed'; end if;
end $chk$;
commit;
