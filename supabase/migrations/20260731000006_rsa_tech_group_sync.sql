-- RSA-7: Auto-assign RSA tech group memberships based on rsa_technicians directory
-- Field techs (city != 'HO') → RSA Field Team (fw-map + tech-app)
-- HO users (city = 'HO')    → RSA Warroom (fw-map + rsa-warroom + rsa-admin)
-- Daily cron at 02:00 IST (20:30 UTC): picks up new techs after first sign-in
-- 2026-07-31

CREATE OR REPLACE FUNCTION sync_rsa_tech_groups()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer := 0;
  n integer;
BEGIN
  -- Field techs → RSA Field Team
  INSERT INTO user_groups (user_id, group_id)
  SELECT au.id, 'b49203bb-0395-4263-a7ec-d9b707b89ecc'::uuid
  FROM auth.users au
  JOIN rsa_technicians rt ON lower(rt.email) = lower(au.email)
  WHERE rt.city != 'HO'
    AND rt.is_active = true
    AND rt.email IS NOT NULL
  ON CONFLICT (user_id, group_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  inserted := inserted + n;

  -- HO users → RSA Warroom
  INSERT INTO user_groups (user_id, group_id)
  SELECT au.id, 'd1ca876a-c9a6-4479-863b-8cfc61ce48a3'::uuid
  FROM auth.users au
  JOIN rsa_technicians rt ON lower(rt.email) = lower(au.email)
  WHERE rt.city = 'HO'
    AND rt.is_active = true
    AND rt.email IS NOT NULL
  ON CONFLICT (user_id, group_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  inserted := inserted + n;

  RETURN inserted;
END;
$$;

-- Run immediately on migration
SELECT sync_rsa_tech_groups() AS newly_assigned;

-- Daily sync at 02:00 IST (20:30 UTC)
SELECT cron.schedule(
  'rsa-tech-group-sync',
  '30 20 * * *',
  $$SELECT sync_rsa_tech_groups();$$
);
