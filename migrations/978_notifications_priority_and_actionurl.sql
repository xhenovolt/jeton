-- Migration 978: Bring notifications table in line with what
-- src/lib/communication-notifications.js writes.
--
-- Live table was missing `priority` and `action_url` columns, so every
-- communication notification INSERT threw, was swallowed by the
-- try/catch, and no message alerts ever reached the bell. Also extend
-- the type CHECK to accept 'communication' and 'call' since the code
-- writes those.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS priority   TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS action_url TEXT;

-- Drop the restrictive CHECK if present, then re-add it with the values
-- the app actually uses.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'notifications'::regclass
      AND contype = 'c'
      AND conname LIKE 'notifications_type%'
  ) THEN
    EXECUTE 'ALTER TABLE notifications DROP CONSTRAINT ' ||
      (SELECT conname FROM pg_constraint
       WHERE conrelid = 'notifications'::regclass AND contype = 'c'
         AND conname LIKE 'notifications_type%' LIMIT 1);
  END IF;
END $$;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'info', 'warning', 'error', 'success',
    'issue', 'message', 'communication', 'call',
    'prospect_followup_overdue'
  ));
