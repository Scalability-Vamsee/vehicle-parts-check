-- CC team's own tag per call: smartflo column "Disposition Names" (agent-picked, e.g. 'RSA__TS steps shared Vehicle Started Moving',
-- 'GEN_Call Dropped', 'SMPL__SMPL stations locations'). Filled by the raw card (RRR/rsa_design/queries/RSA_Smartflo_Calls_Raw.sql).
ALTER TABLE public.smartflo_calls_raw ADD COLUMN IF NOT EXISTS disposition text;
ALTER TABLE public.rsa_cc_calls       ADD COLUMN IF NOT EXISTS disposition text;
GRANT SELECT (disposition) ON public.smartflo_calls_raw TO authenticated;
GRANT SELECT (disposition) ON public.rsa_cc_calls       TO authenticated;

DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.rsa_cc_calls_rebuild(integer)'::regprocedure);
  IF position('disposition' in d) = 0 THEN
    d := replace(d, 'skill_name = c.skill_name', 'skill_name = c.skill_name, disposition = c.disposition');
    IF position('disposition' in d) = 0 THEN RAISE EXCEPTION 'rebuild patch did not apply'; END IF;
    EXECUTE d;
  END IF;
END $$;

-- ticket-first view: add the CC tag to each call in the JSON (all earlier columns unchanged)
CREATE OR REPLACE VIEW public.rsa_ticket_calls WITH (security_invoker = true) AS
SELECT ticket_number,
  min(ticket_time_ist) AS ticket_time_ist,
  min(resolved_time_ist) AS resolved_time_ist,
  min(city) AS city,
  min(category) AS category,
  min(status) AS status,
  count(*) FILTER (WHERE call_id <> '') AS calls_total,
  count(*) FILTER (WHERE phase = 'Before ticket') AS calls_before,
  count(*) FILTER (WHERE phase = 'During ticket') AS calls_during,
  count(*) FILTER (WHERE phase LIKE 'After close%') AS calls_after_close,
  count(*) FILTER (WHERE connected = 'Connected') AS calls_connected,
  count(*) FILTER (WHERE phase = 'Before ticket' AND connected = 'Connected') AS before_connected,
  count(*) FILTER (WHERE phase = 'Before ticket' AND connected <> 'Connected') AS before_not_connected,
  min(call_time_ist) AS first_call_ist,
  max(call_time_ist) AS last_call_ist,
  string_agg(
    CASE phase WHEN 'Before ticket' THEN 'BEFORE' WHEN 'During ticket' THEN 'DURING' ELSE 'AFTER' END
    || ' ' || to_char(call_time_ist, 'DD Mon HH24:MI')
    || CASE WHEN connected = 'Connected' THEN ' answered' ELSE ' missed' END
    || CASE WHEN call_period = 'Night' THEN ' (night)' ELSE '' END
    || CASE WHEN is_trigger_call THEN ' [trigger]' ELSE '' END
    || CASE WHEN analysis_issue_category IS NOT NULL THEN ' {' || analysis_issue_category || '}' ELSE '' END
    || CASE WHEN disposition IS NOT NULL THEN ' <' || disposition || '>' ELSE '' END,
    '  >  ' ORDER BY call_time) FILTER (WHERE call_id <> '') AS timeline,
  jsonb_agg(jsonb_build_object('seq', call_seq, 'phase', phase, 'call_time_ist', call_time_ist, 'connected', connected,
      'trigger', is_trigger_call, 'agent', answered_by_agent, 'talk_secs', conversation_secs, 'skill', skill_name,
      'recording', recording_url, 'issue_category', analysis_issue_category, 'secondary_category', analysis_secondary_category,
      'summary', analysis_summary, 'resolved', analysis_resolved, 'language', analysis_language, 'cc_tag', disposition)
    ORDER BY call_time) FILTER (WHERE call_id <> '') AS calls,
  count(*) FILTER (WHERE analysis_issue_category IS NOT NULL) AS calls_analysed,
  count(*) FILTER (WHERE disposition IS NOT NULL) AS calls_tagged
FROM public.rsa_cc_calls r
GROUP BY ticket_number;
