import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { isParticipant, logCommunicationAudit } from '@/lib/communication-utils.js';

/**
 * PATCH /api/communication/conversations/[conversationId]
 * Per-user chat lifecycle: archive / unarchive / hide.
 *
 * Body accepts:
 *   { is_archived: boolean }  — WhatsApp "Archive chat" (still visible in
 *                               Archived tab; unread count preserved)
 *   { is_hidden:   boolean }  — WhatsApp "Delete chat" for me (removes
 *                               from all lists but preserves history for
 *                               the other participant)
 *
 * Writes to conversation_participants (migration 976) so the state is
 * per-user — the other side of the chat is unaffected.
 */
export async function PATCH(req, { params }) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;
    const { conversationId } = await params;

    const isMember = await isParticipant(conversationId, userId);
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: 'Not a member of this conversation' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { is_archived, is_hidden } = body;

    if (typeof is_archived !== 'boolean' && typeof is_hidden !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'is_archived or is_hidden must be provided as a boolean' },
        { status: 400 }
      );
    }

    // Build a single UPDATE that toggles whichever field(s) were sent.
    const sets = [];
    const params_ = [conversationId, userId];
    if (typeof is_archived === 'boolean') {
      sets.push(`archived_at = ${is_archived ? 'NOW()' : 'NULL'}`);
    }
    if (typeof is_hidden === 'boolean') {
      sets.push(`hidden_at = ${is_hidden ? 'NOW()' : 'NULL'}`);
    }

    const result = await query(
      `UPDATE conversation_participants
       SET ${sets.join(', ')}
       WHERE conversation_id = $1 AND user_id = $2
       RETURNING archived_at, hidden_at`,
      params_
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    await logCommunicationAudit({
      userId,
      action: typeof is_archived === 'boolean'
        ? (is_archived ? 'conversation_archived' : 'conversation_unarchived')
        : (is_hidden ? 'conversation_hidden' : 'conversation_unhidden'),
      entityType: 'conversation',
      entityId: conversationId,
    });

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        is_archived: row.archived_at !== null,
        is_hidden:   row.hidden_at   !== null,
      },
      message:
        typeof is_archived === 'boolean'
          ? (is_archived ? 'Conversation archived' : 'Conversation unarchived')
          : (is_hidden ? 'Conversation removed from your list' : 'Conversation restored'),
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/communication/conversations/[conversationId]
 * Non-owner delete = "hide for me" (per-user). Owner OR superadmin can
 * do a hard soft-delete on the conversation itself (removes for everyone).
 */
export async function DELETE(req, { params }) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;
    const { conversationId } = await params;

    const conv = await query(
      'SELECT created_by, type FROM conversations WHERE id = $1 AND deleted_at IS NULL',
      [conversationId]
    );
    if (conv.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Confirm participant before doing anything.
    const member = await isParticipant(conversationId, userId);
    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Not a member of this conversation' },
        { status: 403 }
      );
    }

    const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
    const userRole = userResult.rows[0]?.role;
    const isOwnerOrSuperadmin =
      conv.rows[0].created_by === userId || userRole === 'superadmin';

    // Direct chats: never fully delete — always hide-for-me, since the
    // other party still owns their side.
    if (conv.rows[0].type === 'direct' || !isOwnerOrSuperadmin) {
      await query(
        `UPDATE conversation_participants
         SET hidden_at = NOW()
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
      );

      await logCommunicationAudit({
        userId, action: 'conversation_hidden', entityType: 'conversation', entityId: conversationId,
      });

      return NextResponse.json({
        success: true,
        message: 'Conversation removed from your list',
        scope: 'me',
      });
    }

    // Group/department + owner/superadmin: soft-delete for everyone.
    await query(
      `UPDATE conversations SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    await logCommunicationAudit({
      userId, action: 'conversation_deleted', entityType: 'conversation', entityId: conversationId,
    });

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted for everyone',
      scope: 'all',
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
