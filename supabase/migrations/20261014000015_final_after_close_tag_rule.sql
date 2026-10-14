-- FINAL RSA call windows (Vamsee, 14 Oct, after the CC-team tag became available):
--   BEFORE = up to 2 operating hours before ticket creation (unchanged)
--   DURING = ticket creation -> resolvedAt (unchanged)
--   AFTER  = up to 1 OPERATING hour after resolvedAt (was 3), and only calls whose CC tag ("Disposition Names") is a
--            fault or service follow-up, or that have no tag (missed calls). Calls tagged plan / extension / return /
--            general enquiry / dropped / language are not counted as after-close calls of the ticket.
-- Tag grouping (rsa_tag_group): fault = RSA__* (except call-not-received / waiting-for-porter / porter-not-booked), SMPL__*,
-- AR_ vehicle-not-moving/wont-start/battery/flat tyre/swap/damage, Vehicle_issue__* (except damages fee / rental expired);
-- followup = those three RSA__ tags, Hub_Related__*, AR_ Service Delay at Hub; neutral = GEN_*, General*, Wrap up*, call_disconnected,
-- Already spoke; notrsa = everything else.
CREATE OR REPLACE FUNCTION public.rsa_tag_group(d text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d IS NULL OR btrim(d) = '' THEN NULL
    WHEN regexp_replace(btrim(d), '\s+', ' ', 'g') ~ '^(RSA__(Call not received|Waiting for Porter|Porter not booked)|Hub_Related__|AR_ Service Delay at Hub)' THEN 'followup'
    WHEN regexp_replace(btrim(d), '\s+', ' ', 'g') ~ '^(RSA__|SMPL__)' THEN 'fault'
    WHEN regexp_replace(btrim(d), '\s+', ' ', 'g') ~ '^AR_ (Vehicle Not Moving|Vehicle Wont Start|Battery Issue|Flat Tyre|Sun Mobility Battery Swap|Vehicle Damage)' THEN 'fault'
    WHEN regexp_replace(btrim(d), '\s+', ' ', 'g') ~ '^Vehicle_issue__' AND regexp_replace(btrim(d), '\s+', ' ', 'g') !~ '(damages fee|Rental expired)' THEN 'fault'
    WHEN regexp_replace(btrim(d), '\s+', ' ', 'g') ~ '^(GEN_|General|Wrap up|call_disconnected|Already spoke)' THEN 'neutral'
    ELSE 'notrsa' END
$$;

DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.rsa_cc_calls_rebuild(integer)'::regprocedure);
  IF position('rsa_tag_group' in d) = 0 THEN
    d := replace(d, 'SELECT c.call_id, c.phone10, c.call_time, i.ist AS call_time_ist,', 'SELECT c.call_id, c.phone10, c.call_time, c.disposition, i.ist AS call_time_ist,');
    d := replace(d, 'SELECT c.call_id, c.call_time, c.call_time_ist, c.direction,', 'SELECT c.call_id, c.call_time, c.disposition, c.call_time_ist, c.direction,');
    d := replace(d, 'OR cand.call_ops - cand.resolved_ops <= 3)',
      'OR (cand.call_ops - cand.resolved_ops <= 1 AND COALESCE(public.rsa_tag_group(cand.disposition), ''untagged'') IN (''fault'', ''followup'', ''untagged'')))');
    IF position('rsa_tag_group' in d) = 0 OR position('c.disposition, i.ist' in d) = 0 OR position('c.disposition, c.call_time_ist' in d) = 0 THEN
      RAISE EXCEPTION 'rebuild patch did not apply';
    END IF;
    EXECUTE d;
  END IF;
END $$;
