-- Migration: admin_cron_last_runs helper
-- Returns the latest pg_cron run result per job so the UI can show
-- "last run" and status for SQL-type cron jobs (which don't write sync_heartbeats).

CREATE OR REPLACE FUNCTION public.admin_cron_last_runs()
RETURNS TABLE(jobid bigint, last_start timestamptz, last_status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, cron, public
AS $$
  SELECT DISTINCT ON (jobid)
    jobid,
    start_time AS last_start,
    status     AS last_status
  FROM cron.job_run_details
  ORDER BY jobid, start_time DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_cron_last_runs() TO service_role;
