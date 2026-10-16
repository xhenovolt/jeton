-- 989_documentation_contract_core.sql
--
-- WHY THIS EXISTS
--
-- The contract-generation system stored no record of what a document actually
-- said. `generated_documents.html_content` was never written (verified: both
-- live rows are NULL, and `grep -rn html_content src` found no reader or
-- writer), so content was re-derived from the live template on every read.
-- Because PUT /api/documents/templates/[id] overwrites `document_templates.body`
-- in place with no version row, editing a template silently rewrote the content
-- of every contract already issued from it.
--
-- This migration establishes the missing spine:
--
--   1. Template lifecycle + legal metadata on `document_templates`.
--   2. `document_template_versions` — immutable published snapshots.
--   3. `document_clauses` / `document_clause_versions` — the clause library,
--      so contract text is composed from reviewed, versioned building blocks
--      instead of being hardcoded per document type.
--   4. `document_template_profiles` + `document_profile_clauses` — the
--      "standard / enhanced / strict / custom" restrictiveness requirement,
--      expressed as a named, ordered clause set rather than a dropdown that
--      only changes a title.
--   5. Immutability + lifecycle + subject columns on `generated_documents`,
--      including `content_html` (the snapshot) and `subject_staff_id` (the
--      employee the document concerns — previously only free text, the same
--      defect class as invoices showing "Unknown Client").
--   6. `generated_document_clauses` — which exact clause versions went into
--      each issued document, queryable ("which live contracts contain
--      clause X v2?") as well as frozen in the manifest.
--   7. `document_signatures` — signature STATE only. No electronic-signature
--      capability is implied or created; see the CHECK constraint comment.
--   8. Approval steps for issued documents. `document_approvals` already
--      existed but its FK pointed at `documents` (the knowledge base), so
--      issued contracts had no approval path. Rather than drop that foreign
--      key, a second nullable FK is added alongside it with a CHECK that
--      exactly one subject is set.
--   9. `document_retention_policies` + `retention_until`.
--
-- SAFETY
--
-- Additive and idempotent. No column is dropped, no foreign key is removed and
-- no row is deleted. Existing templates are backfilled to the 'published'
-- state so that nothing which worked before stops working: they were usable
-- for generation under `is_active`, and they stay usable.
--
-- `is_active` is deliberately KEPT and kept in sync by trigger, because
-- `documents.template_id` and several queries still read it. `status` is the
-- new source of truth.

BEGIN;

-- ─────────────────────────── 1. template lifecycle ──────────────────────────

ALTER TABLE document_templates
  -- Lifecycle. 'published' is the only state generation accepts when the
  -- company policy flag `require_approved_templates` is on.
  ADD COLUMN IF NOT EXISTS status              TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS version             INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS document_type       TEXT,
  ADD COLUMN IF NOT EXISTS owner_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS intended_audience   TEXT,
  ADD COLUMN IF NOT EXISTS engagement_context  TEXT,
  ADD COLUMN IF NOT EXISTS department_id       UUID REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applicable_roles    TEXT[] NOT NULL DEFAULT '{}',

  -- Legal metadata. Deliberately descriptive, never asserting enforceability:
  -- Jeton records who reviewed a template and under which law it is intended
  -- to operate. It does not decide whether the result is binding.
  ADD COLUMN IF NOT EXISTS governing_law       TEXT,
  ADD COLUMN IF NOT EXISTS jurisdiction        TEXT,
  ADD COLUMN IF NOT EXISTS legal_reviewer      TEXT,
  ADD COLUMN IF NOT EXISTS legal_reviewed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_review_notes  TEXT,
  ADD COLUMN IF NOT EXISTS confidentiality     TEXT NOT NULL DEFAULT 'internal',

  ADD COLUMN IF NOT EXISTS effective_date      DATE,
  ADD COLUMN IF NOT EXISTS next_review_date    DATE,
  ADD COLUMN IF NOT EXISTS approved_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_version_id UUID,
  ADD COLUMN IF NOT EXISTS archived_at         TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE document_templates ADD CONSTRAINT document_templates_status_chk
    CHECK (status IN ('draft','review','approved','published','deprecated','archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE document_templates ADD CONSTRAINT document_templates_confidentiality_chk
    CHECK (confidentiality IN ('public','internal','confidential','restricted'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: templates that were usable before must stay usable.
UPDATE document_templates
   SET status = CASE WHEN is_active THEN 'published' ELSE 'archived' END
 WHERE status = 'draft';

UPDATE document_templates SET owner_id = created_by WHERE owner_id IS NULL;
UPDATE document_templates SET document_type = category WHERE document_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_templates_status ON document_templates(status);
CREATE INDEX IF NOT EXISTS idx_document_templates_doc_type ON document_templates(document_type);

-- ──────────────────────── 2. immutable template versions ────────────────────
--
-- One row per publish. `body` here is never updated — editing a template
-- creates a new version. Generated documents point at the version they used,
-- so the terms that were issued remain recoverable for ever.

CREATE TABLE IF NOT EXISTS document_template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,

  name            TEXT NOT NULL,
  body            TEXT NOT NULL,
  body_format     TEXT NOT NULL DEFAULT 'html',
  variables       JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- A copy of the legal metadata as it stood at publish time. Without this a
  -- reader could not tell which governing law an old contract was issued under.
  governing_law   TEXT,
  jurisdiction    TEXT,
  legal_reviewer  TEXT,
  legal_reviewed_at TIMESTAMPTZ,
  confidentiality TEXT,

  changelog       TEXT,
  published_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_doc_template_versions_template
  ON document_template_versions(template_id, version DESC);

DO $$ BEGIN
  ALTER TABLE document_templates
    ADD CONSTRAINT document_templates_published_version_fk
    FOREIGN KEY (published_version_id)
    REFERENCES document_template_versions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────────────────────── 3. clause library ────────────────────────────

CREATE TABLE IF NOT EXISTS document_clauses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,          -- stable key, e.g. 'nda.source_code'
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  description     TEXT,

  -- Current working text. The immutable history lives in
  -- document_clause_versions; this is what the editor edits.
  body            TEXT NOT NULL,
  body_format     TEXT NOT NULL DEFAULT 'html',
  version         INTEGER NOT NULL DEFAULT 1,

  -- Which document types this clause may appear in. Empty means "any".
  applicable_document_types TEXT[] NOT NULL DEFAULT '{}',

  -- Clauses that must never be combined with this one. Held as an array
  -- rather than a join table: the rule is small, symmetric and read as a
  -- whole every time, so a separate table would add joins without adding
  -- expressiveness. Symmetry is enforced in application code and asserted
  -- by the clause-engine tests.
  incompatible_with UUID[] NOT NULL DEFAULT '{}',

  is_required_default BOOLEAN NOT NULL DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'draft',

  governing_law   TEXT,
  jurisdiction    TEXT,
  legal_reviewer  TEXT,
  legal_reviewed_at TIMESTAMPTZ,
  legal_source    TEXT,

  effective_date  DATE,
  next_review_date DATE,

  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT document_clauses_status_chk
    CHECK (status IN ('draft','review','approved','published','deprecated','archived'))
);

CREATE INDEX IF NOT EXISTS idx_document_clauses_category ON document_clauses(category);
CREATE INDEX IF NOT EXISTS idx_document_clauses_status ON document_clauses(status);

CREATE TABLE IF NOT EXISTS document_clause_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clause_id       UUID NOT NULL REFERENCES document_clauses(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,

  name            TEXT NOT NULL,
  body            TEXT NOT NULL,
  body_format     TEXT NOT NULL DEFAULT 'html',

  governing_law   TEXT,
  jurisdiction    TEXT,
  legal_reviewer  TEXT,
  legal_reviewed_at TIMESTAMPTZ,

  changelog       TEXT,
  published_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (clause_id, version)
);

CREATE INDEX IF NOT EXISTS idx_doc_clause_versions_clause
  ON document_clause_versions(clause_id, version DESC);

-- ──────────────────────── 4. restrictiveness profiles ───────────────────────
--
-- The "standard / enhanced / strict / custom" requirement. A profile is a
-- NAMED, ORDERED CLAUSE SET, not a label. `tier` is an internal grading used
-- for ordering and defaults; it deliberately carries no legal meaning, since
-- the actual effect of a document comes from its clauses, governing law and
-- context.

CREATE TABLE IF NOT EXISTS document_template_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,                 -- 'standard' | 'enhanced' | 'strict' | custom slug
  name            TEXT NOT NULL,
  description     TEXT,
  tier            INTEGER NOT NULL DEFAULT 1,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,

  -- Exceptional terms should not be issuable by whoever happens to hold
  -- documents.generate. When true, generation additionally demands the
  -- documents.issue_exceptional permission.
  requires_explicit_authorization BOOLEAN NOT NULL DEFAULT FALSE,

  applicable_roles TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'draft',

  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (template_id, code),
  CONSTRAINT document_template_profiles_status_chk
    CHECK (status IN ('draft','review','approved','published','deprecated','archived'))
);

CREATE INDEX IF NOT EXISTS idx_doc_profiles_template ON document_template_profiles(template_id);

CREATE TABLE IF NOT EXISTS document_profile_clauses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES document_template_profiles(id) ON DELETE CASCADE,
  clause_id       UUID NOT NULL REFERENCES document_clauses(id) ON DELETE RESTRICT,

  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- 'required' clauses cannot be removed at generation time; 'optional' ones
  -- may be included or left out; 'available' ones are off by default but may
  -- be added.
  inclusion       TEXT NOT NULL DEFAULT 'required',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (profile_id, clause_id),
  CONSTRAINT document_profile_clauses_inclusion_chk
    CHECK (inclusion IN ('required','optional','available'))
);

CREATE INDEX IF NOT EXISTS idx_doc_profile_clauses_profile
  ON document_profile_clauses(profile_id, sort_order);

-- ─────────────── 5. immutability, lifecycle and subject linkage ─────────────

ALTER TABLE generated_documents
  -- Which exact template version produced this document. Without it there is
  -- no way to know what the terms were.
  ADD COLUMN IF NOT EXISTS template_version_id UUID REFERENCES document_template_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS profile_id          UUID REFERENCES document_template_profiles(id) ON DELETE SET NULL,

  -- The frozen, rendered body (clauses already composed and placeholders
  -- already substituted). `html_content` is the pre-existing column and is now
  -- actually written; `content_hash` detects tampering.
  ADD COLUMN IF NOT EXISTS content_hash        TEXT,
  ADD COLUMN IF NOT EXISTS clause_manifest     JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resolved_data       JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- The subject: who or what the document is ABOUT, as opposed to the free-text
  -- recipient name it used to carry alone. No new employee table — this points
  -- at the existing `staff`.
  ADD COLUMN IF NOT EXISTS subject_staff_id    UUID REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_type        TEXT,
  ADD COLUMN IF NOT EXISTS subject_id          UUID,

  -- Lifecycle, distinct from the old `status` free-text column which is kept
  -- for backward compatibility.
  ADD COLUMN IF NOT EXISTS lifecycle_status    TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS signature_status    TEXT NOT NULL DEFAULT 'not_required',

  ADD COLUMN IF NOT EXISTS submitted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_bypassed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_bypass_reason TEXT,
  ADD COLUMN IF NOT EXISTS issued_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS issued_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS executed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,

  -- Amendment chain. A correction to an executed document creates a new
  -- document that points back, rather than overwriting history.
  ADD COLUMN IF NOT EXISTS amends_document_id  UUID REFERENCES generated_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS renews_document_id  UUID REFERENCES generated_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revision            INTEGER NOT NULL DEFAULT 1,

  ADD COLUMN IF NOT EXISTS retention_policy_id UUID,
  ADD COLUMN IF NOT EXISTS retention_until     DATE,
  ADD COLUMN IF NOT EXISTS archived_at         TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE generated_documents ADD CONSTRAINT generated_documents_lifecycle_chk
    CHECK (lifecycle_status IN (
      'draft',            -- being configured
      'pending_approval', -- submitted, awaiting a decision
      'rejected',         -- a decision was made against it, with a reason
      'approved',         -- cleared for issue
      'issued',           -- delivered to the recipient
      'executed',         -- a signed copy has been received and recorded
      'expired',
      'cancelled',
      'superseded',       -- replaced by an amendment
      'archived'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Signature STATE only.
--
-- Jeton has no validated electronic-signature integration, so it must not
-- imply one. These values describe what the company knows about a piece of
-- paper, and nothing more:
--   not_required     — this document type is not signed
--   prepared         — rendered but not yet sent
--   pending          — sent to the recipient, no signed copy received
--   partially_signed — some participants' signed copies received
--   signed_uploaded  — a signed copy has been uploaded by a human
--   executed         — all required participants' signed copies are on file
--   declined
-- Nothing here asserts that a signature is legally valid.
DO $$ BEGIN
  ALTER TABLE generated_documents ADD CONSTRAINT generated_documents_signature_chk
    CHECK (signature_status IN (
      'not_required','prepared','pending','partially_signed',
      'signed_uploaded','executed','declined'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Existing rows were generated under the old "active" model and have been
-- delivered, so 'issued' is the honest state for them.
UPDATE generated_documents
   SET lifecycle_status = CASE
         WHEN is_revoked THEN 'cancelled'
         WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
         ELSE 'issued' END
 WHERE lifecycle_status = 'draft';

UPDATE generated_documents SET issued_at = COALESCE(issued_at, generated_at)
 WHERE lifecycle_status IN ('issued','executed');

CREATE INDEX IF NOT EXISTS idx_generated_docs_lifecycle ON generated_documents(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_generated_docs_signature ON generated_documents(signature_status);
CREATE INDEX IF NOT EXISTS idx_generated_docs_subject_staff ON generated_documents(subject_staff_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_subject ON generated_documents(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_template_version ON generated_documents(template_version_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_retention ON generated_documents(retention_until);

-- ─────────────── 6. which clause versions went into each document ───────────

CREATE TABLE IF NOT EXISTS generated_document_clauses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
  clause_id             UUID NOT NULL REFERENCES document_clauses(id) ON DELETE RESTRICT,
  clause_version_id     UUID NOT NULL REFERENCES document_clause_versions(id) ON DELETE RESTRICT,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  inclusion             TEXT NOT NULL DEFAULT 'required',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (generated_document_id, clause_id)
);

CREATE INDEX IF NOT EXISTS idx_gen_doc_clauses_doc
  ON generated_document_clauses(generated_document_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_gen_doc_clauses_clause_version
  ON generated_document_clauses(clause_version_id);

-- ───────────────────────── 7. participants / signatures ─────────────────────

CREATE TABLE IF NOT EXISTS document_signatures (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,

  party_role            TEXT NOT NULL,           -- 'recipient' | 'company' | 'witness' | ...
  party_name            TEXT NOT NULL,
  party_email           TEXT,
  staff_id              UUID REFERENCES staff(id) ON DELETE SET NULL,
  user_id               UUID REFERENCES users(id) ON DELETE SET NULL,

  status                TEXT NOT NULL DEFAULT 'pending',
  is_required           BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INTEGER NOT NULL DEFAULT 0,

  -- A human uploads the signed copy; Jeton records who and when. It does not
  -- generate or validate a signature.
  signed_copy_url       TEXT,
  signed_copy_name      TEXT,
  signed_at            TIMESTAMPTZ,
  recorded_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at           TIMESTAMPTZ,
  declined_reason       TEXT,

  -- Reserved for a future provider integration. Null until one exists.
  provider              TEXT,
  provider_reference    TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT document_signatures_status_chk
    CHECK (status IN ('pending','sent','signed','declined','not_required'))
);

CREATE INDEX IF NOT EXISTS idx_document_signatures_doc
  ON document_signatures(generated_document_id, sort_order);

-- ──────────────────── 8. approvals for issued documents ─────────────────────
--
-- `document_approvals.document_id` already references `documents` (the
-- knowledge base). That foreign key is NOT removed. A second nullable column
-- is added for generated documents, with a CHECK that exactly one is set, so
-- both subjects keep real referential integrity.

ALTER TABLE document_approvals
  ADD COLUMN IF NOT EXISTS generated_document_id UUID
    REFERENCES generated_documents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS required_permission TEXT;

ALTER TABLE document_approvals ALTER COLUMN document_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE document_approvals ADD CONSTRAINT document_approvals_one_subject_chk
    CHECK ((document_id IS NOT NULL) <> (generated_document_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_document_approvals_generated
  ON document_approvals(generated_document_id, step_order);

-- ───────────────────────────── 9. retention ─────────────────────────────────
--
-- Deletion of legal and financial records must be a deliberate, policy-driven
-- act. These rows describe how long a document type is kept and what happens
-- at the end; nothing in this migration deletes anything.

CREATE TABLE IF NOT EXISTS document_retention_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  document_types  TEXT[] NOT NULL DEFAULT '{}',

  retain_years    INTEGER,
  retain_from     TEXT NOT NULL DEFAULT 'issued_at',

  -- Never 'delete' by default. An expired retention window marks a document
  -- for review by a human.
  action_at_end   TEXT NOT NULL DEFAULT 'review',

  legal_basis     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT document_retention_action_chk
    CHECK (action_at_end IN ('review','archive','anonymize')),
  CONSTRAINT document_retention_from_chk
    CHECK (retain_from IN ('issued_at','executed_at','expires_at','created_at'))
);

DO $$ BEGIN
  ALTER TABLE generated_documents
    ADD CONSTRAINT generated_documents_retention_fk
    FOREIGN KEY (retention_policy_id)
    REFERENCES document_retention_policies(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────────── 10. company policy for the documentation module ──────────

CREATE TABLE IF NOT EXISTS document_policy_settings (
  id                          INTEGER PRIMARY KEY DEFAULT 1,

  -- When on, only templates in the 'published' state may be used to generate
  -- a document. Off by default so that existing behaviour is preserved; the
  -- settings screen explains the trade-off.
  require_approved_templates  BOOLEAN NOT NULL DEFAULT FALSE,

  -- When on, a generated document must be approved before it can be issued.
  require_document_approval   BOOLEAN NOT NULL DEFAULT FALSE,

  -- When on, a superadmin may still issue without approval, but the bypass is
  -- recorded on the document and in the audit log.
  allow_superadmin_bypass     BOOLEAN NOT NULL DEFAULT TRUE,

  -- The public verification page. 'token_required' is the safe default: a bare
  -- document ID proves nothing and reveals nothing.
  public_verification_mode    TEXT NOT NULL DEFAULT 'token_required',

  -- Whether the public page may show the document body at all, as opposed to
  -- only confirming that the ID is genuine.
  public_show_document_body   BOOLEAN NOT NULL DEFAULT FALSE,

  default_expiry_days         INTEGER,
  updated_by                  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT document_policy_settings_singleton CHECK (id = 1),
  CONSTRAINT document_policy_verification_chk
    CHECK (public_verification_mode IN ('disabled','token_required','id_sufficient'))
);

INSERT INTO document_policy_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ───────────────── 11. a sequence for document numbering ────────────────────
--
-- `generateUniqueDocumentId` used SELECT COUNT(*) + 1, which collides under
-- concurrency and walks backwards into already-issued IDs after a deletion.
-- A table of counters, incremented inside the generating transaction, is
-- monotonic and safe.

CREATE TABLE IF NOT EXISTS document_number_sequences (
  scope       TEXT PRIMARY KEY,                  -- e.g. 'NDA-2026'
  last_value  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the counters from the IDs already issued so no existing number can be
-- handed out a second time.
INSERT INTO document_number_sequences (scope, last_value)
SELECT scope, MAX(seq)
  FROM (
    SELECT substring(unique_id from '^XTN-([A-Z0-9]+)-[0-9]{4}-') || '-' ||
           substring(unique_id from '^XTN-[A-Z0-9]+-([0-9]{4})-') AS scope,
           (substring(unique_id from '-([0-9]+)$'))::int AS seq
      FROM generated_documents
     WHERE unique_id ~ '^XTN-[A-Z0-9]+-[0-9]{4}-[0-9]+$'
  ) s
 WHERE scope IS NOT NULL
 GROUP BY scope
ON CONFLICT (scope) DO UPDATE
  SET last_value = GREATEST(document_number_sequences.last_value, EXCLUDED.last_value);

-- ───────────────────────── 12. the missing permissions ──────────────────────
--
-- Eight document routes require `documents.manage`, which was never inserted,
-- so every non-superadmin was denied. requirePermission returns early for
-- superadmin, which hid the gap.

INSERT INTO permissions (module, action, description)
VALUES
  ('documents','manage',            'Create, edit and publish document templates and clauses'),
  ('documents','manage_clauses',    'Maintain the clause library'),
  ('documents','publish_template',  'Publish a template version for formal use'),
  ('documents','issue',             'Issue an approved document to its recipient'),
  ('documents','issue_exceptional', 'Issue documents using profiles that require explicit authorization'),
  ('documents','record_signature',  'Record a received signed copy'),
  ('documents','manage_retention',  'Configure retention policies'),
  ('documents','manage_policy',     'Change documentation module policy settings')
ON CONFLICT (module, action) DO NOTHING;

COMMIT;
