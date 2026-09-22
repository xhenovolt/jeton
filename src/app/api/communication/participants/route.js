import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import {
  addConversationParticipant,
  removeConversationParticipant,
  logCommunicationAudit,
} from '@/lib/communication-utils.js';
import { query } from '@/lib/db.js';

/**
 * POST /api/communication/participants
 * Add or remove a participant from a group/department conversation.
 *
 * Body: { conversationId, userId (to add/remove), action: 'add'|'remove'|'promote'|'demote' }
 * Accepts snake_case too.
 *
 * Only conversation admins (or superadmin bypass in requirePermission) can act.
 */
export async function POST(req) {
  try {
    const perm = await requirePermission(req, 'communication.manage_participants');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId: actorId } = auth;

    const body = await req.json();
    const conversationId = body.conversationId ?? body.conversation_id;
    const targetUserId   = body.userId         ?? body.user_id ?? body.userIdToAdd;
    const action         = body.action ?? 'add';

    if (!conversationId || !targetUserId) {
      return NextResponse.json(
        { success: false, error: 'conversationId and userId are required' },
        { status: 400 }
      );
    }
    if (!['add', 'remove', 'promote', 'demote'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Direct conversations can never be modified.
    const convType = await query('SELECT type FROM conversations WHERE id = $1', [conversationId]);
    if (convType.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
    }
    if (convType.rows[0].type === 'direct') {
      return NextResponse.json(
        { success: false, error: 'Direct conversations cannot have participants added or removed' },
        { status: 400 }
      );
    }

    // Actor must be a group admin (superadmin bypass already happened in
    // requirePermission for anyone with manage_participants at the module
    // level — but for regular admins we still need per-conversation check).
    const isAdmin = await query(
      `SELECT role FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [conversationId, actorId]
    );
    const actorRole = isAdmin.rows[0]?.role;
    const globalPerms = perm.auth?.role;
    if (actorRole !== 'admin' && globalPerms !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Only conversation admins can manage participants' },
        { status: 403 }
      );
    }

    let result;
    if (action === 'add') {
      result = await addConversationParticipant(conversationId, targetUserId);
    } else if (action === 'remove') {
      result = await removeConversationParticipant(conversationId, targetUserId);
    } else if (action === 'promote' || action === 'demote') {
      const newRole = action === 'promote' ? 'admin' : 'member';
      const upd = await query(
        `UPDATE conversation_participants
         SET role = $1
         WHERE conversation_id = $2 AND user_id = $3
         RETURNING *`,
        [newRole, conversationId, targetUserId]
      );
      result = upd.rows[0];
    }

    await logCommunicationAudit({
      userId: actorId,
      action: `participant_${action}`,
      entityType: 'conversation_participant',
      entityId: result?.id ?? null,
      conversationId,
      details: { target_user_id: targetUserId },
    });

    return NextResponse.json({ success: true, participant: result });
  } catch (error) {
    console.error('Error managing participant:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/communication/participants?conversationId=…
 * List active participants with name, avatar, role.
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

    // Caller must be a participant.
    const check = await query(
      `SELECT 1 FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND is_active = TRUE`,
      [conversationId, userId]
    );
    if (check.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Not a member' }, { status: 403 });
    }

    const rows = await query(
      `SELECT cp.user_id, cp.role, cp.joined_at, cp.is_active,
              COALESCE(u.full_name, u.name, s.name, u.email) AS name,
              u.email,
              u.profile_image_url                            AS avatar,
              COALESCE(up.is_online, FALSE)                  AS is_online
       FROM conversation_participants cp
       LEFT JOIN users u ON u.id = cp.user_id
       LEFT JOIN staff s ON s.user_id = u.id
       LEFT JOIN user_presence up ON up.user_id = cp.user_id
       WHERE cp.conversation_id = $1 AND cp.is_active = TRUE
       ORDER BY cp.role DESC, name ASC`,
      [conversationId]
    );

    return NextResponse.json({ success: true, participants: rows.rows });
  } catch (error) {
    console.error('Error listing participants:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
