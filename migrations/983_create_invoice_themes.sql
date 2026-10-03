-- 983_create_invoice_themes.sql
--
-- WHY THIS EXISTS
--
-- /app/settings/invoice-themes fails with
--   relation "invoice_themes" does not exist
--
-- The table was never created in this database. No theme table of any kind
-- exists, and invoices.theme_id carries no foreign key, so the whole theming
-- feature had no schema behind it. Three API routes
-- (api/invoices/themes, .../[id], .../[id]/preview) and
-- src/lib/invoice-render.js all read and write it.
--
-- src/lib/invoice-render.js hid this: loadActiveTheme() wraps its SELECT in a
-- bare catch and returns DEFAULT_THEME, so invoices still rendered with the
-- built-in look while the settings screen 500'd. That is why invoices appeared
-- fine and only the themes page was visibly broken.
--
-- The column list below is taken from the two places that define the contract:
--   * the INSERT column list in src/app/api/invoices/themes/route.js
--   * DEFAULT_THEME in src/lib/invoice-render.js
-- Defaults match DEFAULT_THEME so a row created with only a name renders
-- identically to the built-in theme.
--
-- SAFETY
--
-- Additive and idempotent. Creates one table, one partial unique index and one
-- foreign key on invoices.theme_id. No existing data is modified: the seeded
-- default theme is inserted only when the table is empty.

CREATE TABLE IF NOT EXISTS invoice_themes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      VARCHAR(120) NOT NULL,
  is_default                BOOLEAN NOT NULL DEFAULT FALSE,

  -- Palette
  primary_color             VARCHAR(32)  NOT NULL DEFAULT '#0f3c2e',
  secondary_color           VARCHAR(32)  NOT NULL DEFAULT '#e6f2ee',
  accent_color              VARCHAR(32)  NOT NULL DEFAULT '#b8860b',
  background_color          VARCHAR(32)  NOT NULL DEFAULT '#ffffff',
  text_color                VARCHAR(32)  NOT NULL DEFAULT '#222222',
  muted_color               VARCHAR(32)  NOT NULL DEFAULT '#666666',
  border_color              VARCHAR(32)  NOT NULL DEFAULT '#dcdcdc',

  -- Typography
  font_family               TEXT         NOT NULL DEFAULT 'Segoe UI, Tahoma, Arial, sans-serif',
  base_font_size            INTEGER      NOT NULL DEFAULT 14,

  -- Page
  paper_size                VARCHAR(16)  NOT NULL DEFAULT 'A4',
  orientation               VARCHAR(16)  NOT NULL DEFAULT 'portrait',
  margins                   JSONB        NOT NULL DEFAULT '{"top":40,"right":40,"bottom":40,"left":40}'::jsonb,
  rounded_corners           BOOLEAN      NOT NULL DEFAULT TRUE,
  border_style              VARCHAR(32),

  -- Layout
  header_layout             VARCHAR(48)  NOT NULL DEFAULT 'logo-left-meta-right',
  footer_layout             VARCHAR(48)  NOT NULL DEFAULT 'qr-left-payment-right',
  logo_size_px              INTEGER      NOT NULL DEFAULT 80,
  logo_position             VARCHAR(32),
  qr_position               VARCHAR(32)  NOT NULL DEFAULT 'footer-left',

  -- Watermark
  watermark_text            TEXT,
  watermark_opacity         NUMERIC(4,3) NOT NULL DEFAULT 0.080,

  -- Section toggles
  show_seal                 BOOLEAN NOT NULL DEFAULT FALSE,
  show_signature            BOOLEAN NOT NULL DEFAULT TRUE,
  show_bank_details         BOOLEAN NOT NULL DEFAULT TRUE,
  show_tax_section          BOOLEAN NOT NULL DEFAULT TRUE,
  show_payment_instructions BOOLEAN NOT NULL DEFAULT TRUE,
  show_terms                BOOLEAN NOT NULL DEFAULT TRUE,
  show_notes                BOOLEAN NOT NULL DEFAULT TRUE,
  show_qr                   BOOLEAN NOT NULL DEFAULT TRUE,
  show_watermark            BOOLEAN NOT NULL DEFAULT FALSE,

  updated_by                UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- loadActiveTheme() selects WHERE is_default = TRUE and the POST route unflags
-- the others after setting one. Enforce that at most one row can be default,
-- so a failed unflag cannot leave two and make invoice rendering arbitrary.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_themes_single_default
  ON invoice_themes (is_default) WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_invoice_themes_name ON invoice_themes (name);

-- invoices.theme_id already exists but referenced nothing, so an invoice could
-- point at a theme id that was never valid. SET NULL keeps historical invoices
-- readable (they fall back to the default theme) if a theme is later removed.
-- Kept as three plain statements rather than a DO block: it is just as
-- idempotent and survives simple migration runners that split on semicolons.
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_theme_id_fkey;

-- Clear only theme_ids that cannot be satisfied. Invoices pointing at a real
-- theme keep it; before this migration no theme could be real, so in practice
-- this clears the orphans and leaves everything else alone.
UPDATE invoices
   SET theme_id = NULL
 WHERE theme_id IS NOT NULL
   AND theme_id NOT IN (SELECT id FROM invoice_themes);

ALTER TABLE invoices
  ADD CONSTRAINT invoices_theme_id_fkey
  FOREIGN KEY (theme_id) REFERENCES invoice_themes(id) ON DELETE SET NULL;

-- Seed the built-in look as an editable default, only on a fresh table, so the
-- settings screen opens with something real rather than an empty list.
INSERT INTO invoice_themes (name, is_default)
SELECT 'Xhenvolt Default', TRUE
 WHERE NOT EXISTS (SELECT 1 FROM invoice_themes);
