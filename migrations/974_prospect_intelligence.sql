-- Migration 974: Prospect intelligence view + follow-up hygiene fields.
-- Idempotent. Depends on 973 (phone_search + last_followup_at).
--
-- Classification lives in a VIEW (not a stored column) so the state is
-- always fresh — no cron needed, no drift between "when the write
-- happened" and "when the report ran". Rules from the founder's prompt:
--
--   converted  → stage in ('won','converted') OR converted_at IS NOT NULL
--   dead       → stage in ('lost','dead') OR (no follow-up scheduled AND
--                last activity > 30 days ago)
--   dormant    → no follow-up scheduled AND last activity > 7 days ago
--   hot        → next_followup_date within the next 48 hours (or now-past)
--   warm       → next_followup_date scheduled and > 48 h out
--   active     → everything else (recently touched, no schedule yet)
--
-- "Last activity" = greatest(last_followup_at, updated_at, created_at).
-- Follow-up hygiene fields (added below) let a manager mark a prospect
-- dead manually without waiting for the 30-day timer.

-- ── 1. Optional manual overrides ────────────────────────────────────────
-- Lets a manager say "this prospect is dead, don't nag me" without
-- waiting for the automatic 30-day threshold to trip.
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS manually_marked_dead   BOOLEAN DEFAULT FALSE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS manually_marked_dead_at TIMESTAMPTZ;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS manually_marked_dead_reason TEXT;

-- ── 2. Intelligence view ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_prospect_intelligence AS
SELECT
  p.id,
  p.company_name,
  p.contact_name,
  p.email,
  p.phone,
  p.alternative_phone,
  p.whatsapp_number,
  p.address,
  p.stage,
  p.pipeline,
  p.industry,
  p.source,
  p.priority,
  p.estimated_value,
  p.currency,
  p.notes,
  p.assigned_to,
  p.created_by,
  p.system_id,
  p.service_id,
  p.next_followup_date,
  p.next_followup_time,
  p.last_followup_at,
  p.converted_at,
  p.lost_reason,
  p.manually_marked_dead,
  p.manually_marked_dead_reason,
  p.created_at,
  p.updated_at,

  -- Timestamp of the last real activity we know about. Preferred order:
  -- an explicit follow-up timestamp, then row updated_at, then created_at.
  GREATEST(
    COALESCE(p.last_followup_at, 'epoch'::timestamptz),
    COALESCE(p.updated_at,       'epoch'::timestamptz),
    COALESCE(p.created_at,       'epoch'::timestamptz)
  ) AS last_activity_at,

  -- Days since last activity — the number the dashboard actually shows.
  EXTRACT(EPOCH FROM (
    NOW() - GREATEST(
      COALESCE(p.last_followup_at, 'epoch'::timestamptz),
      COALESCE(p.updated_at,       'epoch'::timestamptz),
      COALESCE(p.created_at,       'epoch'::timestamptz)
    )
  )) / 86400.0 AS days_since_last_activity,

  -- Hours until the next scheduled follow-up. Negative = overdue.
  CASE
    WHEN p.next_followup_date IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (
      (p.next_followup_date + COALESCE(p.next_followup_time, '09:00'::time)) - NOW()
    )) / 3600.0
  END AS hours_until_followup,

  -- The classification. Follows the founder's rules; ORDER matters
  -- (converted wins over dead, dead wins over dormant, etc.).
  CASE
    WHEN p.stage IN ('won','converted') OR p.converted_at IS NOT NULL THEN 'converted'
    WHEN p.stage IN ('lost','dead') OR p.manually_marked_dead = TRUE  THEN 'dead'
    WHEN p.next_followup_date IS NULL
      AND (NOW() - GREATEST(
        COALESCE(p.last_followup_at, 'epoch'::timestamptz),
        COALESCE(p.updated_at,       'epoch'::timestamptz),
        COALESCE(p.created_at,       'epoch'::timestamptz)
      )) > INTERVAL '30 days'                                          THEN 'dead'
    WHEN p.next_followup_date IS NULL
      AND (NOW() - GREATEST(
        COALESCE(p.last_followup_at, 'epoch'::timestamptz),
        COALESCE(p.updated_at,       'epoch'::timestamptz),
        COALESCE(p.created_at,       'epoch'::timestamptz)
      )) > INTERVAL '7 days'                                           THEN 'dormant'
    WHEN p.next_followup_date IS NOT NULL AND
      ((p.next_followup_date + COALESCE(p.next_followup_time, '09:00'::time)) - NOW())
        <= INTERVAL '48 hours'                                         THEN 'hot'
    WHEN p.next_followup_date IS NOT NULL                              THEN 'warm'
    ELSE                                                                    'active'
  END AS followup_status,

  -- Quick hygiene flags for the dashboard's "risk" cards.
  (p.phone IS NULL OR btrim(p.phone) = '')                             AS missing_phone,
  (p.next_followup_date IS NULL)                                       AS missing_next_action
FROM prospects p;

-- Dedup for the alert generator is done at the application layer — the
-- would-be unique index on (recipient_user_id, type, reference_id, day)
-- requires an IMMUTABLE date extraction, which Postgres refuses for
-- created_at::date (session-timezone-dependent). The alerts endpoint
-- SELECTs before INSERTing to keep the notification inbox clean.
