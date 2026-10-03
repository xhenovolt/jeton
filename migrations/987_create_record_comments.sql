-- 987_create_record_comments.sql
--
-- WHY THIS EXISTS
--
-- `record_comments` was never created in this database, which breaks two
-- things:
--
--   1. The whole of api/comments — GET, POST, resolve, edit and delete all
--      read or write it, so commenting on any record failed outright.
--   2. Listing decisions. api/decision-logs GET counts comments per decision
--      with a subquery over record_comments, so even after 986 created
--      decision_logs the list still failed with
--        relation "record_comments" does not exist
--      A decision could be created and then never shown.
--
-- Column list taken from api/comments/route.js: the INSERT
-- (entity_type, entity_id, parent_comment_id, author_id, content, mentions),
-- the SELECT's joins on author_id and resolved_by, its ORDER BY created_at,
-- its threading via parent_comment_id, and the resolve/edit handlers which
-- set is_resolved, resolved_by, resolved_at and is_edited.
--
-- SAFETY
--
-- Additive and idempotent. Creates one table and its indexes.

CREATE TABLE IF NOT EXISTS record_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic by design: comments attach to deals, decisions, invoices and
  -- so on. The API validates entity_type against its own allow-list, so this
  -- is intentionally not a foreign key — one column per commentable entity
  -- would be worse.
  entity_type       VARCHAR(60) NOT NULL,
  entity_id         UUID        NOT NULL,

  -- Threading. CASCADE so deleting a comment takes its replies with it rather
  -- than orphaning them under a missing parent.
  parent_comment_id UUID REFERENCES record_comments(id) ON DELETE CASCADE,

  -- SET NULL, not CASCADE: a comment is part of the record's history and must
  -- survive the author's account being removed.
  author_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  content           TEXT        NOT NULL,
  mentions          TEXT[]      NOT NULL DEFAULT '{}',

  is_edited         BOOLEAN     NOT NULL DEFAULT FALSE,
  is_resolved       BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The lookup every caller makes: all comments on one record, oldest first.
CREATE INDEX IF NOT EXISTS idx_record_comments_entity
  ON record_comments (entity_type, entity_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_record_comments_parent
  ON record_comments (parent_comment_id) WHERE parent_comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_record_comments_author ON record_comments (author_id);

CREATE INDEX IF NOT EXISTS idx_record_comments_unresolved
  ON record_comments (entity_type, entity_id) WHERE is_resolved = FALSE;

COMMENT ON TABLE record_comments IS
  'Threaded comments attached to any record by (entity_type, entity_id). Comments outlive their author: author_id is SET NULL, not cascaded.';
