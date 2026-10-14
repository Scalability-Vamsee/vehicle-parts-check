-- FINAL pairing windows (Vamsee, 14 Oct 2026):
--   BEFORE the ticket : call <= 2 OPERATING hours before ticket creation, for day AND night calls
--                       (night_thr 5.0 -> 2.0; day_thr already 2.0; night 22:00-07:00 IST does not count).
--   DURING the ticket : from creation to resolvedAt (open ticket: 24 h), unchanged.
--   AFTER the ticket  : 3 hours (wall-clock) after resolvedAt, in 0-1h / 1-2h / 2-3h buckets, unchanged.
-- Impact measured before applying: 366 of 14,269 before-calls (all overnight, ticket created 9 AM-noon) drop; 6 of 6,956 tickets lose all before-calls.
DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.rsa_cc_calls_rebuild(integer)'::regprocedure);
  IF position('5.0::numeric AS night_thr' in d) > 0 THEN
    d := replace(d, '5.0::numeric AS night_thr', '2.0::numeric AS night_thr');
    EXECUTE d;
  END IF;
END $$;
