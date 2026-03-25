/**
 * API: Create or get conversations
 * GET /api/communication/conversations - List user's conversations
 * POST /api/communication/conversations - Create new conversation
 */

import { getCurrentUser } from '@/lib/current-user.js';
import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    // Get user's conversations (ordered by last message)
    const result = await query(
      `
      SELECT 
        c.id, c.type, c.name, c.description, c.avatar_url,
        c.created_by_user_id, c.created_at, c.last_message_at,
        (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id AND is_active = true) as member_count,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND is_deleted = false) as unread_count
      FROM conversations c
      INNER JOIN conversation_members cm ON c.id = cm.conversation_id
      WHERE cm.user_id = $1 AND cm.is_active = true AND c.is_archived = false
      ORDER BY c.last_message_at DESC NULLS LAST
      LIMIT $2 OFFSET $3
      `,
      [user.id, limit, offset]
    );

    return Response.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[conversations GET] Error:', error.message);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { type, name, description, avatar_url, member_ids = [] } = body;

    // ── Validate ──
    if (!type || !['direct', 'group'].includes(type)) {
      return Response.json(
        { success: false, error: 'Invalid conversation type' },
        { status: 400 }
      );
    }

    // For direct messages, must have exactly 2 members
    if (type === 'direct' && (!member_ids.length || member_ids.includes(user.id))) {
      return Response.json(
        { success: false, error: 'Direct message must have another user' },
        { status: 400 }
      );
    }

    // For groups, name is required
    if (type === 'group' && !name) {
      return Response.json(
        { success: false, error: 'Group name is required' },
        { status: 400 }
      );
    }

    // ── Check if direct conversation already exists ──
    if (type === 'direct') {
      const existing = await query(
        `
        SELECT c.id FROM conversations c
        WHERE c.type = 'direct'
        AND c.id IN (
          SELECT conversation_id FROM conversation_members 
          WHERE user_id = $1 OR user_id = $2
          GROUP BY conversation_id HAVING COUNT(*) = 2
        )
        LIMIT 1
        `,
        [user.id, member_ids[0]]
      );

      if (existing.rows.length > 0) {
        return Response.json({
          success: true,
          data: { id: existing.rows[0].id, existing: true },
        });
      }
    }

    // ── Create conversation ──
    const convResult = await query(
      `
      INSERT INTO conversations (type, name, description, avatar_url, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, type, name, created_at
      `,
      [type, name || null, description || null, avatar_url || null, user.id]
    );

    const conversationId = convResult.rows[0].id;

    // ── Add members ──
    const allMembers = [user.id, ...member_ids];
    for (const memberId of allMembers) {
      await query(
        `
        INSERT INTO conversation_members (conversation_id, user_id, role)
        VALUES ($1, $2, $3)
        `,
        [conversationId, memberId, memberId === user.id ? 'owner' : 'member']
      );
    }

    return Response.json(
      {
        success: true,
        data: convResult.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[conversations POST] Error:', error.message);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
