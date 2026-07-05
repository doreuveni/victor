-- ============================================================================
-- 0011_notifications_realtime.sql — Enable Realtime on notifications
-- Lets the client subscribe to INSERTs for its own recipient_id (bell badge
-- updates live). RLS still applies to Realtime: a client only ever receives
-- postgres_changes events for rows its policies would let it SELECT.
-- ============================================================================

alter publication supabase_realtime add table public.notifications;
