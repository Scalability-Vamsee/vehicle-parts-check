-- Enable Supabase Realtime for rsa_tickets_cache so the RSA Tech PWA
-- can subscribe to INSERT/UPDATE events and fire the in-app buzzer.
-- Applied live 2026-08-14 via Supabase MCP (not via migration runner).
-- REPLICA IDENTITY FULL is required so UPDATE payloads include the old row
-- (needed for technician_name filtering in the realtime subscription).

ALTER TABLE rsa_tickets_cache REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE rsa_tickets_cache;
