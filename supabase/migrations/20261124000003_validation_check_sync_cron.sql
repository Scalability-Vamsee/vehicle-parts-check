-- 20261124000003_validation_check_sync_cron.sql
-- 24 Nov 2026, Claude Code (Vamsee's window). Runs edge function validation-check-sync every 5 min, at minutes 3, 8, 13, ...
-- (away from the crowded :00 / :05 / :30 minutes). Applied only on Vamsee's "deploy", after the function is deployed and one manual run is checked.
-- Authorization = the service-role key read from Vault (secret 'service_role_key', created separately with vault.create_secret;
-- its value is never in git and never in the job command). The function refuses any other caller (401).
-- Check: select status, rows_affected, error_message, synced_at from sync_heartbeats where function_name = 'validation-check-sync' order by synced_at desc limit 5;
-- Stop: select cron.unschedule('validation-check-sync-5min');
select cron.schedule('validation-check-sync-5min', '3-59/5 * * * *', $job$
  select net.http_post(
    url := 'https://clkfvmmlgwcvntxnolsv.supabase.co/functions/v1/validation-check-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$job$);
