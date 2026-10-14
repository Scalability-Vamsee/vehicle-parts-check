-- Join Call Analysis to calls inside Supabase: smartflo_calls_raw.ucid = call_analysis.activity_id.
-- (The same join inside the Metabase card failed with invalid-query, so the card only returns ucid.)
-- Runs before the hourly pairing rebuild (cron 121: attach, then rebuild) so rsa_cc_calls gets the category / summary.
CREATE OR REPLACE FUNCTION public.smartflo_calls_attach_analysis()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.smartflo_calls_raw c SET
    analysis_issue_category     = a.issue_category,
    analysis_secondary_category = a.secondary_issue_category,
    analysis_summary            = a.summary,
    analysis_resolved           = a.resolved,
    analysis_language           = a.language,
    analysis_outcome            = a.outcome,
    analysis_sentiment          = a.rider_sentiment
  FROM public.call_analysis a
  WHERE c.ucid IS NOT NULL AND a.activity_id = c.ucid
    AND (c.analysis_summary IS DISTINCT FROM a.summary OR c.analysis_issue_category IS DISTINCT FROM a.issue_category);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.smartflo_calls_attach_analysis() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smartflo_calls_attach_analysis() TO service_role;

-- hourly :30 job now attaches analysis first, then rebuilds the pairing
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'rsa-cc-calls-rebuild-hourly'),
  command := 'select public.smartflo_calls_attach_analysis(); select public.rsa_cc_calls_rebuild(30);');
