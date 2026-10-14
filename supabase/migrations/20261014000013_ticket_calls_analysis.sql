-- rsa_ticket_calls: ticket-first view. One row per RSA ticket; `calls` = JSON list of every call grouped to it,
-- each tagged Before / During / After close, with recording link and (when the call was analysed) the
-- AI issue category + summary. Adds counts of analysed calls so coverage is visible per ticket.
-- security_invoker stays on (RLS of rsa_cc_calls applies). phone numbers are not in this view.
create or replace view public.rsa_ticket_calls with (security_invoker = true) as
select ticket_number,
  min(ticket_time_ist) as ticket_time_ist,
  min(resolved_time_ist) as resolved_time_ist,
  min(city) as city,
  min(category) as category,
  min(status) as status,
  count(*) filter (where call_id <> '') as calls_total,
  count(*) filter (where phase = 'Before ticket') as calls_before,
  count(*) filter (where phase = 'During ticket') as calls_during,
  count(*) filter (where phase like 'After close%') as calls_after_close,
  count(*) filter (where connected = 'Connected') as calls_connected,
  count(*) filter (where phase = 'Before ticket' and connected = 'Connected') as before_connected,
  count(*) filter (where phase = 'Before ticket' and connected <> 'Connected') as before_not_connected,
  min(call_time_ist) as first_call_ist,
  max(call_time_ist) as last_call_ist,
  string_agg(
    case phase when 'Before ticket' then 'BEFORE' when 'During ticket' then 'DURING' else 'AFTER' end
    || ' ' || to_char(call_time_ist, 'DD Mon HH24:MI')
    || case when connected = 'Connected' then ' answered' else ' missed' end
    || case when call_period = 'Night' then ' (night)' else '' end
    || case when is_trigger_call then ' [trigger]' else '' end
    || case when analysis_issue_category is not null then ' {' || analysis_issue_category || '}' else '' end,
    '  >  ' order by call_time) filter (where call_id <> '') as timeline,
  jsonb_agg(jsonb_build_object('seq', call_seq, 'phase', phase, 'call_time_ist', call_time_ist, 'connected', connected,
      'trigger', is_trigger_call, 'agent', answered_by_agent, 'talk_secs', conversation_secs, 'skill', skill_name,
      'recording', recording_url, 'issue_category', analysis_issue_category, 'secondary_category', analysis_secondary_category,
      'summary', analysis_summary, 'resolved', analysis_resolved, 'language', analysis_language)
    order by call_time) filter (where call_id <> '') as calls,
  count(*) filter (where analysis_issue_category is not null) as calls_analysed
from public.rsa_cc_calls r
group by ticket_number;
