-- One row per RSA ticket with ALL its calls grouped and tagged (BEFORE / DURING / AFTER), counts per group,
-- a readable timeline string and the ordered call list (with recording links) as JSON.
-- security_invoker: the viewer's own RLS / column grants apply (phone numbers are not part of it).
CREATE OR REPLACE VIEW public.rsa_ticket_calls WITH (security_invoker = true) AS
SELECT
  r.ticket_number,
  MIN(r.ticket_time_ist)     AS ticket_time_ist,
  MIN(r.resolved_time_ist)   AS resolved_time_ist,
  MIN(r.city)                AS city,
  MIN(r.category)            AS category,
  MIN(r.status)              AS status,
  COUNT(*) FILTER (WHERE r.call_id <> '')                                   AS calls_total,
  COUNT(*) FILTER (WHERE r.phase = 'Before ticket')                         AS calls_before,
  COUNT(*) FILTER (WHERE r.phase = 'During ticket')                         AS calls_during,
  COUNT(*) FILTER (WHERE r.phase LIKE 'After close%')                       AS calls_after_close,
  COUNT(*) FILTER (WHERE r.connected = 'Connected')                         AS calls_connected,
  COUNT(*) FILTER (WHERE r.phase = 'Before ticket' AND r.connected = 'Connected')     AS before_connected,
  COUNT(*) FILTER (WHERE r.phase = 'Before ticket' AND r.connected <> 'Connected')    AS before_not_connected,
  MIN(r.call_time_ist)       AS first_call_ist,
  MAX(r.call_time_ist)       AS last_call_ist,
  STRING_AGG(
    CASE r.phase WHEN 'Before ticket' THEN 'BEFORE' WHEN 'During ticket' THEN 'DURING' ELSE 'AFTER' END
      || ' ' || TO_CHAR(r.call_time_ist, 'DD Mon HH24:MI')
      || CASE WHEN r.connected = 'Connected' THEN ' answered' ELSE ' missed' END
      || CASE WHEN r.call_period = 'Night' THEN ' (night)' ELSE '' END
      || CASE WHEN r.is_trigger_call THEN ' [trigger]' ELSE '' END,
    '  >  ' ORDER BY r.call_time) FILTER (WHERE r.call_id <> '')             AS timeline,
  JSONB_AGG(JSONB_BUILD_OBJECT(
      'seq', r.call_seq, 'phase', r.phase, 'call_time_ist', r.call_time_ist, 'connected', r.connected,
      'trigger', r.is_trigger_call, 'agent', r.answered_by_agent, 'talk_secs', r.conversation_secs,
      'skill', r.skill_name, 'recording', r.recording_url) ORDER BY r.call_time) FILTER (WHERE r.call_id <> '') AS calls
FROM public.rsa_cc_calls r
GROUP BY r.ticket_number;
GRANT SELECT ON public.rsa_ticket_calls TO authenticated;
