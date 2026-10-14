-- Keep inbound Smartflo calls from 1 Jun 2026 onwards (was a rolling 35 days). p_days is kept for
-- compatibility with the edge function call but ignored. History loaded 14 Oct: 1 Jun -> today, 159,642 calls
-- (120,847 connected, 120,845 with a recording link), in 8-day chunks via smartflo-calls-sync {start_date,end_date}.
-- Pairing history rebuilt once with rsa_cc_calls_rebuild(134) (tickets from 2 Jun; calls start 1 Jun);
-- the hourly cron keeps rebuilding the last 30 days only.
CREATE OR REPLACE FUNCTION public.smartflo_calls_prune(p_days integer DEFAULT 35)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.smartflo_calls_raw
   WHERE call_time < timestamptz '2026-06-01 00:00:00+05:30'
      OR direction IS DISTINCT FROM 'Inbound';
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.smartflo_calls_prune(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smartflo_calls_prune(integer) TO service_role;
