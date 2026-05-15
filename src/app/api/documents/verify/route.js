import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { isDocumentValid, validateVerificationHash } from '@/lib/document-generation.js';

// GET /api/documents/verify?id=XTN-INT-2026-0001&token=abc123
// Public endpoint - no auth required
// Returns document verification status and details
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');
    const token = searchParams.get('token');

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID required (query param: ?id=XTN-INT-2026-0001)' },
        { status: 400 }
      );
    }

    // Fetch document by unique_id
    const docRes = await query(
      `SELECT id, unique_id, title, document_type, recipient_name, recipient_email,
              generated_at, viewed_count, expires_at, is_revoked, revocation_reason,
              verification_token, verification_hash
       FROM generated_documents
       WHERE unique_id = $1`,
      [documentId.toUpperCase()]
    );

    if (!docRes.rows[0]) {
      // Log failed verification attempt
      await query(
        `INSERT INTO document_verifications (generated_document_id, verification_status)
         VALUES ($1, 'not_found') ON CONFLICT DO NOTHING`,
        [null]
      );

      return NextResponse.json(
        { success: false, error: 'Document not found', status: 'not_found' },
        { status: 404 }
      );
    }

    const doc = docRes.rows[0];

    // Verify token if provided
    if (token && doc.verification_token !== token) {
      await query(
        `INSERT INTO document_verifications (generated_document_id, verification_status, verification_token)
         VALUES ($1, 'invalid', $2)`,
        [doc.id, token]
      );

      return NextResponse.json(
        { success: false, error: 'Invalid verification token', status: 'invalid' },
        { status: 401 }
      );
    }

    // Check document validity
    if (!isDocumentValid(doc)) {
      const status = doc.is_revoked ? 'revoked' : 'expired';
      await query(
        `INSERT INTO document_verifications (generated_document_id, verification_status, verification_token)
         VALUES ($1, $2, $3)`,
        [doc.id, status, token || null]
      );

      return NextResponse.json(
        {
          success: false,
          error: doc.is_revoked ? `Document has been revoked: ${doc.revocation_reason}` : 'Document has expired',
          status,
          revoked_at: doc.is_revoked ? new Date(doc.created_at) : null,
          revocation_reason: doc.revocation_reason,
        },
        { status: 410 }
      );
    }

    // Log successful verification
    await query(
      `INSERT INTO document_verifications (generated_document_id, verification_status, verification_token)
       VALUES ($1, 'valid', $2)`,
      [doc.id, token || null]
    );

    // Increment view count
    await query(
      `UPDATE generated_documents SET viewed_count = viewed_count + 1, last_viewed_at = NOW()
       WHERE id = $1`,
      [doc.id]
    );

    return NextResponse.json({
      success: true,
      status: 'valid',
      data: {
        id: doc.unique_id,
        title: doc.title,
        document_type: doc.document_type,
        recipient_name: doc.recipient_name,
        recipient_email: doc.recipient_email,
        generated_at: doc.generated_at,
        expires_at: doc.expires_at,
        view_count: doc.viewed_count + 1,
        verified: true,
      },
    });
  } catch (error) {
    console.error('[Documents/Verify] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed: ' + error.message },
      { status: 500 }
    );
  }
}

// POST /api/documents/verify - Revoke a document (admin only)
export async function POST(request) {
  try {
    const perm = await require('@/lib/permissions.js').requirePermission(request, 'documents.revoke');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { document_id, reason } = await request.json();

    if (!document_id) {
      return NextResponse.json(
        { success: false, error: 'document_id required' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE generated_documents
       SET is_revoked = TRUE, revoked_at = NOW(), revoked_by = $1, revocation_reason = $2
       WHERE id = $3
       RETURNING *`,
      [auth.userId, reason || 'Document revoked by administrator', document_id]
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Document revoked successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Documents/Verify] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke document: ' + error.message },
      { status: 500 }
    );
  }
}
