-- Migration 973: inbound DRAIS platform webhook events.
-- Jeton receives DRAIS events (subscription.expired, payment.received,
-- school.suspended, ...) at /api/drais/webhook. This table is the idempotency
-- ledger + audit trail: one row per delivery, keyed by the DRAIS delivery id.
-- Idempotent.

CREATE TABLE IF NOT EXISTS drais_webhook_events (
  id              BIGSERIAL PRIMARY KEY,
  delivery_id     VARCHAR(64) UNIQUE,        -- X-DRAIS-Delivery-Id (dedup key)
  event_type      VARCHAR(64) NOT NULL,      -- X-DRAIS-Event
  external_id     VARCHAR(64),               -- school external_id from payload, if any
  payload         JSONB,
  signature_valid BOOLEAN     NOT NULL DEFAULT FALSE,
  processed       BOOLEAN     NOT NULL DEFAULT FALSE,
  process_result  TEXT,                      -- 'suspended' | 'noop' | error message
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_drais_webhook_events_type     ON drais_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_drais_webhook_events_received ON drais_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_drais_webhook_events_external ON drais_webhook_events(external_id);
