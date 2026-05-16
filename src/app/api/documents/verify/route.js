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

    // Get client information for logging
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID required (query param: ?id=XTN-INT-2026-0001)' },
        { status: 400 }
      );
    }

    // Fetch document by unique_id
    const docRes = await query(
      `SELECT id, unique_id, title, document_type, recipient_name, recipient_email,
              generated_at, viewed_count, expires_at, status, is_revoked,
              verification_token, verification_hash
       FROM generated_documents
       WHERE unique_id = $1`,
      [documentId.toUpperCase()]
    );

    if (!docRes.rows[0]) {
      // Log failed verification attempt
      await query(
        `INSERT INTO document_verification_logs (document_id, ip_address, user_agent, verification_status)
         VALUES ($1, $2, $3, 'not_found')`,
        [null, ipAddress, userAgent]
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
        `INSERT INTO document_verification_logs (document_id, ip_address, user_agent, verification_status)
         VALUES ($1, $2, $3, 'failed')`,
        [doc.id, ipAddress, userAgent]
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
        `INSERT INTO document_verification_logs (document_id, ip_address, user_agent, verification_status)
         VALUES ($1, $2, $3, $4)`,
        [doc.id, ipAddress, userAgent, status]
      );

      return NextResponse.json(
        {
          success: false,
          error: doc.is_revoked ? 'Document has been revoked' : 'Document has expired',
          status,
        },
        { status: 410 }
      );
    }

    // Log successful verification
    await query(
      `INSERT INTO document_verification_logs (document_id, ip_address, user_agent, verification_status)
       VALUES ($1, $2, $3, 'success')`,
      [doc.id, ipAddress, userAgent]
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
    const { requirePermission } = await import('@/lib/permissions.js');
    const perm = await requirePermission(request, 'documents.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { document_id, reason } = await request.json();

    if (!document_id) {
      return NextResponse.json(
        { success: false, error: 'document_id required' },
        { status: 400 }
      );
    }

    // Get current document status
    const docRes = await query(
      `SELECT id, unique_id, status FROM generated_documents WHERE id = $1`,
      [document_id]
    );

    if (!docRes.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    const doc = docRes.rows[0];

    if (doc.status === 'revoked') {
      return NextResponse.json(
        { success: false, error: 'Document is already revoked' },
        { status: 400 }
      );
    }

    // Update document status
    const result = await query(
      `UPDATE generated_documents
       SET status = 'revoked', is_revoked = TRUE, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [document_id]
    );

    // Log the revocation
    await query(
      `INSERT INTO document_audit_logs (document_id, action, actor_id, details)
       VALUES ($1, 'revoked', $2, $3)`,
      [
        document_id,
        auth.userId,
        JSON.stringify({
          reason: reason || 'Document revoked by administrator',
          old_status: doc.status,
          new_status: 'revoked'
        })
      ]
    );

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
