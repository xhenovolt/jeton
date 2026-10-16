import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { issueDocument, DocumentValidationError } from '@/lib/document-service.js';
import { verificationUrl } from '@/lib/document-generation.js';
import { query } from '@/lib/db.js';
import { dispatch } from '@/lib/system-events.js';

/**
 * POST /api/documents/generated/[id]/issue
 *
 * Body: {
 *   signature_parties?: [{ party_role, party_name, party_email?, staff_id?, is_required? }],
 *   bypass_reason?: string
 * }
 *
 * SIGNATURES — WHAT THIS DOES AND DOES NOT CLAIM
 *
 * Jeton has no validated electronic-signature integration, so it does not
 * pretend to sign anything. `signature_parties` creates records of who is
 * expected to sign; the state machine then tracks prepared → pending →
 * partially_signed → executed as signed copies are uploaded by a human. None
 * of those states asserts that a signature is legally valid.
 *
 * A bypass of pending approval is allowed only where
 * `document_policy_settings.allow_superadmin_bypass` permits it, requires a
 * reason, and is written onto the document and into the audit log — never
 * silent.
 */
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'documents.issue');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    await issueDocument({
      documentId: id,
      userId: auth.userId,
      signatureParties: body.signature_parties ?? [],
      bypassReason: body.bypass_reason ?? null,
      isSuperadmin: auth.role === 'superadmin',
    });

    // The verification link is returned here, to the issuer, because this is
    // the moment it is needed. It is never included in a listing.
    const r = await query(
      `SELECT unique_id, verification_token, signature_status, lifecycle_status
         FROM generated_documents WHERE id = $1`, [id]);
    const doc = r.rows[0];

    dispatch('document_issued', {
      entityType: 'generated_document',
      entityId: id,
      description: `Issued ${doc?.unique_id ?? 'document'}`,
      actorId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Issued.',
      data: {
        lifecycle_status: doc?.lifecycle_status,
        signature_status: doc?.signature_status,
        verification_url: doc ? verificationUrl(doc.unique_id, doc.verification_token) : null,
      },
    });
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    }
    console.error('[Documents/Issue] POST error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to issue the document' }, { status: 500 });
  }
}
