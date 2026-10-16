-- 990_document_audit_vocabulary.sql
--
-- WHY THIS EXISTS
--
-- Two CHECK constraints held allow-lists that were narrower than the values
-- the application actually wrote. Both failures were invisible:
--
-- 1. document_audit_logs.action allowed only
--      generated, viewed, downloaded, revoked, restored, updated
--    The pre-existing PATCH handler in api/documents/generated/[id] wrote
--    'edited', which violates that constraint. The insert sat inside a bare
--    `try {} catch {}`, so EVERY edit to a generated document failed to be
--    audited and nothing reported it. The document lifecycle added in 989
--    needs a further vocabulary (approved, rejected, issued, executed,
--    archived, signature events).
--
-- 2. document_verification_logs.verification_status allowed only
--      success, failed, tampered
--    The pre-existing public verify route wrote 'not_found', 'revoked' and
--    'expired'. Each of those raised a constraint violation which the outer
--    catch turned into `500 "Verification failed: <postgres message>"` for an
--    anonymous caller — so a revoked or expired document reported a server
--    error instead of its real status, and leaked schema detail doing it.
--
-- SAFETY
--
-- Additive: both constraints are replaced by supersets of the originals, so no
-- existing row can be invalidated. No data is modified.

BEGIN;

ALTER TABLE document_audit_logs DROP CONSTRAINT IF EXISTS document_audit_logs_action_check;

ALTER TABLE document_audit_logs ADD CONSTRAINT document_audit_logs_action_check
  CHECK (action = ANY (ARRAY[
    -- the original six, kept so existing rows stay valid
    'generated', 'viewed', 'downloaded', 'revoked', 'restored', 'updated',
    -- written by the pre-existing edit handler, but never permitted until now
    'edited', 'unrevoked',
    -- the lifecycle introduced in 989
    'submitted', 'approved', 'rejected', 'issued', 'executed',
    'cancelled', 'superseded', 'amended', 'renewed', 'archived',
    -- signature bookkeeping; records paper, asserts nothing about validity
    'signature_requested', 'signature_recorded', 'signature_declined',
    -- access and policy
    'shared', 'permission_changed', 'retention_applied'
  ]::text[]));

ALTER TABLE document_verification_logs
  DROP CONSTRAINT IF EXISTS document_verification_logs_verification_status_check;

ALTER TABLE document_verification_logs
  ADD CONSTRAINT document_verification_logs_verification_status_check
  CHECK (verification_status = ANY (ARRAY[
    'success', 'failed', 'tampered',
    -- states the route genuinely needs to record
    'not_found', 'revoked', 'cancelled', 'expired', 'superseded', 'not_issued'
  ]::text[]));

COMMIT;
