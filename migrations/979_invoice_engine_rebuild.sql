-- Migration 979: Invoice engine rebuild.
-- Adds the columns, side tables, and default theme the new render
-- engine + QR verification + audit trail depend on. All idempotent.
--
-- Depends on migration 500 (invoices table). If 500 hasn't been run
-- against this DB the ALTER TABLE calls below simply no-op the missing
-- columns — but the code path assumes 500's shape.

-- ── 1. Invoice hardening columns ────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS verification_token   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS source               TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS theme_id             UUID,
  ADD COLUMN IF NOT EXISTS payment_terms        TEXT,
  ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT,
  ADD COLUMN IF NOT EXISTS signature_image_url  TEXT,
  ADD COLUMN IF NOT EXISTS due_date             DATE,
  ADD COLUMN IF NOT EXISTS tax_rate             NUMERIC(6,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount           NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount      NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal             NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS fx_original_currency TEXT,
  ADD COLUMN IF NOT EXISTS fx_original_amount   NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS fx_rate              NUMERIC(20,10),
  ADD COLUMN IF NOT EXISTS fx_rate_date         DATE,
  ADD COLUMN IF NOT EXISTS voided_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by            UUID,
  ADD COLUMN IF NOT EXISTS void_reason          TEXT,
  ADD COLUMN IF NOT EXISTS revision_number      INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS download_count       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_downloaded_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_count   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_verified_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS historical_file_path TEXT;

-- Extend the status CHECK to include the new lifecycle values without
-- breaking existing rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='invoices'::regclass AND contype='c'
      AND conname LIKE 'invoice_status%'
  ) THEN
    EXECUTE 'ALTER TABLE invoices DROP CONSTRAINT ' ||
      (SELECT conname FROM pg_constraint
       WHERE conrelid='invoices'::regclass AND contype='c'
         AND conname LIKE 'invoice_status%' LIMIT 1);
  END IF;
END $$;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft','sent','paid','partially_paid','pending','overdue','cancelled','voided'));

-- Backfill: give every existing invoice a verification_token.
UPDATE invoices
SET verification_token = encode(gen_random_bytes(12), 'hex')
WHERE verification_token IS NULL;

-- Speed up the two most common queries: (a) the sidebar list by client,
-- (b) public verification lookups by token.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_verification_token
  ON invoices(verification_token);
CREATE        INDEX IF NOT EXISTS idx_invoices_source
  ON invoices(source);

-- ── 2. Audit trail ──────────────────────────────────────────────────────
-- Every meaningful action on an invoice gets a row here. Split from the
-- global audit_logs so financial forensics has a scoped stream that
-- doesn't grow unboundedly with system-wide noise.
CREATE TABLE IF NOT EXISTS invoice_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  actor_id    UUID,
  action      TEXT NOT NULL,   -- created|modified|downloaded|verified|voided|emailed|duplicated|regenerated|imported
  metadata    JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice
  ON invoice_events(invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_events_action
  ON invoice_events(action);

-- ── 3. Themes ───────────────────────────────────────────────────────────
-- Every visual choice the render engine makes is either derived from
-- company_settings (logo, name) or read from this table. Nothing in
-- the render code should hard-code a color, font, or margin.
CREATE TABLE IF NOT EXISTS invoice_themes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  is_default        BOOLEAN DEFAULT FALSE,

  -- Colors
  primary_color     TEXT DEFAULT '#0f3c2e',
  secondary_color   TEXT DEFAULT '#e6f2ee',
  accent_color      TEXT DEFAULT '#b8860b',
  background_color  TEXT DEFAULT '#ffffff',
  text_color        TEXT DEFAULT '#222222',
  muted_color       TEXT DEFAULT '#666666',
  border_color      TEXT DEFAULT '#dcdcdc',

  -- Typography
  font_family       TEXT DEFAULT 'Segoe UI, Tahoma, Arial, sans-serif',
  base_font_size    INTEGER DEFAULT 14,

  -- Layout
  paper_size        TEXT DEFAULT 'A4',    -- A4 | Letter
  orientation       TEXT DEFAULT 'portrait',
  margins           JSONB DEFAULT '{"top":40,"right":40,"bottom":40,"left":40}'::jsonb,
  rounded_corners   BOOLEAN DEFAULT TRUE,
  border_style      TEXT DEFAULT 'solid', -- solid | none

  -- Header / footer / logo
  header_layout     TEXT DEFAULT 'logo-left-meta-right',
  footer_layout     TEXT DEFAULT 'qr-left-payment-right',
  logo_size_px      INTEGER DEFAULT 80,
  logo_position     TEXT DEFAULT 'left',  -- left | center | right
  qr_position       TEXT DEFAULT 'footer-left',
  watermark_text    TEXT,
  watermark_opacity NUMERIC(3,2) DEFAULT 0.08,

  -- Section toggles
  show_seal                 BOOLEAN DEFAULT FALSE,
  show_signature            BOOLEAN DEFAULT TRUE,
  show_bank_details         BOOLEAN DEFAULT TRUE,
  show_tax_section          BOOLEAN DEFAULT TRUE,
  show_payment_instructions BOOLEAN DEFAULT TRUE,
  show_terms                BOOLEAN DEFAULT TRUE,
  show_notes                BOOLEAN DEFAULT TRUE,
  show_qr                   BOOLEAN DEFAULT TRUE,
  show_watermark            BOOLEAN DEFAULT FALSE,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_by        UUID
);

-- Seed the "Xhenvolt Classic" theme — matches invoicegen.html exactly.
-- Superadmin can duplicate + tweak from here without touching code.
INSERT INTO invoice_themes (name, is_default)
VALUES ('Xhenvolt Classic', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Ensure exactly one default; the app trusts is_default=TRUE.
UPDATE invoice_themes SET is_default = FALSE
 WHERE is_default = TRUE
   AND id NOT IN (SELECT id FROM invoice_themes ORDER BY created_at ASC LIMIT 1);
