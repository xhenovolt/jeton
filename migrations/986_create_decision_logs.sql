-- 986_create_decision_logs.sql
--
-- WHY THIS EXISTS
--
-- Creating a decision in /app/decision-log always failed. The cause is simply
-- that `decision_logs` was never created in this database: every handler in
-- api/decision-logs (GET, POST) and api/decision-logs/[id] (GET, PUT, DELETE)
-- reads or writes it, so each one raised
--   relation "decision_logs" does not exist
-- and the route's catch turned that into a flat 500.
--
-- The column list is taken from the three places that define the contract:
--   * the INSERT column list in api/decision-logs/route.js
--   * the SELECT in that file, which also requires is_archived and joins
--     users.name and departments.name
--   * allowedFields in api/decision-logs/[id]/route.js, which adds
--     review_notes and is_archived
--
-- RELATED
--
-- The routes enforce `activity_logs.view`, which has no row in `permissions`
-- either, so they 403 for every non-superadmin regardless of this table.
-- migration 981_seed_missing_permissions.sql seeds activity_logs.view and
-- decision_logs.view; both migrations are needed for the feature to work for
-- anyone other than the founder.
--
-- The GET also counts rows in `record_comments` for entity_type
-- 'decision_log'. That table is assumed to exist already; this migration does
-- not create it.
--
-- SAFETY
--
-- Additive and idempotent. Creates one table and its indexes.

CREATE TABLE IF NOT EXISTS decision_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title               VARCHAR(300) NOT NULL,
  description         TEXT,

  -- Free text rather than enums: the UI offers fixed lists, but constraining
  -- them here would make adding a category a migration.
  category            VARCHAR(60)  NOT NULL DEFAULT 'general',
  priority            VARCHAR(30)  NOT NULL DEFAULT 'medium',
  status              VARCHAR(30)  NOT NULL DEFAULT 'decided',

  decision_date       DATE         NOT NULL DEFAULT CURRENT_DATE,

  -- The reasoning. This is the point of a decision log, so it is kept
  -- alongside the decision rather than in a comment thread.
  context             TEXT,
  alternatives        TEXT,
  consequences        TEXT,
  review_notes        TEXT,

  stakeholders        TEXT[]       NOT NULL DEFAULT '{}',
  tags                TEXT[]       NOT NULL DEFAULT '{}',

  -- Optional link to whatever the decision was about (a deal, a system, ...).
  -- Deliberately untyped: a foreign key here would need one column per
  -- entity type.
  related_entity_type VARCHAR(60),
  related_entity_id   UUID,

  department_id       UUID REFERENCES departments(id) ON DELETE SET NULL,

  -- Who decided. SET NULL so a decision survives the person leaving; the
  -- audit trail is the record, not the staff row.
  decided_by          UUID REFERENCES users(id) ON DELETE SET NULL,

  -- The list filters on this, so archiving hides a decision without deleting
  -- the history.
  is_archived         BOOLEAN      NOT NULL DEFAULT FALSE,

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Matches the list's ORDER BY and its is_archived filter.
CREATE INDEX IF NOT EXISTS idx_decision_logs_listing
  ON decision_logs (is_archived, decision_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_decision_logs_category   ON decision_logs (category);
CREATE INDEX IF NOT EXISTS idx_decision_logs_status     ON decision_logs (status);
CREATE INDEX IF NOT EXISTS idx_decision_logs_department ON decision_logs (department_id);
CREATE INDEX IF NOT EXISTS idx_decision_logs_decided_by ON decision_logs (decided_by);
CREATE INDEX IF NOT EXISTS idx_decision_logs_related    ON decision_logs (related_entity_type, related_entity_id);

COMMENT ON TABLE decision_logs IS
  'Company decisions with their reasoning. Archived rather than deleted, so the record of why something was decided survives.';
