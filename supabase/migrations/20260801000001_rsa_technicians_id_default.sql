-- Fix: rsa_technicians.id had no DEFAULT after FK to auth.users was dropped in RSA-1.
-- New techs added via the Directory UI failed because no id was supplied by the client.
-- 2026-08-01

ALTER TABLE rsa_technicians ALTER COLUMN id SET DEFAULT gen_random_uuid();
