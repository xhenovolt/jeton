-- Migration 973: Prospect search-by-phone + dormancy scaffolding + indexes.
-- Idempotent.
--
-- Two goals:
--   1. Let users find a prospect by ANY of their numbers, regardless of
--      whether they typed "0700...", "+256700...", or "256700...". We
--      store all three numbers in `phone_search` normalized to the same
--      shape so a single ILIKE hits them all.
--   2. Scaffold last_followup_at + a helper index so a dormancy dashboard
--      can compute "days since last follow-up" without a table scan.

-- ------------------------------------------------------------------
-- 1. Extra prospect columns.
-- ------------------------------------------------------------------
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS alternative_phone VARCHAR(30);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS whatsapp_number   VARCHAR(30);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS address           TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_followup_at  TIMESTAMPTZ;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS phone_search      TEXT;

-- ------------------------------------------------------------------
-- 2. Ugandan phone normalisation.
--    - Strips everything but digits.
--    - Rewrites the local "0XXXXXXXXX" prefix to the international
--      "256XXXXXXXXX" form, so a search for "0700..." matches a stored
--      "+256 700 ..." and vice-versa.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_ug_phone(input TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  digits TEXT;
BEGIN
  IF input IS NULL OR btrim(input) = '' THEN RETURN NULL; END IF;
  digits := regexp_replace(input, '[^0-9]', '', 'g');
  IF digits ~ '^0[0-9]{9}$' THEN
    digits := '256' || substring(digits FROM 2);
  END IF;
  RETURN digits;
END $$;

-- ------------------------------------------------------------------
-- 3. Trigger keeps `phone_search` = " ".join(normalized(phone, alt, wa)).
--    A single ILIKE '%256700%' now matches any row where any of the
--    three numbers, in any format, contains those digits.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prospects_update_phone_search() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.phone_search := COALESCE(normalize_ug_phone(NEW.phone), '')
    || ' ' || COALESCE(normalize_ug_phone(NEW.alternative_phone), '')
    || ' ' || COALESCE(normalize_ug_phone(NEW.whatsapp_number), '');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prospects_phone_search ON prospects;
CREATE TRIGGER trg_prospects_phone_search
  BEFORE INSERT OR UPDATE OF phone, alternative_phone, whatsapp_number
  ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION prospects_update_phone_search();

-- Backfill so existing rows get a phone_search value.
UPDATE prospects
SET phone = phone
WHERE phone IS NOT NULL AND (phone_search IS NULL OR phone_search = '  ');

-- ------------------------------------------------------------------
-- 4. Indexes for the global search + dormancy queries.
-- ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_prospects_phone_search        ON prospects (phone_search);
CREATE INDEX IF NOT EXISTS idx_prospects_company_name_lower  ON prospects (LOWER(company_name));
CREATE INDEX IF NOT EXISTS idx_prospects_contact_name_lower  ON prospects (LOWER(contact_name));
CREATE INDEX IF NOT EXISTS idx_prospects_next_followup_date  ON prospects (next_followup_date);
CREATE INDEX IF NOT EXISTS idx_prospects_last_followup_at    ON prospects (last_followup_at);
CREATE INDEX IF NOT EXISTS idx_prospects_stage               ON prospects (stage);

-- Complementary indexes on the tables /api/search reads from most.
-- All best-effort — non-existent columns are silently ignored via DO block.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients'  AND column_name='company_name')
    THEN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clients_company_name_lower ON clients (LOWER(company_name))'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals'    AND column_name='title')
    THEN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_deals_title_lower          ON deals (LOWER(title))'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='systems'  AND column_name='name')
    THEN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_systems_name_lower         ON systems (LOWER(name))'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='title')
    THEN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_documents_title_lower      ON documents (LOWER(title))'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff'    AND column_name='name')
    THEN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_staff_name_lower           ON staff (LOWER(name))'; END IF;
END $$;
