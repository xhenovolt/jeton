-- 984_marzpay_accounts.sql
--
-- MarzPay as a first-class, multi-account finance integration.
--
-- WHY THIS SHAPE
--
-- The reference implementation (../drais-main/src/lib/payments/marzpay.ts)
-- reads MARZPAY_API_KEY / MARZPAY_API_SECRET from the environment. That ties
-- one deployment to exactly one MarzPay account: adding a second account means
-- editing .env and redeploying. Jeton needs several accounts, so the database
-- is the canonical store and the environment is only a bootstrap fallback used
-- to seed the first row.
--
-- CREDENTIAL HANDLING
--
-- api_secret and webhook_secret are stored as AES-256-GCM ciphertext produced
-- by src/lib/encryption.js (ENCRYPTION_KEY, 32 bytes). They are never written
-- in plaintext, never returned by an API response and never logged. api_key is
-- encrypted too, with a separate masked copy kept purely for display so the UI
-- can identify an account without ever decrypting anything.
--
-- VERIFIED CAPABILITIES
--
-- Probed against the live API with the first account's credentials:
--   GET  /collect-money/services   200  providers for collections
--   POST /collect-money                 start a collection
--   GET  /collect-money/{uuid}          authoritative collection status
--   GET  /transactions             200  ledger + account.current_balance
--   GET  /send-money/services      200  disbursement providers
--   GET  /balance                  403  IP_WHITELIST_REQUIRED
--   GET  /account                  403  IP_WHITELIST_REQUIRED
--
-- Balance is read from /transactions, which returns account.current_balance
-- and is NOT IP-restricted. Do NOT turn on MarzPay's IP whitelist to unlock
-- /balance: this deployment runs on Vercel, whose functions egress from a
-- rotating IP pool, so a whitelist would start 403-ing live collections as
-- soon as Vercel moved the function. /transactions gives the same figure.
--
-- SAFETY
--
-- Additive and idempotent. Creates two tables and their indexes; touches
-- nothing existing.

CREATE TABLE IF NOT EXISTS marzpay_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Operator-facing identity
  name                  VARCHAR(120) NOT NULL,
  description           TEXT,

  -- MarzPay's own account uuid, learned from a services/transactions call.
  -- Not supplied by the operator; filled in on first successful verification.
  provider_account_uuid UUID,

  environment           VARCHAR(16)  NOT NULL DEFAULT 'live',
  base_url              TEXT         NOT NULL DEFAULT 'https://wallet.wearemarz.com/api/v1',

  -- Credentials: ciphertext only. No plaintext column exists by design.
  api_key_encrypted     TEXT         NOT NULL,
  api_secret_encrypted  TEXT         NOT NULL,
  webhook_secret_encrypted TEXT,
  -- Display-only, e.g. "marz****mRL". Safe to return to a browser.
  api_key_masked        VARCHAR(64)  NOT NULL,

  -- Lifecycle
  is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
  is_default            BOOLEAN      NOT NULL DEFAULT FALSE,

  -- Verification state, set by the credential check that moves no money
  verification_status   VARCHAR(24)  NOT NULL DEFAULT 'unverified',
  last_verified_at      TIMESTAMPTZ,
  last_error            TEXT,
  last_synced_at        TIMESTAMPTZ,
  -- Cached from the last successful /transactions call, for display only.
  -- The provider stays authoritative; this is never used in accounting.
  last_known_balance    NUMERIC(18,2),
  last_known_currency   VARCHAR(8),

  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT marzpay_env_check CHECK (environment IN ('live', 'sandbox')),
  CONSTRAINT marzpay_verification_check
    CHECK (verification_status IN ('unverified', 'verified', 'rejected', 'error'))
);

-- One default account at most, so "which account does an unqualified request
-- use" can never be ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS uq_marzpay_single_default
  ON marzpay_accounts (is_default) WHERE is_default = TRUE;

-- The same credentials must not be registered twice under different names.
CREATE UNIQUE INDEX IF NOT EXISTS uq_marzpay_key_per_env
  ON marzpay_accounts (api_key_masked, environment);

CREATE INDEX IF NOT EXISTS idx_marzpay_active ON marzpay_accounts (is_active);


-- ── Money-movement log ──────────────────────────────────────────────────────
--
-- Every collection Jeton initiates, recorded before the provider is called.
-- `reference` is UNIQUE, which is what makes retries idempotent: a repeated
-- submission collides instead of sending the customer a second prompt.
CREATE TABLE IF NOT EXISTS marzpay_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES marzpay_accounts(id) ON DELETE RESTRICT,

  -- Our idempotency key, sent to MarzPay as `reference`.
  reference           VARCHAR(80) NOT NULL,
  -- MarzPay's identifiers, known only after it answers.
  provider_uuid       UUID,
  provider_reference  VARCHAR(120),

  direction           VARCHAR(16) NOT NULL,
  amount              NUMERIC(18,2) NOT NULL,
  currency            VARCHAR(8) NOT NULL DEFAULT 'UGX',
  phone_number        VARCHAR(32),
  provider            VARCHAR(40),
  description         TEXT,

  status              VARCHAR(32) NOT NULL DEFAULT 'pending',
  last_status_payload JSONB,

  -- Set once the money is mirrored into the internal ledger, so the same
  -- MarzPay transaction can never be posted to the books twice.
  ledger_entry_id     UUID REFERENCES ledger(id) ON DELETE SET NULL,
  reconciled_at       TIMESTAMPTZ,

  initiated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT marzpay_tx_direction_check CHECK (direction IN ('collection', 'disbursement')),
  CONSTRAINT marzpay_tx_amount_check CHECK (amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marzpay_tx_reference ON marzpay_transactions (reference);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marzpay_tx_provider_uuid
  ON marzpay_transactions (provider_uuid) WHERE provider_uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marzpay_tx_account ON marzpay_transactions (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marzpay_tx_status  ON marzpay_transactions (status);
CREATE INDEX IF NOT EXISTS idx_marzpay_tx_unreconciled
  ON marzpay_transactions (reconciled_at) WHERE reconciled_at IS NULL;

COMMENT ON COLUMN marzpay_accounts.api_secret_encrypted IS
  'AES-256-GCM ciphertext from src/lib/encryption.js. Never return or log this.';
COMMENT ON COLUMN marzpay_transactions.reference IS
  'Idempotency key sent to MarzPay as `reference`. UNIQUE, so a resubmission collides rather than charging twice.';
