-- Expand ticket_events.event_type check constraint to include all PWA event types.
-- The original constraint only had: on_my_way, on_site, completed, note
-- The RSA Tech PWA (rsa-tech.html) sends: accepted, en_route, reached, work_started,
-- completed, transferred_to_ho — all of which were being silently rejected (check violation).
-- Applied live 2026-08-14 via Supabase MCP.

ALTER TABLE ticket_events
  DROP CONSTRAINT ticket_events_event_type_check,
  ADD CONSTRAINT ticket_events_event_type_check
    CHECK (event_type = ANY (ARRAY[
      'accepted',
      'en_route',
      'reached',
      'work_started',
      'completed',
      'transferred_to_ho',
      'on_my_way',
      'on_site',
      'note'
    ]));
