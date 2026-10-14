-- Call Analysis (AI summary + issue category per call) uploaded from the Metabase table "Call Analysis"
-- (CS Analytics.public). activity_id = smartflo "Ozonetel UCID" (Vamsee, 14 Oct), NOT the Call ID.
-- NOTE: these are AI summaries / categories, not full transcripts. Viewer-readable only (RLS); no phone numbers.
CREATE TABLE IF NOT EXISTS public.call_analysis (
  activity_id              text PRIMARY KEY,
  issue_category           text,
  secondary_issue_category text,
  resolved                 text,
  language                 text,
  summary                  text,
  analyzed_at              timestamptz,
  outcome                  text,
  blocker                  text,
  competitor_named         text,
  agent_pitched            text,
  rider_sentiment          text,
  loaded_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_analysis_category_idx ON public.call_analysis (issue_category);
ALTER TABLE public.call_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS call_analysis_viewer_select ON public.call_analysis;
CREATE POLICY call_analysis_viewer_select ON public.call_analysis FOR SELECT TO authenticated
  USING ((SELECT public.is_rrr_viewer()));
REVOKE ALL ON public.call_analysis FROM anon, authenticated;
GRANT SELECT ON public.call_analysis TO authenticated;
