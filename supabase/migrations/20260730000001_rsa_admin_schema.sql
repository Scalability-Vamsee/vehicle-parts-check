-- RSA Admin Module — RSA-1
-- 2026-07-30
-- Adds: rsa-admin feature key, extends rsa_technicians, creates 5 admin tables,
--       seeds 10 team members + vehicle assignments + roster template + core assets
--
-- Tables: rsa_roster_template, rsa_roster_overrides, rsa_vehicle_assignments,
--         rsa_spare_ledger (parts ledger), rsa_core_assets (binary equipment tracking)
-- W/O day behaviour: is_working=false → tech hidden from warroom map + greyed in field selector

-- ── Feature key ──
INSERT INTO group_features (group_id, feature_key) VALUES
  ('d1ca876a-c9a6-4479-863b-8cfc61ce48a3', 'rsa-admin'),  -- RSA Warroom group
  ('dd57c013-8da0-4e2c-b42b-fbd2ad30a585', 'rsa-admin')   -- Admin group
ON CONFLICT (group_id, feature_key) DO NOTHING;

-- ── Extend rsa_technicians ──
ALTER TABLE rsa_technicians ALTER COLUMN email DROP NOT NULL;
ALTER TABLE rsa_technicians DROP CONSTRAINT IF EXISTS rsa_technicians_id_fkey;
ALTER TABLE rsa_technicians DROP CONSTRAINT IF EXISTS rsa_technicians_city_check;
ALTER TABLE rsa_technicians
  ADD COLUMN IF NOT EXISTS employee_id      text,
  ADD COLUMN IF NOT EXISTS hub_id           integer REFERENCES rental_locations(id),
  ADD COLUMN IF NOT EXISTS city             text,
  ADD COLUMN IF NOT EXISTS working_location text;
ALTER TABLE rsa_technicians
  ADD CONSTRAINT rsa_technicians_city_check CHECK (city IN ('BLR','NCR','HYD','HO'));

-- ── Seed RSA team (7 field techs + 3 HO) ──
DELETE FROM rsa_technicians WHERE name = 'Vamsee Voruganti';

-- PII (phone/email) intentionally omitted from git — add via admin UI after deploy
INSERT INTO rsa_technicians (id, name, employee_id, city, working_location, is_active) VALUES
  (gen_random_uuid(), 'Nishanth CK',   'WRC2011',  'BLR', 'BLR - YPR',      true),
  (gen_random_uuid(), 'Pavan M',       'WRC2091',  'BLR', 'BLR - RR Nagara',true),
  (gen_random_uuid(), 'Bhoja',         'WRCT0180', 'BLR', 'BLR - Central',   true),
  (gen_random_uuid(), 'Akhil',         'WRCT0287', 'BLR', 'BLR - HSR',       true),
  (gen_random_uuid(), 'Nagendra Verma','WRCT0302', 'NCR', 'NCR - Ohkla',     true),
  (gen_random_uuid(), 'Tara Chand',    'WRCT0303', 'NCR', 'NCR - Rohini',    true),
  (gen_random_uuid(), 'Karan Luitel',  NULL,        'BLR', 'BLR - Hoodi',    true),
  (gen_random_uuid(), 'Venkatesh',     'WRC2215',  'HO',  'HO',              true),
  (gen_random_uuid(), 'Nabhir',        'WRCT0173', 'HO',  'HO',              true),
  (gen_random_uuid(), 'Haseeb',        NULL,        'HO', 'HO',              true)
ON CONFLICT DO NOTHING;

-- ── Create 5 admin tables ──

