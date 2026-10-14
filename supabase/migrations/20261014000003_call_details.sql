-- Extra per-call details from the raw card: who answered, queue, call type, longest talk leg.
-- smartflo_calls_raw gets all four; rsa_cc_calls gets the three useful for reviewing a ticket's calls.
ALTER TABLE public.smartflo_calls_raw
  ADD COLUMN IF NOT EXISTS answered_by_agent text,
  ADD COLUMN IF NOT EXISTS call_solution     text,
  ADD COLUMN IF NOT EXISTS inbound_queue     text,
  ADD COLUMN IF NOT EXISTS conversation_secs integer;
ALTER TABLE public.rsa_cc_calls
  ADD COLUMN IF NOT EXISTS answered_by_agent text,
  ADD COLUMN IF NOT EXISTS inbound_queue     text,
  ADD COLUMN IF NOT EXISTS conversation_secs integer;
GRANT SELECT (answered_by_agent, call_solution, inbound_queue, conversation_secs) ON public.smartflo_calls_raw TO authenticated;
GRANT SELECT (answered_by_agent, inbound_queue, conversation_secs)                ON public.rsa_cc_calls       TO authenticated;

-- widen the UPDATE spliced into rsa_cc_calls_rebuild() by migration 2 (copy all call details, not only rows with a link)
DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.rsa_cc_calls_rebuild(integer)'::regprocedure);
  IF position('answered_by_agent' in d) = 0 THEN
    d := replace(d, 'SET recording_url = c.recording_url',
                    'SET recording_url = c.recording_url, answered_by_agent = c.answered_by_agent, inbound_queue = c.inbound_queue, conversation_secs = c.conversation_secs');
    d := replace(d, ' AND c.recording_url IS NOT NULL;', ';');
    EXECUTE d;
  END IF;
END $$;
