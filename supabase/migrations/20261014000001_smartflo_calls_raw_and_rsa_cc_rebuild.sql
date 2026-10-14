-- Raw Smartflo calls (rolling 35 days) + pairing of calls to RSA tickets done in Postgres.
-- Replaces the Metabase-side pairing (card 64d56b96 / rsa-cc-calls-sync); validated 14 Oct against that card:
-- 30 of 31 days identical row for row (ticket|call|phase); today differed by 2 calls that reached Smartflo late.
-- PAIRING RULES (cfg CTE in rsa_cc_calls_rebuild):
--   1. Operating-hours clock: night 22:00-07:00 IST does not count (call 22:30 -> ticket 08:00 = 1.0 op-hour).
--   2. One call -> one ticket: a call belongs only to the NEXT ticket of that phone after it, if a day call is
--      <= day_thr (2.0) op-hours before it, a night call <= night_thr (5.0) op-hours (morning batch to ~12:00).
--      phase 'Before ticket'.
--   3. Other calls attach to the latest earlier ticket of that phone: 'During ticket' (to resolvedAt; open ticket
--      24h), 'After close 0-1h' / '1-2h' / '2-3h' (wall-clock after resolvedAt). Nothing past 48h after creation.
--   4. Match last 10 digits of customer_phone (Primary) or alternate_phone (Secondary); <10 digits never match.
--   5. is_trigger_call = latest connected inbound call before the ticket, else latest inbound before it.
--   6. connected = any leg of the call answered (smartflo_calls_raw.connected).

