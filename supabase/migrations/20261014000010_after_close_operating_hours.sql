-- FINAL: "AFTER the ticket" window = 3 OPERATING hours after resolvedAt (night 22:00-07:00 IST does not count),
-- bucketed 0-1h / 1-2h / 2-3h of operating time (Vamsee, 14 Oct 2026). Before it was 3 wall-clock hours.
-- A ticket closed at 21:00 can therefore still collect the rider's calls until ~10:00 next morning.
-- Implementation: resolved_ops (operating-hours clock of resolvedAt) added to cand; the candidate window end is
-- widened to resolved + 12 h (superset), and the real cut is call_ops - resolved_ops <= 3.
-- Spliced into rsa_cc_calls_rebuild(); every pattern is checked first, nothing changes if one is missing.
DO $mig$
DECLARE d text; a text[]; b text[]; i int;
BEGIN
  d := pg_get_functiondef('public.rsa_cc_calls_rebuild(integer)'::regprocedure);
  IF position('resolved_ops' in d) > 0 THEN RETURN; END IF;
  a := ARRAY[
    $q$ELSE GREATEST(r.resolved_at, r.created_at) + INTERVAL '3 hours' END$q$,
    $q$t.ops_clock AS ticket_ops, tp.call_from$q$,
    $q$AND c.call_time BETWEEN t.created_at - INTERVAL '24 hours' AND t.win_end$q$,
    $q$WHEN cand.call_time <= cand.resolved_time + INTERVAL '1 hour'  THEN 'After close 0-1h'$q$,
    $q$WHEN cand.call_time <= cand.resolved_time + INTERVAL '2 hours' THEN 'After close 1-2h'$q$,
    $q$AND NOT EXISTS (SELECT 1 FROM bef WHERE bef.call_id = cand.call_id)$q$
  ];
  b := ARRAY[
    $q$ELSE GREATEST(r.resolved_at, r.created_at) + INTERVAL '12 hours' END$q$,
    $q$t.ops_clock AS ticket_ops, tp.call_from,
           (ro.ist::date - DATE '2000-01-01') * (cfg.ops_end - cfg.ops_start)
             + LEAST(GREATEST(EXTRACT(EPOCH FROM ro.ist::time)/3600.0 - cfg.ops_start, 0), cfg.ops_end - cfg.ops_start) AS resolved_ops$q$,
    $q$AND c.call_time BETWEEN t.created_at - INTERVAL '24 hours' AND t.win_end
    CROSS JOIN cfg
    CROSS JOIN LATERAL (SELECT t.resolved_time AT TIME ZONE 'Asia/Kolkata' AS ist) ro$q$,
    $q$WHEN cand.call_ops - cand.resolved_ops <= 1 THEN 'After close 0-1h'$q$,
    $q$WHEN cand.call_ops - cand.resolved_ops <= 2 THEN 'After close 1-2h'$q$,
    $q$AND NOT EXISTS (SELECT 1 FROM bef WHERE bef.call_id = cand.call_id)
      AND (cand.resolved_time IS NULL OR cand.call_time <= cand.resolved_time OR cand.call_ops - cand.resolved_ops <= 3)$q$
  ];
  FOR i IN 1..array_length(a, 1) LOOP
    IF position(a[i] in d) = 0 THEN RAISE EXCEPTION 'rebuild patch: pattern % not found', i; END IF;
    d := replace(d, a[i], b[i]);
  END LOOP;
  EXECUTE d;
END $mig$;
