import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { isParticipant } from '@/lib/communication-utils.js';

/**
 * POST /api/communication/[conversationId]/read
 *
 * Bulk mark-read: sets status='seen' for every message_status row
 * belonging to the current user in this conversation that isn't
 * already seen. Also updates cp.last_read_at so the sidebar's unread
 * dot matches reality.
 *
 * WhatsApp-parity: called when the user opens a conversation.
 */
export async function POST(req, { params }) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;
    const { conversationId } = await params;

    const member = await isParticipant(conversationId, userId);
    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Not a member of this conversation' },
        { status: 403 }
      );
    }

    const upd = await query(
      `UPDATE message_status
       SET status = 'seen', updated_at = NOW()
       WHERE user_id = $1
         AND status != 'seen'
         AND message_id IN (
           SELECT id FROM messages
           WHERE conversation_id = $2 AND deleted_at IS NULL
         )
       RETURNING message_id`,
      [userId, conversationId]
    );

    await query(
      `UPDATE conversation_participants
       SET last_read_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    return NextResponse.json({
      success: true,
      marked_read: upd.rows.length,
    });
  } catch (error) {
    console.error('Error marking read:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
