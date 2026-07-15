-- freeze_completed_weeks: rebuild from live jc_log BEFORE freezing
-- Ensures weeks are never locked on stale/ghost-row data.
-- Changed live 2026-07-15 after IST-timezone ghost-row cleanup (W1–W4).

CREATE OR REPLACE FUNCTION public.freeze_completed_weeks()
 RETURNS void
 LANGUAGE plpgsql
AS $$
BEGIN
  -- Step 1: rebuild all non-frozen weeks from live jc_log
  PERFORM rebuild_incentive_weekly_stats();

  -- Step 2: freeze weeks whose lock window has passed (Mon + 10d + 06:30 UTC)
  UPDATE incentive_weekly_stats
  SET is_frozen = true
  WHERE is_frozen = false
    AND week_start + INTERVAL '10 days' + INTERVAL '06:30:00' < NOW();
END;
$$;