CREATE TABLE IF NOT EXISTS public.smartflo_calls_raw (
  call_id     text PRIMARY KEY,
  phone10     text,                       -- last 10 digits of Customer Number (PII: not client-readable)
  call_time   timestamptz NOT NULL,       -- first leg; Smartflo "Time" is the UTC clock
  direction   text,
  call_status text,                       -- 'Answered' if any leg answered, else the first leg's status
  connected   boolean,                    -- any leg answered
  legs        integer,
  did         text,
  synced_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS smartflo_calls_raw_time_idx  ON public.smartflo_calls_raw (call_time);
CREATE INDEX IF NOT EXISTS smartflo_calls_raw_phone_idx ON public.smartflo_calls_raw (phone10, call_time);
ALTER TABLE public.smartflo_calls_raw ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS smartflo_calls_raw_viewer_select ON public.smartflo_calls_raw;
CREATE POLICY smartflo_calls_raw_viewer_select ON public.smartflo_calls_raw FOR SELECT TO authenticated
  USING ((SELECT public.is_rrr_viewer()));
REVOKE ALL ON public.smartflo_calls_raw FROM anon, authenticated;
GRANT SELECT (call_id, call_time, direction, call_status, connected, legs, did, synced_at)
  ON public.smartflo_calls_raw TO authenticated;       -- phone10 deliberately excluded

CREATE OR REPLACE FUNCTION public.smartflo_calls_prune(p_days integer DEFAULT 35)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.smartflo_calls_raw WHERE call_time < now() - make_interval(days => p_days);
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.smartflo_calls_prune(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smartflo_calls_prune(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.rsa_cc_calls_rebuild(p_days integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '300s' AS $$
DECLARE v_from timestamptz; v_n integer; v_run timestamptz := now();
BEGIN
  v_from := (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - make_interval(days => p_days)) AT TIME ZONE 'Asia/Kolkata';
  DELETE FROM public.rsa_cc_calls WHERE ticket_time >= v_from;
  INSERT INTO public.rsa_cc_calls (
    ticket_number, call_id, ticket_time, ticket_time_ist, category, city, status, primary_phone, secondary_phone,
    call_from, call_time, call_time_ist, direction, call_status, did, phase, call_seq, call_period, connected,
    is_trigger_call, inbound_calls_before, inbound_connected_before, inbound_not_connected_before,
    night_inbound_before, outbound_calls_before, resolved_time, resolved_time_ist, inbound_during_ticket,
    inbound_after_close_0_1h, inbound_after_close_1_2h, inbound_after_close_2_3h, outbound_during_after,
    first_call_time_ist, wait_ops_hours, wait_clock_hours, ops_hours_before_ticket, clock_hours_before_ticket,
    hours_after_close, synced_at)
  WITH cfg AS (
    SELECT 7.0::numeric AS ops_start, 22.0::numeric AS ops_end, 2.0::numeric AS day_thr, 5.0::numeric AS night_thr
  ),
  calls AS (
    SELECT c.call_id, c.phone10, c.call_time, i.ist AS call_time_ist, c.direction, c.call_status, c.connected, c.did,
           (EXTRACT(EPOCH FROM i.ist::time)/3600.0 < cfg.ops_start OR EXTRACT(EPOCH FROM i.ist::time)/3600.0 >= cfg.ops_end) AS is_night,
           (i.ist::date - DATE '2000-01-01') * (cfg.ops_end - cfg.ops_start)
             + LEAST(GREATEST(EXTRACT(EPOCH FROM i.ist::time)/3600.0 - cfg.ops_start, 0), cfg.ops_end - cfg.ops_start) AS ops_clock
    FROM public.smartflo_calls_raw c CROSS JOIN cfg
    CROSS JOIN LATERAL (SELECT c.call_time AT TIME ZONE 'Asia/Kolkata' AS ist) i
    WHERE c.call_time >= v_from - INTERVAL '24 hours'
  ),
  t AS (
    SELECT r.ticket_number, r.created_at, i.ist AS ticket_time_ist,
           CASE WHEN r.resolved_at IS NULL THEN NULL ELSE GREATEST(r.resolved_at, r.created_at) END AS resolved_time,
           LEAST(CASE WHEN r.resolved_at IS NULL THEN r.created_at + INTERVAL '24 hours'
                      ELSE GREATEST(r.resolved_at, r.created_at) + INTERVAL '3 hours' END,
                 r.created_at + INTERVAL '48 hours') AS win_end,
           r.category, UPPER(r.city) AS city, r.status,
           RIGHT(REGEXP_REPLACE(COALESCE(r.customer_phone,''),'\D','','g'),10)  AS primary_phone,
           RIGHT(REGEXP_REPLACE(COALESCE(r.alternate_phone,''),'\D','','g'),10) AS secondary_phone,
           (i.ist::date - DATE '2000-01-01') * (cfg.ops_end - cfg.ops_start)
             + LEAST(GREATEST(EXTRACT(EPOCH FROM i.ist::time)/3600.0 - cfg.ops_start, 0), cfg.ops_end - cfg.ops_start) AS ops_clock
    FROM public.rsa_tickets_raw r CROSS JOIN cfg
    CROSS JOIN LATERAL (SELECT r.created_at AT TIME ZONE 'Asia/Kolkata' AS ist) i
    WHERE r.created_at >= v_from
  ),
  tp AS (
    SELECT ticket_number, primary_phone AS phone10, 'Primary' AS call_from FROM t WHERE LENGTH(primary_phone) = 10
    UNION ALL
    SELECT ticket_number, secondary_phone, 'Secondary' FROM t
    WHERE LENGTH(secondary_phone) = 10 AND secondary_phone IS DISTINCT FROM primary_phone
  ),
  cand AS (
    SELECT c.call_id, c.call_time, c.call_time_ist, c.direction, c.call_status, c.connected, c.did,
           c.is_night, c.ops_clock AS call_ops,
           t.ticket_number, t.created_at, t.resolved_time, t.ops_clock AS ticket_ops, tp.call_from
    FROM tp JOIN t ON t.ticket_number = tp.ticket_number
    JOIN calls c ON c.phone10 = tp.phone10
                AND c.call_time BETWEEN t.created_at - INTERVAL '24 hours' AND t.win_end
  ),
  nxt AS (
    SELECT DISTINCT ON (call_id) cand.*, (ticket_ops - call_ops) AS ops_gap
    FROM cand WHERE call_time <= created_at
    ORDER BY call_id, created_at, ticket_number
  ),
  bef AS (
    SELECT nxt.*, 'Before ticket' AS phase FROM nxt CROSS JOIN cfg
    WHERE nxt.ops_gap <= CASE WHEN nxt.is_night THEN cfg.night_thr ELSE cfg.day_thr END
  ),
  aft AS (
    SELECT DISTINCT ON (cand.call_id) cand.*, (cand.ticket_ops - cand.call_ops) AS ops_gap,
           CASE WHEN cand.resolved_time IS NULL OR cand.call_time <= cand.resolved_time THEN 'During ticket'
                WHEN cand.call_time <= cand.resolved_time + INTERVAL '1 hour'  THEN 'After close 0-1h'
                WHEN cand.call_time <= cand.resolved_time + INTERVAL '2 hours' THEN 'After close 1-2h'
                ELSE 'After close 2-3h' END AS phase
    FROM cand
    WHERE cand.call_time > cand.created_at
      AND NOT EXISTS (SELECT 1 FROM bef WHERE bef.call_id = cand.call_id)
    ORDER BY cand.call_id, cand.created_at DESC, cand.ticket_number
  ),
  m AS (SELECT * FROM bef UNION ALL SELECT * FROM aft),
  g AS (
    SELECT m.*,
           ROW_NUMBER() OVER (PARTITION BY m.ticket_number ORDER BY m.call_time, m.call_id) AS call_seq,
           (ROW_NUMBER() OVER (PARTITION BY m.ticket_number
                               ORDER BY (m.phase = 'Before ticket' AND m.direction = 'Inbound') DESC,
                                        COALESCE(m.connected, FALSE) DESC, m.call_time DESC, m.call_id) = 1
            AND m.phase = 'Before ticket' AND m.direction = 'Inbound') AS is_trigger_call,
           COUNT(*) FILTER (WHERE m.phase = 'Before ticket' AND m.direction = 'Inbound') OVER (PARTITION BY m.ticket_number) AS inbound_calls_before,
           COUNT(*) FILTER (WHERE m.phase = 'Before ticket' AND m.direction = 'Inbound' AND m.connected) OVER (PARTITION BY m.ticket_number) AS inbound_connected_before,
           COUNT(*) FILTER (WHERE m.phase = 'Before ticket' AND m.direction = 'Inbound' AND m.is_night) OVER (PARTITION BY m.ticket_number) AS night_inbound_before,
           COUNT(*) FILTER (WHERE m.phase = 'Before ticket' AND m.direction = 'Outbound') OVER (PARTITION BY m.ticket_number) AS outbound_calls_before,
           COUNT(*) FILTER (WHERE m.phase = 'During ticket' AND m.direction = 'Inbound') OVER (PARTITION BY m.ticket_number) AS inbound_during_ticket,
           COUNT(*) FILTER (WHERE m.phase = 'After close 0-1h' AND m.direction = 'Inbound') OVER (PARTITION BY m.ticket_number) AS inbound_after_close_0_1h,
           COUNT(*) FILTER (WHERE m.phase = 'After close 1-2h' AND m.direction = 'Inbound') OVER (PARTITION BY m.ticket_number) AS inbound_after_close_1_2h,
           COUNT(*) FILTER (WHERE m.phase = 'After close 2-3h' AND m.direction = 'Inbound') OVER (PARTITION BY m.ticket_number) AS inbound_after_close_2_3h,
           COUNT(*) FILTER (WHERE m.phase <> 'Before ticket' AND m.direction = 'Outbound') OVER (PARTITION BY m.ticket_number) AS outbound_during_after,
           MIN(m.call_time) FILTER (WHERE m.phase = 'Before ticket' AND m.direction = 'Inbound') OVER (PARTITION BY m.ticket_number) AS first_call_time,
           MAX(m.ops_gap) FILTER (WHERE m.phase = 'Before ticket' AND m.direction = 'Inbound') OVER (PARTITION BY m.ticket_number) AS wait_ops_hours
    FROM m
  )
  SELECT t.ticket_number, COALESCE(g.call_id, ''), t.created_at, t.ticket_time_ist, t.category, t.city, t.status,
         t.primary_phone, t.secondary_phone,
         COALESCE(g.call_from, 'No call found'), g.call_time, g.call_time_ist, g.direction, g.call_status, g.did,
         COALESCE(g.phase, '—'), g.call_seq,
         CASE WHEN g.call_id IS NULL THEN NULL WHEN g.is_night THEN 'Night' ELSE 'Day' END,
         CASE WHEN g.call_id IS NULL THEN NULL WHEN g.connected THEN 'Connected' ELSE 'Not connected' END,
         COALESCE(g.is_trigger_call, FALSE),
         COALESCE(g.inbound_calls_before, 0), COALESCE(g.inbound_connected_before, 0),
         COALESCE(g.inbound_calls_before, 0) - COALESCE(g.inbound_connected_before, 0),
         COALESCE(g.night_inbound_before, 0), COALESCE(g.outbound_calls_before, 0),
         t.resolved_time, t.resolved_time AT TIME ZONE 'Asia/Kolkata',
         COALESCE(g.inbound_during_ticket, 0), COALESCE(g.inbound_after_close_0_1h, 0),
         COALESCE(g.inbound_after_close_1_2h, 0), COALESCE(g.inbound_after_close_2_3h, 0),
         COALESCE(g.outbound_during_after, 0),
         g.first_call_time AT TIME ZONE 'Asia/Kolkata',
         ROUND(g.wait_ops_hours::numeric, 2),
         ROUND((EXTRACT(EPOCH FROM (t.created_at - g.first_call_time)) / 3600)::numeric, 2),
         ROUND(g.ops_gap::numeric, 2),
         ROUND((EXTRACT(EPOCH FROM (t.created_at - g.call_time)) / 3600)::numeric, 2),
         CASE WHEN g.call_id IS NULL OR t.resolved_time IS NULL THEN NULL
              ELSE ROUND((EXTRACT(EPOCH FROM (g.call_time - t.resolved_time)) / 3600)::numeric, 2) END,
         v_run
  FROM t LEFT JOIN g ON g.ticket_number = t.ticket_number;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.rsa_cc_calls_rebuild(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rsa_cc_calls_rebuild(integer) TO service_role;

-- which phone lines (DIDs) carry RSA traffic: calls per line vs calls that were paired to a ticket
CREATE OR REPLACE VIEW public.rsa_did_profile WITH (security_invoker = true) AS
SELECT c.did,
       COUNT(*)                                            AS calls_30d,
       COUNT(*) FILTER (WHERE c.direction = 'Inbound')     AS inbound,
       COUNT(*) FILTER (WHERE c.connected)                 AS connected,
       COUNT(*) FILTER (WHERE x.call_id IS NOT NULL)       AS linked_before_ticket,
       ROUND(100.0 * COUNT(*) FILTER (WHERE x.call_id IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE c.direction = 'Inbound'), 0), 1)
                                                           AS pct_inbound_linked
FROM public.smartflo_calls_raw c
LEFT JOIN (SELECT DISTINCT call_id FROM public.rsa_cc_calls WHERE phase = 'Before ticket') x ON x.call_id = c.call_id
WHERE c.call_time >= now() - INTERVAL '30 days'
GROUP BY c.did
ORDER BY linked_before_ticket DESC;
GRANT SELECT ON public.rsa_did_profile TO authenticated;
