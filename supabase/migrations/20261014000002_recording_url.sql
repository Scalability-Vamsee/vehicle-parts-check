-- Recording link per call: smartflo_calls_raw.recording_url (from the raw card) and rsa_cc_calls.recording_url
-- (copied by rsa_cc_calls_rebuild so all calls of a ticket can be listened to together).
-- Readable by RRR viewers (RLS already restricts rows); phone numbers remain blocked.
ALTER TABLE public.smartflo_calls_raw ADD COLUMN IF NOT EXISTS recording_url text;
ALTER TABLE public.rsa_cc_calls       ADD COLUMN IF NOT EXISTS recording_url text;
GRANT SELECT (recording_url) ON public.smartflo_calls_raw TO authenticated;
GRANT SELECT (recording_url) ON public.rsa_cc_calls       TO authenticated;

-- splice one UPDATE into rsa_cc_calls_rebuild() (before its RETURN) instead of retyping the whole function
DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.rsa_cc_calls_rebuild(integer)'::regprocedure);
  IF position('recording_url' in d) = 0 THEN
    d := replace(d, E'  RETURN v_n;',
      E'  UPDATE public.rsa_cc_calls r SET recording_url = c.recording_url\n'
      || E'    FROM public.smartflo_calls_raw c\n'
      || E'   WHERE c.call_id = r.call_id AND r.ticket_time >= v_from AND c.recording_url IS NOT NULL;\n'
      || E'  RETURN v_n;');
    EXECUTE d;
  END IF;
END $$;
