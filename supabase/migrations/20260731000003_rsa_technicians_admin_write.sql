-- RSA-2b fix: allow superadmin + RSA Warroom + Admin to UPDATE rsa_technicians
-- (joining_date inline edit in Directory tab requires PATCH)
-- 2026-07-31

CREATE POLICY "rsa-admin update" ON rsa_technicians
  FOR UPDATE USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean IS TRUE
    OR EXISTS (
      SELECT 1 FROM user_groups ug
      WHERE ug.user_id = auth.uid()
        AND ug.group_id IN (
          'd1ca876a-c9a6-4479-863b-8cfc61ce48a3',  -- RSA Warroom
          'dd57c013-8da0-4e2c-b42b-fbd2ad30a585'   -- Admin
        )
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean IS TRUE
    OR EXISTS (
      SELECT 1 FROM user_groups ug
      WHERE ug.user_id = auth.uid()
        AND ug.group_id IN (
          'd1ca876a-c9a6-4479-863b-8cfc61ce48a3',
          'dd57c013-8da0-4e2c-b42b-fbd2ad30a585'
        )
    )
  );
