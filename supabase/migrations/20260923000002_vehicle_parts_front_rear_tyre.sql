-- Add front_tyre and rear_tyre columns to vehicle_parts_check_flag
-- Thresholds: disc front=12K rear=15K; drum front=12K rear=10K
-- Applied via Supabase MCP 2026-09-23

ALTER TABLE vehicle_parts_check_flag
  ADD COLUMN IF NOT EXISTS front_tyre_status text,
  ADD COLUMN IF NOT EXISTS front_tyre_km_since numeric,
  ADD COLUMN IF NOT EXISTS front_tyre_km_remaining numeric,
  ADD COLUMN IF NOT EXISTS last_front_tyre_replaced_date date,
  ADD COLUMN IF NOT EXISTS last_front_tyre_replaced_hub text,
  ADD COLUMN IF NOT EXISTS rear_tyre_status text,
  ADD COLUMN IF NOT EXISTS rear_tyre_km_since numeric,
  ADD COLUMN IF NOT EXISTS rear_tyre_km_remaining numeric,
  ADD COLUMN IF NOT EXISTS last_rear_tyre_replaced_date date,
  ADD COLUMN IF NOT EXISTS last_rear_tyre_replaced_hub text;
