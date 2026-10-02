-- 982_staff_lifecycle.sql
--
-- WHY THIS EXISTS
--
-- Employee termination was completely non-functional, for two independent
-- reasons, both confirmed by running the real statements against the database:
--
-- 1. POST /api/staff/actions with action_type='termination' runs:
--
--      UPDATE staff SET is_active = false, status = 'inactive',
--             deactivated_at = NOW(), deactivation_reason = $1 ...
--
--    None of is_active, deactivated_at or deactivation_reason exist on `staff`.
--    The statement raises
--      column "is_active" of relation "staff" does not exist
--    so the endpoint returned 500 on every call. /api/staff PATCH also lists
--    is_active among its updatable fields, so it had the same latent failure.
--
-- 2. The same endpoint then logs to `staff_actions`, which did not exist
--    either. So even with the columns added, termination would still have
--    failed on the audit insert.
--
-- The UI masked both: src/app/app/staff/page.js called the API without
-- checking the response and showed "Team member removed" unconditionally, so
-- a 500 looked like success and the employee stayed in the list.
--
-- SAFETY
--
-- Additive and idempotent. No existing column or row is altered except the
-- is_active backfill, which derives from the status already on each row.

-- ── 1. Termination / deactivation columns ───────────────────────────────────
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Backfill from the status each row already carries, so existing inactive or
-- terminated people are not reported as active.
UPDATE staff
   SET is_active = FALSE
 WHERE is_active IS TRUE
   AND LOWER(COALESCE(status, '')) IN ('inactive', 'terminated', 'suspended', 'archived');

COMMENT ON COLUMN staff.is_active IS
  'FALSE once the person is terminated or suspended. Authoritative flag for access checks, while status carries the human-facing label.';
COMMENT ON COLUMN staff.deactivated_by IS
  'User who performed the termination. Paired with deactivated_at and deactivation_reason.';

-- ── 2. Staff action history ─────────────────────────────────────────────────
-- Promotions, demotions, terminations and reactivations. Retained after the
-- staff row is gone, so employment history survives deletion — hence
-- ON DELETE SET NULL rather than CASCADE.
CREATE TABLE IF NOT EXISTS staff_actions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id                 UUID REFERENCES staff(id) ON DELETE SET NULL,
  action_type              VARCHAR(40) NOT NULL,
  previous_role_id         UUID,
  new_role_id              UUID,
  previous_role_name       VARCHAR(120),
  new_role_name            VARCHAR(120),
  previous_authority_level INTEGER,
  new_authority_level      INTEGER,
  reason                   TEXT,
  effective_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  performed_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_actions_staff   ON staff_actions(staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_actions_type    ON staff_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_staff_actions_created ON staff_actions(created_at DESC);

-- ── 3. Index supporting the hard-delete dependency pre-check ────────────────
CREATE INDEX IF NOT EXISTS idx_staff_manager ON staff(manager_id);
