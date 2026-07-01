-- Migration 977: Media message fields on messages.
-- Adds file_name so file/audio/video/image messages preserve the
-- original filename for download + display. Idempotent.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_mime TEXT;
