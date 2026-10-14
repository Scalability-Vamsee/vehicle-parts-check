-- IVR skill (option + language) per call: Already_Riding_* / Any_Other_help_* / Rent_Scooter_* / Sales_Call_Transfer / Customer_support_*.
-- Candidate signal for "is this call an RSA call" (14 Oct sample of 300 Sep calls: 62% of mapped calls came via Already_Riding).
ALTER TABLE public.smartflo_calls_raw ADD COLUMN IF NOT EXISTS skill_name text;
ALTER TABLE public.rsa_cc_calls       ADD COLUMN IF NOT EXISTS skill_name text;
GRANT SELECT (skill_name) ON public.smartflo_calls_raw TO authenticated;
GRANT SELECT (skill_name) ON public.rsa_cc_calls       TO authenticated;

DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.rsa_cc_calls_rebuild(integer)'::regprocedure);
  IF position('skill_name' in d) = 0 THEN
    d := replace(d, 'conversation_secs = c.conversation_secs', 'conversation_secs = c.conversation_secs, skill_name = c.skill_name');
    EXECUTE d;
  END IF;
END $$;
