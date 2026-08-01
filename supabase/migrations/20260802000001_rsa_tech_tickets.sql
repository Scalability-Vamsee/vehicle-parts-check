-- RSA Tech PWA — Ticket flow support tables
-- 2026-08-02

-- Push subscriptions for Web Push (VAPID, Phase 2 enhancement)
CREATE TABLE IF NOT EXISTS rsa_tech_push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tech_id UUID REFERENCES rsa_technicians(id),
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id)  -- one subscription per user (upsert replaces on re-subscribe)
);
ALTER TABLE rsa_tech_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subs" ON rsa_tech_push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Push sent log — SW polling uses this to avoid re-alerting already-seen tickets
CREATE TABLE IF NOT EXISTS rsa_push_sent_log (
  id SERIAL PRIMARY KEY,
  ticket_number TEXT NOT NULL,
  user_id UUID NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_number, user_id)
);
ALTER TABLE rsa_push_sent_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read" ON rsa_push_sent_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON rsa_push_sent_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Live tech GPS (PWA writes every 10s active / 60s background; warroom reads as live dots)
CREATE TABLE IF NOT EXISTS rsa_tech_live_locations (
  id BIGSERIAL PRIMARY KEY,
  tech_id UUID NOT NULL REFERENCES rsa_technicians(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rsa_tech_live_loc
  ON rsa_tech_live_locations(tech_id, recorded_at DESC);
ALTER TABLE rsa_tech_live_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read" ON rsa_tech_live_locations
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "own insert" ON rsa_tech_live_locations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM rsa_technicians t
      WHERE t.id = tech_id
        AND lower(t.email) = lower(auth.email())
    )
  );

-- Latest live location per tech (for warroom map layer)
CREATE OR REPLACE VIEW rsa_tech_live_latest AS
SELECT DISTINCT ON (tech_id)
  l.tech_id,
  t.name AS tech_name,
  t.working_location,
  l.lat, l.lng, l.accuracy, l.recorded_at
FROM rsa_tech_live_locations l
JOIN rsa_technicians t ON t.id = l.tech_id
ORDER BY tech_id, recorded_at DESC;

-- Evidence photos bucket (reached location + end work photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rsa-tech-evidence',
  'rsa-tech-evidence',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "rsa tech evidence upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rsa-tech-evidence');

CREATE POLICY "rsa tech evidence read" ON storage.objects
  FOR SELECT USING (bucket_id = 'rsa-tech-evidence');

-- 7-day retention cleanup for live locations
SELECT cron.schedule(
  'cleanup-rsa-tech-live-locs',
  '0 3 * * *',
  $$DELETE FROM rsa_tech_live_locations WHERE recorded_at < NOW() - INTERVAL '7 days'$$
);
