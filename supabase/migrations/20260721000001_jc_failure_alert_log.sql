-- jc_failure_alert_log: tracks which job_card failure IDs have been emailed
-- so the alert fn never sends duplicate alerts across cron runs
CREATE TABLE IF NOT EXISTS jc_failure_alert_log (
  job_card_id bigint      PRIMARY KEY,
  status      text,
  alerted_at  timestamptz DEFAULT now()
);

ALTER TABLE jc_failure_alert_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON jc_failure_alert_log
  USING (false);  -- edge fn uses service role key, bypasses RLS
