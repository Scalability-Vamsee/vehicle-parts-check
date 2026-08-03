-- Add action_taken column to rsa_tickets_cache
-- Populated by rsa-ticket-sync edge function: joins ticket_events for DONE tickets
-- and writes resolution_type (fixed/parts_needed/workshop/customer_issue) from
-- the last 'completed' event written by rsa-tech.html.
-- Applied via Supabase MCP on 2026-08-04.

ALTER TABLE rsa_tickets_cache ADD COLUMN IF NOT EXISTS action_taken text;

-- Also update rsa_tickets_live view to expose action_taken
CREATE OR REPLACE VIEW rsa_tickets_live AS
 SELECT t.ticket_number,
    t.status,
    t.category,
    t.reg_number,
    t.technician_name,
    t.fault_details,
    t.created_at_ist,
    t.inprogress_at_ist,
    t.resolved_at_ist,
    t.tat_minutes,
    t.city,
    t.synced_at,
    t.lat,
    t.lng,
    t.live_lat,
    t.live_lng,
    t.customer_name,
    t.customer_phone,
    t.bass_location_time_ist AS loc_time,
        CASE
            WHEN (
            CASE
                WHEN (e.event_type = 'completed'::text) THEN 'DONE'::text
                ELSE t.status
            END = 'DONE'::text) THEN t.lat
            ELSE COALESCE(t.live_lat, t.lat)
        END AS display_lat,
        CASE
            WHEN (
            CASE
                WHEN (e.event_type = 'completed'::text) THEN 'DONE'::text
                ELSE t.status
            END = 'DONE'::text) THEN t.lng
            ELSE COALESCE(t.live_lng, t.lng)
        END AS display_lng,
        CASE
            WHEN (e.event_type = 'completed'::text) THEN 'DONE'::text
            ELSE t.status
        END AS effective_status,
    e.event_type AS latest_event_type,
    e.created_at AS latest_event_at,
    e.technician_name AS event_technician,
    t.action_taken
   FROM (rsa_tickets_cache t
     LEFT JOIN LATERAL ( SELECT ticket_events.event_type,
            ticket_events.created_at,
            ticket_events.technician_name
           FROM ticket_events
          WHERE (ticket_events.ticket_number = t.ticket_number)
          ORDER BY ticket_events.created_at DESC
         LIMIT 1) e ON (true));
