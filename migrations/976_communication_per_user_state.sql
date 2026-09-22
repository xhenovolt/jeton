-- Migration 976: Per-user chat lifecycle state.
-- Adds archived_at, hidden_at, last_read_at columns to
-- conversation_participants so WhatsApp-style hide/archive/read is
-- per-user, not per-conversation. Idempotent.
--
-- Why: today `conversations.is_archived` toggles for everyone in the
-- chat, which is wrong for a WhatsApp replacement. Each participant
-- should be able to archive/hide their own view.

ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS archived_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_read_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cp_user_archived
  ON conversation_participants(user_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_cp_user_hidden
  ON conversation_participants(user_id, hidden_at);
