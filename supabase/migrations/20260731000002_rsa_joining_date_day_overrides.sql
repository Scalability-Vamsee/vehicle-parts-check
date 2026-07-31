-- RSA-2b: joining_date on rsa_technicians + day-level roster overrides
-- 2026-07-31

-- ── 1. Add joining_date to rsa_technicians ──
ALTER TABLE rsa_technicians
  ADD COLUMN IF NOT EXISTS joining_date date;

-- ── 2. rsa_day_overrides: per-(tech, date) status override ──
--    Replaces the week-level rsa_roster_overrides for per-day scheduling.
--    status: 'W' = working, 'W/O' = day off, 'Leave' = on leave (shows NA on roster)
CREATE TABLE IF NOT EXISTS rsa_day_overrides (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tech_id       uuid NOT NULL REFERENCES rsa_technicians(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  status        text NOT NULL CHECK (status IN ('W','W/O','Leave')),
  note          text,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  UNIQUE (tech_id, override_date)
);

ALTER TABLE rsa_day_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read" ON rsa_day_overrides
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "rsa-admin write" ON rsa_day_overrides FOR ALL USING (
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
