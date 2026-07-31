-- RSA-7: Duty log table for GPS-stamped start/end duty events from RSA Tech PWA
-- 2026-07-31

CREATE TABLE rsa_duty_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_id    uuid REFERENCES rsa_technicians(id) ON DELETE SET NULL,
  user_id    uuid NOT NULL,
  action     text NOT NULL CHECK (action IN ('start', 'end')),
  lat        double precision,
  lng        double precision,
  accuracy   double precision,
  note       text,
  logged_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rsa_duty_log_user_date ON rsa_duty_log (user_id, logged_at);
CREATE INDEX rsa_duty_log_tech_date ON rsa_duty_log (tech_id, logged_at);

ALTER TABLE rsa_duty_log ENABLE ROW LEVEL SECURITY;

-- Techs can insert and read their own rows
CREATE POLICY "tech own" ON rsa_duty_log FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RSA Warroom + Admin can read all rows
CREATE POLICY "rsa-admin read all" ON rsa_duty_log FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean IS TRUE
    OR EXISTS (
      SELECT 1 FROM user_groups ug
      WHERE ug.user_id = auth.uid()
        AND ug.group_id IN (
          'd1ca876a-c9a6-4479-863b-8cfc61ce48a3',  -- RSA Warroom
          'dd57c013-8da0-4e2c-b42b-fbd2ad30a585'   -- Admin
        )
    )
  );
