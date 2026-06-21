-- Migration 974: stored DRAIS webhook registration.
-- DRAIS mints the signing secret when a webhook is registered (POST /webhooks)
-- and returns it once. We persist it (encrypted) so the receiver can verify
-- inbound signatures without anyone hand-editing env vars. Latest row wins.
-- Idempotent.

CREATE TABLE IF NOT EXISTS drais_webhook_config (
  id               BIGSERIAL PRIMARY KEY,
  subscription_id  VARCHAR(64),
  url              TEXT        NOT NULL,
  event_types      JSONB,
  secret_encrypted TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