-- 1. rsa_roster_template: default working pattern per tech
--    is_working=false → hidden from warroom map + greyed in field selector
CREATE TABLE IF NOT EXISTS rsa_roster_template (
  id          uuid     DEFAULT gen_random_uuid() PRIMARY KEY,
  tech_id     uuid     NOT NULL REFERENCES rsa_technicians(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun…6=Sat
  hub_id      integer  REFERENCES rental_locations(id),
  is_working  boolean  DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (tech_id, day_of_week)
);

-- 2. rsa_roster_overrides: per-week exceptions (leave, WO, hub swap)
CREATE TABLE IF NOT EXISTS rsa_roster_overrides (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  tech_id     uuid    NOT NULL REFERENCES rsa_technicians(id) ON DELETE CASCADE,
  week_start  date    NOT NULL,              -- Monday of the target week
  hub_id      integer REFERENCES rental_locations(id),
  is_on_leave boolean DEFAULT false,
  note        text,
  created_by  uuid    REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (tech_id, week_start)
);

-- 3. rsa_vehicle_assignments: tech ↔ chassis (replaces hardcoded RSA_BIKES arrays)
CREATE TABLE IF NOT EXISTS rsa_vehicle_assignments (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tech_id        uuid NOT NULL REFERENCES rsa_technicians(id) ON DELETE CASCADE,
  chassis_number text NOT NULL,
  reg_number     text,
  assigned_at    timestamptz DEFAULT now(),
  unassigned_at  timestamptz,
  is_active      boolean DEFAULT true,
  note           text,
  created_by     uuid REFERENCES auth.users(id)
);

-- 4. rsa_spare_ledger: parts inventory per tech (proper ledger with history)
CREATE TABLE IF NOT EXISTS rsa_spare_ledger (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tech_id    uuid NOT NULL REFERENCES rsa_technicians(id) ON DELETE CASCADE,
  hub_id     integer REFERENCES rental_locations(id),
  part_name  text NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('in','out','adjustment')),
  quantity   integer NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  jc_id      text,
  entered_by uuid REFERENCES auth.users(id),
  note       text,
  created_at timestamptz DEFAULT now()
);

-- 5. rsa_core_assets: binary equipment tracking (laptop, tools, etc.)
--    Extensible: add new asset types without schema changes
CREATE TABLE IF NOT EXISTS rsa_core_assets (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  tech_id     uuid    NOT NULL REFERENCES rsa_technicians(id) ON DELETE CASCADE,
  asset_name  text    NOT NULL,   -- 'Laptop Bounce', 'Laptop SMPL', 'Tools', 'Ops App'
  is_issued   boolean DEFAULT false,
  issued_at   date,
  returned_at date,
  note        text,
  updated_by  uuid    REFERENCES auth.users(id),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (tech_id, asset_name)
);

-- ── RLS ──
ALTER TABLE rsa_roster_template     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsa_roster_overrides    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsa_vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsa_spare_ledger        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsa_core_assets         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read" ON rsa_roster_template     FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated read" ON rsa_roster_overrides    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated read" ON rsa_vehicle_assignments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated read" ON rsa_spare_ledger        FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated read" ON rsa_core_assets         FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "rsa-admin write" ON rsa_roster_template FOR ALL USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean IS TRUE
  OR EXISTS (SELECT 1 FROM user_groups ug WHERE ug.user_id = auth.uid()
             AND ug.group_id IN ('d1ca876a-c9a6-4479-863b-8cfc61ce48a3','dd57c013-8da0-4e2c-b42b-fbd2ad30a585'))
);
CREATE POLICY "rsa-admin write" ON rsa_roster_overrides FOR ALL USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean IS TRUE
  OR EXISTS (SELECT 1 FROM user_groups ug WHERE ug.user_id = auth.uid()
             AND ug.group_id IN ('d1ca876a-c9a6-4479-863b-8cfc61ce48a3','dd57c013-8da0-4e2c-b42b-fbd2ad30a585'))
);
CREATE POLICY "rsa-admin write" ON rsa_vehicle_assignments FOR ALL USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean IS TRUE
  OR EXISTS (SELECT 1 FROM user_groups ug WHERE ug.user_id = auth.uid()
             AND ug.group_id IN ('d1ca876a-c9a6-4479-863b-8cfc61ce48a3','dd57c013-8da0-4e2c-b42b-fbd2ad30a585'))
);
CREATE POLICY "rsa-admin write" ON rsa_spare_ledger FOR ALL USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean IS TRUE
  OR EXISTS (SELECT 1 FROM user_groups ug WHERE ug.user_id = auth.uid()
             AND ug.group_id IN ('d1ca876a-c9a6-4479-863b-8cfc61ce48a3','dd57c013-8da0-4e2c-b42b-fbd2ad30a585'))
);
CREATE POLICY "rsa-admin write" ON rsa_core_assets FOR ALL USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean IS TRUE
  OR EXISTS (SELECT 1 FROM user_groups ug WHERE ug.user_id = auth.uid()
             AND ug.group_id IN ('d1ca876a-c9a6-4479-863b-8cfc61ce48a3','dd57c013-8da0-4e2c-b42b-fbd2ad30a585'))
);

