-- Migration 966: Real backup engine — checksums, jobs, logs, storage targets, schedules.
-- Phase 3 of enterprise hardening. Idempotent.

-- ============================================================
-- 0. system_backups — create base table if migration 800 wasn't applied
-- ============================================================
CREATE TABLE IF NOT EXISTS system_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT,
  cloudinary_public_id VARCHAR(500),
  file_size BIGINT DEFAULT 0,
  backup_type VARCHAR(30) DEFAULT 'full',
  status VARCHAR(20) DEFAULT 'completed',
  tags TEXT[] DEFAULT '{}',
  table_count INTEGER DEFAULT 0,
  row_count INTEGER DEFAULT 0,
  schema_version VARCHAR(20),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT backup_type_check CHECK (backup_type IN ('full', 'schema_only', 'data_only', 'incremental')),
  CONSTRAINT backup_status_check CHECK (status IN ('in_progress', 'completed', 'failed', 'uploaded'))
);
CREATE INDEX IF NOT EXISTS idx_backups_created ON system_backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_status  ON system_backups(status);

-- ============================================================
-- 1. system_backups — extend with integrity + lifecycle columns
-- ============================================================
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS checksum         VARCHAR(128);
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS checksum_algo    VARCHAR(20) DEFAULT 'sha256';
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS encrypted        BOOLEAN DEFAULT FALSE;
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS compression      VARCHAR(20);
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS storage_target_id UUID;
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS storage_path     TEXT;
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS verified_at      TIMESTAMPTZ;
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20)
  CHECK (verification_status IS NULL OR verification_status IN ('pending','verified','failed','corrupted'));
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS parent_backup_id UUID REFERENCES system_backups(id) ON DELETE SET NULL;
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS retention_until  TIMESTAMPTZ;
ALTER TABLE system_backups ADD COLUMN IF NOT EXISTS metadata         JSONB DEFAULT '{}'::jsonb;

-- ============================================================
-- 2. backup_storage_targets — destinations
-- ============================================================
CREATE TABLE IF NOT EXISTS backup_storage_targets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(120) NOT NULL,
  type            VARCHAR(20) NOT NULL CHECK (type IN ('local','cloudinary','s3','custom')),
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_backup_storage_targets_name ON backup_storage_targets(name);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_backups_storage_target') THEN
    ALTER TABLE system_backups
      ADD CONSTRAINT fk_backups_storage_target
      FOREIGN KEY (storage_target_id) REFERENCES backup_storage_targets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 3. backup_jobs — scheduled backup definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS backup_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  backup_type     VARCHAR(30) NOT NULL DEFAULT 'full'
    CHECK (backup_type IN ('full','schema_only','data_only','incremental')),
  schedule_cron   VARCHAR(100),
  storage_target_id UUID REFERENCES backup_storage_targets(id) ON DELETE SET NULL,
  encrypt         BOOLEAN NOT NULL DEFAULT FALSE,
  compress        BOOLEAN NOT NULL DEFAULT TRUE,
  retention_days  INTEGER NOT NULL DEFAULT 30,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at     TIMESTAMPTZ,
  last_status     VARCHAR(20),
  next_run_at     TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_active ON backup_jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_next_run ON backup_jobs(next_run_at) WHERE is_active;

-- ============================================================
-- 4. backup_logs — operational/diagnostic logs per backup or job run
-- ============================================================
CREATE TABLE IF NOT EXISTS backup_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id       UUID REFERENCES system_backups(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES backup_jobs(id) ON DELETE SET NULL,
  level           VARCHAR(10) NOT NULL DEFAULT 'info'
    CHECK (level IN ('debug','info','warn','error')),
  phase           VARCHAR(40),
  message         TEXT NOT NULL,
  details         JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backup_logs_backup ON backup_logs(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_logs_job    ON backup_logs(job_id);

-- ============================================================
-- 5. backup_restores — extend existing backup_restorations conceptually
-- ============================================================
CREATE TABLE IF NOT EXISTS backup_restores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id       UUID NOT NULL REFERENCES system_backups(id) ON DELETE CASCADE,
  preview_only    BOOLEAN NOT NULL DEFAULT FALSE,
  scope           VARCHAR(20) NOT NULL DEFAULT 'full'
    CHECK (scope IN ('full','tables','schema_only','data_only')),
  target_tables   TEXT[],
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','previewing','approved','running','completed','failed','rejected','cancelled')),
  preview_summary JSONB,
  rows_affected   INTEGER,
  tables_affected INTEGER,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  requested_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_reason TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backup_restores_backup ON backup_restores(backup_id);

-- ============================================================
-- 6. Permissions
-- ============================================================
INSERT INTO permissions (module, action, description, route_path) VALUES
  ('backups','view',    'View backups',         '/api/backups'),
  ('backups','create',  'Create backups',       '/api/backups'),
  ('backups','restore', 'Restore from backup',  '/api/backups/restore'),
  ('backups','delete',  'Delete backups',       '/api/backups'),
  ('backups','schedule','Schedule backups',     '/api/backups/jobs')
ON CONFLICT DO NOTHING;
