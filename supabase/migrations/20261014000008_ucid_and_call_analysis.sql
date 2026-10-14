-- Ozonetel UCID per call + the "Call Analysis" fields joined on it (Call Analysis."Activity ID" = smartflo "Ozonetel UCID").
-- Filled by the raw card (RRR/rsa_design/queries/RSA_Smartflo_Calls_Raw.sql); empty when a call was not analysed.
ALTER TABLE public.smartflo_calls_raw
  ADD COLUMN IF NOT EXISTS ucid                        text,
  ADD COLUMN IF NOT EXISTS analysis_issue_category     text,
  ADD COLUMN IF NOT EXISTS analysis_secondary_category text,
  ADD COLUMN IF NOT EXISTS analysis_summary            text,
  ADD COLUMN IF NOT EXISTS analysis_resolved           text,
  ADD COLUMN IF NOT EXISTS analysis_language           text,
  ADD COLUMN IF NOT EXISTS analysis_outcome            text,
  ADD COLUMN IF NOT EXISTS analysis_sentiment          text;
ALTER TABLE public.rsa_cc_calls
  ADD COLUMN IF NOT EXISTS analysis_issue_category     text,
  ADD COLUMN IF NOT EXISTS analysis_secondary_category text,
  ADD COLUMN IF NOT EXISTS analysis_summary            text,
  ADD COLUMN IF NOT EXISTS analysis_resolved           text,
  ADD COLUMN IF NOT EXISTS analysis_language           text;
GRANT SELECT (ucid, analysis_issue_category, analysis_secondary_category, analysis_summary, analysis_resolved,
              analysis_language, analysis_outcome, analysis_sentiment) ON public.smartflo_calls_raw TO authenticated;
GRANT SELECT (analysis_issue_category, analysis_secondary_category, analysis_summary, analysis_resolved,
              analysis_language) ON public.rsa_cc_calls TO authenticated;

DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.rsa_cc_calls_rebuild(integer)'::regprocedure);
  IF position('analysis_summary' in d) = 0 THEN
    d := replace(d, 'skill_name = c.skill_name',
      'skill_name = c.skill_name, analysis_issue_category = c.analysis_issue_category, '
      || 'analysis_secondary_category = c.analysis_secondary_category, analysis_summary = c.analysis_summary, '
      || 'analysis_resolved = c.analysis_resolved, analysis_language = c.analysis_language');
    EXECUTE d;
  END IF;
END $$;