-- ── Seed vehicle assignments ──
INSERT INTO rsa_vehicle_assignments (tech_id, chassis_number, reg_number, is_active)
SELECT t.id, v.chassis, v.reg, true
FROM rsa_technicians t
JOIN (VALUES
  ('Nishanth CK',   'P6EBE1JYK25000288', 'KA05AR5056'),
  ('Pavan M',       'P6EBE1JYK25000072', 'KA05AR3238'),
  ('Bhoja',         'P6EBE1JYH25000416', 'KA05AR0387'),
  ('Akhil',         'P6EBE1RYG25000038', 'KA05AQ9282'),
  ('Nagendra Verma','P6EBE1FCM24000029', 'UP32QC5462'),
  ('Tara Chand',    'P6EBE1RCL24000005', 'UP32QC3889'),
  ('Karan Luitel',  'P6EBE1PBC26000599', 'BLRBD03198')
) AS v(name, chassis, reg) ON t.name = v.name
ON CONFLICT DO NOTHING;

-- ── Seed roster template ──
-- 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
-- Sunday off all; each tech has one W/O day Mon-Sat per warroom sheet
INSERT INTO rsa_roster_template (tech_id, day_of_week, is_working)
SELECT t.id, d.dow,
  CASE
    WHEN d.dow = 0 THEN false
    WHEN t.name = 'Nabhir'         AND d.dow = 3 THEN false  -- Wed
    WHEN t.name = 'Haseeb'         AND d.dow = 5 THEN false  -- Fri
    WHEN t.name = 'Nishanth CK'    AND d.dow = 2 THEN false  -- Tue
    WHEN t.name = 'Pavan M'        AND d.dow = 3 THEN false  -- Wed
    WHEN t.name = 'Akhil'          AND d.dow = 4 THEN false  -- Thu
    WHEN t.name = 'Bhoja'          AND d.dow = 5 THEN false  -- Fri
    WHEN t.name = 'Tara Chand'     AND d.dow = 2 THEN false  -- Tue
    WHEN t.name = 'Nagendra Verma' AND d.dow = 3 THEN false  -- Wed
    ELSE true
  END
FROM rsa_technicians t
CROSS JOIN (SELECT generate_series(0,6) AS dow) d
ON CONFLICT (tech_id, day_of_week) DO NOTHING;

-- ── Seed core assets (from warroom tracking sheet) ──
INSERT INTO rsa_core_assets (tech_id, asset_name, is_issued)
SELECT t.id, a.asset_name, true
FROM rsa_technicians t
JOIN (VALUES
  ('Bhoja',        'Tools'),
  ('Bhoja',        'Laptop Bounce'),
  ('Karan Luitel', 'Tools'),
  ('Karan Luitel', 'Laptop Bounce'),
  ('Akhil',        'Tools'),
  ('Pavan M',      'Tools'),
  ('Pavan M',      'Laptop Bounce'),
  ('Pavan M',      'Laptop SMPL'),
  ('Nishanth CK',  'Tools'),
  ('Nishanth CK',  'Laptop Bounce'),
  ('Nishanth CK',  'Laptop SMPL')
) AS a(tech_name, asset_name) ON t.name = a.tech_name
ON CONFLICT (tech_id, asset_name) DO UPDATE SET is_issued = true;
