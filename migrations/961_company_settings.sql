-- ================================================================
-- MIGRATION 961: COMPANY SETTINGS
-- Global key-value store for company branding & contact info.
-- Used in invoices, proposals, and all document PDFs.
-- ================================================================

CREATE TABLE IF NOT EXISTS company_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed defaults (DO NOTHING — never overwrite user-set values)
INSERT INTO company_settings (key, value) VALUES
  ('company_name',         'Xhenvolt Technologies'),
  ('company_tagline',      'Intelligent Software Solutions for Africa'),
  ('company_address',      'Bulubandi, Iganga, Uganda'),
  ('company_phone_1',      '0741 341 483'),
  ('company_phone_2',      '0760 700 954'),
  ('company_phone_3',      '0745 726 350'),
  ('company_email',        ''),
  ('company_website',      ''),
  ('company_logo',         ''),
  ('company_tin',          ''),
  ('company_registration', '')
ON CONFLICT (key) DO NOTHING;
