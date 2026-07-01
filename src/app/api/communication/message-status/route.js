import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { updateMessageStatus } from '@/lib/communication-utils.js';

/**
 * PUT /api/communication/message-status
 * Update a single message's read/delivery status for the current user.
 * (Bulk mark-read lives at /api/communication/[conversationId]/read.)
 */
export async function PUT(req) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;

    const body = await req.json();
    const messageId = body.message_id ?? body.messageId;
    const status    = body.status;

    if (!messageId || !status) {
      return NextResponse.json(
        { success: false, error: 'message_id and status are required' },
        { status: 400 }
      );
    }
    if (!['sent', 'delivered', 'seen'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    const result = await updateMessageStatus(messageId, userId, status);
    return NextResponse.json({ success: true, status: result });
  } catch (error) {
    console.error('Error updating message status:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
