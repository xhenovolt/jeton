import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { decideApproval, DocumentValidationError } from '@/lib/document-service.js';
import { dispatch } from '@/lib/system-events.js';

/**
 * POST /api/documents/generated/[id]/approve
 *
 * Body: { approve: boolean, reason?: string }
 *
 * Issued documents had no approval path at all before this:
 * `document_approvals.document_id` referenced the knowledge-base `documents`
 * table, so a generated contract could never have an approval row. Migration
 * 989 added a second subject column rather than dropping that foreign key.
 *
 * A rejection must carry a reason — "rejected" with no explanation is not a
 * usable business record — and that rule is enforced in the service, not here,
 * so it holds for every caller.
 */
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'documents.approve');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const { approve, reason } = await request.json();

    if (typeof approve !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'approve must be true or false' }, { status: 400 });
    }

    await decideApproval({ documentId: id, approve, reason, userId: auth.userId });

    dispatch(approve ? 'document_approved' : 'document_rejected', {
      entityType: 'generated_document',
      entityId: id,
      description: approve ? 'Document approved' : `Document rejected: ${reason}`,
      actorId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      message: approve
        ? 'Approved. The document can now be issued.'
        : 'Rejected. The reason has been recorded.',
    });
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    }
    console.error('[Documents/Approve] POST error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to record the decision' }, { status: 500 });
  }
}
