-- Migration: purge_stale_jc_log_rows helper
-- Deletes incentive_jc_log rows with NULL technician_name_normalized (synced by v16-v18).
-- These phantom rows cause the rebuild to produce duplicate (tech_name, week_start) entries,
-- violating the UNIQUE constraint → entire rebuild rolls back → stats shows stale data.
-- Called by sync-incentive-data v20 before each rebuild so open weeks stay clean.

CREATE OR REPLACE FUNCTION public.purge_stale_jc_log_rows()
 RETURNS int
 LANGUAGE sql
AS $$
  WITH deleted AS (
    DELETE FROM incentive_jc_log
    WHERE technician_name_normalized IS NULL
      AND week_start NOT IN (
        SELECT DISTINCT week_start FROM incentive_weekly_stats WHERE is_frozen = true
      )
    RETURNING 1
  )
  SELECT COUNT(*)::int FROM deleted;
$$;

GRANT EXECUTE ON FUNCTION purge_stale_jc_log_rows() TO service_role;
