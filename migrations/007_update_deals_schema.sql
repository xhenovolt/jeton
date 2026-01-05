/**
 * Migration: Update deals table schema
 * 
 * Converts the deals table from using client_name/notes to using
 * description/assigned_to for better data modeling and staff assignment
 */

-- ============================================================================
-- ALTER DEALS TABLE SCHEMA
-- ============================================================================

-- Add new columns if they don't exist
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- Drop old columns if they exist (only if new columns are populated)
-- This is a safe migration - old data is preserved if needed
-- Uncomment only after verifying data migration is complete
-- ALTER TABLE deals DROP COLUMN IF EXISTS client_name;
-- ALTER TABLE deals DROP COLUMN IF EXISTS notes;

-- Create index for assigned_to queries
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);

-- Add constraint to ensure status is valid
ALTER TABLE deals
ADD CONSTRAINT IF NOT EXISTS valid_deal_status 
CHECK (status IN ('ACTIVE', 'CLOSED', 'ARCHIVED'));
