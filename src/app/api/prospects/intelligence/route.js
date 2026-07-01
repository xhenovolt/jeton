import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * GET /api/prospects/intelligence
 *
 * The founder's follow-up discipline dashboard, backed by
 * v_prospect_intelligence from migration 974. Returns:
 *
 *   summary       — counts per followup_status class + hygiene risks
 *   overdue       — prospects whose next_followup_date has passed (in
 *                   the past, not just soon-due)
 *   due_today     — next_followup_date === today
 *   dormant       — followup_status = 'dormant'  (>7d idle, no schedule)
 *   dead          — followup_status = 'dead'     (>30d idle OR marked)
 *   hot           — followup_status = 'hot'      (schedule within 48h)
 *   missing_phone       — no phone / alt / whatsapp captured
 *   missing_next_action — no next_followup_date scheduled
 *   warm_by_system      — warm+hot leads grouped by system_id
 *
 * All buckets return at most `limit` rows so the page stays snappy.
 * Bump ?limit= for CSV-like exhaustive listings.
 */

const MAX_LIMIT = 200;

// Minimal projection so the network payload stays small.
const PROJECTION = `
  id, company_name, contact_name, email, phone, alternative_phone, whatsapp_number,
  stage, pipeline, priority, estimated_value, currency,
  next_followup_date, next_followup_time, last_followup_at,
  assigned_to, system_id, service_id,
  followup_status, days_since_last_activity, hours_until_followup,
  missing_phone, missing_next_action
`;

export async function GET(request) {
  const perm = await requirePermission(request, 'prospects', 'view');
  if (perm instanceof NextResponse) return perm;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10) || 25, 1), MAX_LIMIT);

  try {
    // Fire all read queries in parallel — the view does the heavy lifting.
    const [
      summary, overdue, dueToday, dormant, dead, hot, missingPhone, missingNext, warmBySystem,
    ] = await Promise.all([
      query(`
        SELECT
          COUNT(*)                                                             ::int AS total,
          COUNT(*) FILTER (WHERE followup_status = 'converted')                 ::int AS converted,
          COUNT(*) FILTER (WHERE followup_status = 'dead')                      ::int AS dead,
          COUNT(*) FILTER (WHERE followup_status = 'dormant')                   ::int AS dormant,
          COUNT(*) FILTER (WHERE followup_status = 'hot')                       ::int AS hot,
          COUNT(*) FILTER (WHERE followup_status = 'warm')                      ::int AS warm,
          COUNT(*) FILTER (WHERE followup_status = 'active')                    ::int AS active,
          COUNT(*) FILTER (WHERE hours_until_followup < 0
                            AND followup_status NOT IN ('converted','dead'))    ::int AS overdue,
          COUNT(*) FILTER (WHERE next_followup_date = CURRENT_DATE
                            AND followup_status NOT IN ('converted','dead'))    ::int AS due_today,
          COUNT(*) FILTER (WHERE missing_phone)                                 ::int AS missing_phone,
          COUNT(*) FILTER (WHERE missing_next_action
                            AND followup_status NOT IN ('converted','dead'))    ::int AS missing_next_action
        FROM v_prospect_intelligence
      `),
      query(`SELECT ${PROJECTION} FROM v_prospect_intelligence
             WHERE hours_until_followup < 0
               AND followup_status NOT IN ('converted','dead')
             ORDER BY hours_until_followup ASC
             LIMIT $1`, [limit]),
      query(`SELECT ${PROJECTION} FROM v_prospect_intelligence
             WHERE next_followup_date = CURRENT_DATE
               AND followup_status NOT IN ('converted','dead')
             ORDER BY hours_until_followup ASC NULLS LAST
             LIMIT $1`, [limit]),
      query(`SELECT ${PROJECTION} FROM v_prospect_intelligence
             WHERE followup_status = 'dormant'
             ORDER BY days_since_last_activity DESC
             LIMIT $1`, [limit]),
      query(`SELECT ${PROJECTION} FROM v_prospect_intelligence
             WHERE followup_status = 'dead'
             ORDER BY days_since_last_activity DESC
             LIMIT $1`, [limit]),
      query(`SELECT ${PROJECTION} FROM v_prospect_intelligence
             WHERE followup_status = 'hot'
             ORDER BY hours_until_followup ASC
             LIMIT $1`, [limit]),
      query(`SELECT ${PROJECTION} FROM v_prospect_intelligence
             WHERE missing_phone AND followup_status NOT IN ('converted','dead')
             ORDER BY updated_at DESC NULLS LAST, created_at DESC
             LIMIT $1`, [limit]),
      query(`SELECT ${PROJECTION} FROM v_prospect_intelligence
             WHERE missing_next_action AND followup_status NOT IN ('converted','dead')
             ORDER BY days_since_last_activity DESC
             LIMIT $1`, [limit]),
      query(`
        SELECT COALESCE(s.name, 'Unspecified') AS system_name, s.id AS system_id,
               COUNT(*)::int AS count
        FROM v_prospect_intelligence v
        LEFT JOIN systems s ON v.system_id = s.id
        WHERE v.followup_status IN ('hot','warm','active')
        GROUP BY s.id, s.name
        ORDER BY count DESC
        LIMIT 12
      `),
    ]);

    return NextResponse.json({
      success: true,
      summary: summary.rows[0],
      overdue: overdue.rows,
      due_today: dueToday.rows,
      dormant: dormant.rows,
      dead: dead.rows,
      hot: hot.rows,
      missing_phone: missingPhone.rows,
      missing_next_action: missingNext.rows,
      warm_by_system: warmBySystem.rows,
    });
  } catch (err) {
    console.error('[prospects/intelligence] GET error:', err);
    return NextResponse.json({ success: false, error: 'Failed to load intelligence' }, { status: 500 });
  }
}
