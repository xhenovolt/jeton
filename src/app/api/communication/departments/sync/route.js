import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { query } from '@/lib/db.js';

/**
 * POST /api/communication/departments/sync
 *
 * Idempotently provisions a "department channel" conversation for every
 * row in `departments` and syncs its participant list against the staff
 * with matching department_id. Safe to call repeatedly — reruns only add
 * missing channels / newly-assigned staff and reactivate participants
 * whose staff record was re-linked.
 *
 * Admin only. Superadmin bypasses via requirePermission.
 */
export async function POST(req) {
  try {
    const perm = await requirePermission(req, 'communication.manage_participants');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId: actorId } = auth;

    const departments = await query('SELECT id, name FROM departments ORDER BY name');
    let channelsCreated = 0;
    let participantsAdded = 0;

    for (const dept of departments.rows) {
      const channelName = `${dept.name} — Team`;

      // Find or create the department channel. We match by (type, name)
      // rather than storing department_id on conversations to avoid
      // altering the schema for a soft mapping.
      let convId;
      const existing = await query(
        `SELECT id FROM conversations
         WHERE type = 'department' AND name = $1 AND deleted_at IS NULL LIMIT 1`,
        [channelName]
      );
      if (existing.rows.length > 0) {
        convId = existing.rows[0].id;
      } else {
        const created = await query(
          `INSERT INTO conversations (type, name, created_by)
           VALUES ('department', $1, $2) RETURNING id`,
          [channelName, actorId]
        );
        convId = created.rows[0].id;
        channelsCreated++;

        // Actor becomes admin of the new channel.
        await query(
          `INSERT INTO conversation_participants (conversation_id, user_id, role)
           VALUES ($1, $2, 'admin')
           ON CONFLICT (conversation_id, user_id) DO NOTHING`,
          [convId, actorId]
        );
      }

      // Sync staff.department_id -> users -> conversation_participants.
      // NEW-only insert; we never remove — leaving/rejoining a department
      // should not silently rip someone out of their channel history.
      const inserted = await query(
        `INSERT INTO conversation_participants (conversation_id, user_id, role, is_active)
         SELECT $1, u.id, 'member', TRUE
         FROM staff s
         JOIN users u ON u.staff_id = s.id
         WHERE s.department_id = $2
         ON CONFLICT (conversation_id, user_id) DO UPDATE
           SET is_active = TRUE
         RETURNING user_id`,
        [convId, dept.id]
      );
      participantsAdded += inserted.rows.length;
    }

    return NextResponse.json({
      success: true,
      departments: departments.rows.length,
      channels_created: channelsCreated,
      participants_upserted: participantsAdded,
    });
  } catch (error) {
    console.error('[departments/sync] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
