-- 20261124000004_incentive_nudge_v2_cron.sql
-- 24 Nov 2026, Claude Code (Vamsee's window), on Vamsee's go after Shivani approved the test mail. Applied 24 Nov as cron job 150.
-- Runs incentive-nudge-v2 at 02:30 UTC = 08:00 IST on Mon, Wed, Fri (no type: the function picks the mail by IST weekday;
-- a technician who has not opened My Incentive yet gets the login mail each time). Same day, 19:36 IST: ?type=login sent once to all 114 (114 sent, 0 errors).
-- Authorization = the service-role key read from Vault (secret 'service_role_key'; value never in git or in the job command); the function refuses any other caller.
-- Old job 38 (incentive-nudge-daily) stays paused.
-- Stop: select cron.unschedule('incentive-nudge-v2-mwf');
select cron.schedule('incentive-nudge-v2-mwf', '30 2 * * 1,3,5', $job$
  select net.http_post(
    url := 'https://clkfvmmlgwcvntxnolsv.supabase.co/functions/v1/incentive-nudge-v2',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000);
$job$);
