import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * POST /api/prospects/intelligence/alerts
 *
 * Scans v_prospect_intelligence and creates a notification row for every
 * overdue prospect, targeted at whoever OWNS the prospect (assigned_to,
 * else created_by). Idempotent per-day per-prospect at the app level:
 * we SELECT before INSERTing so re-clicking "Generate alerts" doesn't
 * flood the inbox (the intended unique index couldn't be created —
 * created_at::date isn't IMMUTABLE — so we dedup here instead).
 *
 * Returns { created, skipped, total_overdue }.
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'prospects', 'view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const overdue = await query(`
      SELECT id, company_name, assigned_to, created_by,
             days_since_last_activity, hours_until_followup, next_followup_date
      FROM v_prospect_intelligence
      WHERE hours_until_followup < 0
        AND followup_status NOT IN ('converted','dead')
      ORDER BY hours_until_followup ASC
    `);

    let created = 0, skipped = 0;
    for (const p of overdue.rows) {
      const target = p.assigned_to || p.created_by;
      if (!target) { skipped++; continue; }

      // App-level dedup: skip if a same-type alert for this prospect
      // was already written today for this recipient.
      const dup = await query(
        `SELECT 1 FROM notifications
         WHERE recipient_user_id = $1
           AND type = 'prospect_followup_overdue'
           AND reference_id = $2
           AND created_at::date = CURRENT_DATE
         LIMIT 1`,
        [target, p.id]
      );
      if (dup.rows.length > 0) { skipped++; continue; }

      const daysOverdue = Math.max(0, Math.round(-Number(p.hours_until_followup || 0) / 24));
      const daysIdle    = Math.round(Number(p.days_since_last_activity || 0));
      const label       = p.company_name || 'A prospect';
      const message     = daysOverdue > 0
        ? `${label} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue for follow-up.`
        : `${label} has not been followed up for ${daysIdle} day${daysIdle === 1 ? '' : 's'}.`;

      try {
        await query(
          `INSERT INTO notifications
             (recipient_user_id, actor_user_id, type, title, message, reference_type, reference_id, is_read)
           VALUES ($1, $2, 'prospect_followup_overdue', 'Follow-up overdue', $3, 'prospect', $4, FALSE)`,
          [target, auth.userId, message, p.id]
        );
        created++;
      } catch (err) {
        console.warn('[intelligence/alerts] insert failed:', err.message);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total_overdue: overdue.rows.length,
    });
  } catch (err) {
    console.error('[intelligence/alerts] POST error:', err);
    return NextResponse.json({ success: false, error: 'Failed to generate alerts' }, { status: 500 });
  }
}
