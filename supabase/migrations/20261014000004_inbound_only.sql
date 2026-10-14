-- RSA does no outbound calling (Vamsee, 14 Oct): keep only inbound calls in smartflo_calls_raw.
-- smartflo_calls_prune (called after every sync) now also drops non-inbound rows, so the table stays inbound-only
-- even if the Metabase card returns outbound again. Existing outbound rows are removed once below.
CREATE OR REPLACE FUNCTION public.smartflo_calls_prune(p_days integer DEFAULT 35)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.smartflo_calls_raw
   WHERE call_time < now() - make_interval(days => p_days)
      OR direction IS DISTINCT FROM 'Inbound';
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.smartflo_calls_prune(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smartflo_calls_prune(integer) TO service_role;
