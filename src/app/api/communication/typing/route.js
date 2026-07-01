import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { updateTypingIndicator, getTypingUsers, isParticipant } from '@/lib/communication-utils.js';
import { query } from '@/lib/db.js';

/**
 * POST /api/communication/typing
 * Refresh the "user X is typing" indicator (auto-expires after 3s).
 *
 * Body: { conversationId } — accepts snake_case too.
 */
export async function POST(req) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;

    const body = await req.json();
    const conversationId = body.conversationId ?? body.conversation_id;
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const isPartOfConv = await isParticipant(conversationId, userId);
    if (!isPartOfConv) {
      return NextResponse.json(
        { success: false, error: 'User is not a participant' },
        { status: 403 }
      );
    }

    await updateTypingIndicator(conversationId, userId);
    const typingUsers = await getTypingUsers(conversationId);
    return NextResponse.json({ success: true, typingUsers });
  } catch (error) {
    console.error('Error updating typing indicator:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/communication/typing?conversationId=...
 * Returns the list of user IDs currently typing (excluding self) plus a
 * lightweight lookup of their display names so the UI can render
 * "Alice is typing…" without a second call.
 */
export async function GET(req) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;

    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversationId') || url.searchParams.get('conversation_id');
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId query param is required' },
        { status: 400 }
      );
    }

    const isPartOfConv = await isParticipant(conversationId, userId);
    if (!isPartOfConv) {
      return NextResponse.json(
        { success: false, error: 'User is not a participant' },
        { status: 403 }
      );
    }

    const rows = await query(
      `SELECT ti.user_id,
              COALESCE(u.full_name, u.name, s.name, u.email) AS name
       FROM typing_indicators ti
       LEFT JOIN users u ON u.id = ti.user_id
       LEFT JOIN staff s ON s.user_id = u.id
       WHERE ti.conversation_id = $1
         AND ti.expires_at > NOW()
         AND ti.user_id != $2`,
      [conversationId, userId]
    );

    return NextResponse.json({
      success: true,
      typingUsers: rows.rows.map(r => ({ user_id: r.user_id, name: r.name })),
    });
  } catch (error) {
    console.error('Error fetching typing indicators:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
