import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { createCall, isParticipant } from '@/lib/communication-utils.js';
import { query } from '@/lib/db.js';

/**
 * POST /api/communication/calls
 *
 * Log a new call. Body accepts { conversation_id, call_type } (also the
 * camelCase equivalents). Actual audio/video streaming needs a signaling
 * server + STUN/TURN — not wired here — but the call record persists so
 * missed-call notifications, history, and the "call started" system
 * message all work.
 *
 * Call permissions are read from communication_settings
 * (audio_calls_enabled / video_calls_enabled) rather than the
 * call_permissions table, which was seeded with a roleId that never
 * maps to the session's role field.
 */
export async function POST(req) {
  try {
    const perm = await requirePermission(req, 'communication.start_call');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;

    const body = await req.json();
    const callType       = body.call_type       ?? body.callType;
    const conversationId = body.conversation_id ?? body.conversationId;

    if (!['audio', 'video'].includes(callType)) {
      return NextResponse.json(
        { success: false, error: 'call_type must be "audio" or "video"' },
        { status: 400 }
      );
    }
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversation_id is required' },
        { status: 400 }
      );
    }

    // Global on/off switch from communication_settings.
    const setting = await query(
      `SELECT setting_value FROM communication_settings
       WHERE setting_key = $1`,
      [callType === 'audio' ? 'audio_calls_enabled' : 'video_calls_enabled']
    );
    const enabled = setting.rows[0]?.setting_value?.enabled !== false;
    if (!enabled) {
      return NextResponse.json(
        { success: false, error: `${callType} calls are disabled` },
        { status: 403 }
      );
    }

    // Caller must be a member of the conversation.
    const isMember = await isParticipant(conversationId, userId);
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: 'You are not a member of this conversation' },
        { status: 403 }
      );
    }

    const call = await createCall({ callType, conversationId, callerId: userId });

    // Drop a system message into the thread so the conversation records the
    // call event even if the caller never picks it up.
    await query(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type)
       VALUES ($1, $2, $3, 'system')`,
      [conversationId, userId, `${callType === 'video' ? 'Video' : 'Voice'} call started`]
    );

    return NextResponse.json({ success: true, call }, { status: 201 });
  } catch (error) {
    console.error('Error initiating call:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/communication/calls?conversationId=... [&limit=]
 * Return recent calls for a conversation (call history panel).
 */
export async function GET(req) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;

    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversationId') || url.searchParams.get('conversation_id');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '25', 10) || 25, 100);
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId query param is required' },
        { status: 400 }
      );
    }

    const isMember = await isParticipant(conversationId, userId);
    if (!isMember) {
      return NextResponse.json({ success: false, error: 'Not a member' }, { status: 403 });
    }

    const rows = await query(
      `SELECT c.id, c.call_type, c.status, c.started_at, c.ended_at, c.duration_seconds,
              c.caller_id,
              COALESCE(u.full_name, u.name, s.name, u.email) AS caller_name
       FROM calls c
       LEFT JOIN users u ON u.id = c.caller_id
       LEFT JOIN staff s ON s.user_id = u.id
       WHERE c.conversation_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2`,
      [conversationId, limit]
    );

    return NextResponse.json({ success: true, calls: rows.rows });
  } catch (error) {
    console.error('Error listing calls:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
