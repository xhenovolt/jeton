/**
 * GET /api/prospects/followups?filter=overdue|today|upcoming
 *
 * Returns prospects that need follow-up today
 * Part of daily sales agenda system
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'overdue';

    let sql;
    const params = [];

    // Get prospects needing follow-up based on filter
    if (filter === 'overdue') {
      sql = `
        SELECT
          p.id,
          p.prospect_name,
          p.email,
          p.phone,
          p.business_name,
          p.sales_stage,
          p.follow_up_date,
          MAX(pa.created_at) as last_activity_at,
          TRUE as is_overdue,
          FALSE as is_today,
          FALSE as is_upcoming
        FROM prospects p
        LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
        WHERE p.status = 'Active'
          AND p.client_id IS NULL
          AND p.follow_up_date IS NOT NULL
          AND p.follow_up_date < CURRENT_DATE
        GROUP BY p.id
        ORDER BY p.follow_up_date ASC
      `;
    } else if (filter === 'today') {
      sql = `
        SELECT
          p.id,
          p.prospect_name,
          p.email,
          p.phone,
          p.business_name,
          p.sales_stage,
          p.follow_up_date,
          MAX(pa.created_at) as last_activity_at,
          FALSE as is_overdue,
          TRUE as is_today,
          FALSE as is_upcoming
        FROM prospects p
        LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
        WHERE p.status = 'Active'
          AND p.client_id IS NULL
          AND p.follow_up_date = CURRENT_DATE
        GROUP BY p.id
        ORDER BY p.prospect_name ASC
      `;
    } else if (filter === 'upcoming') {
      sql = `
        SELECT
          p.id,
          p.prospect_name,
          p.email,
          p.phone,
          p.business_name,
          p.sales_stage,
          p.follow_up_date,
          MAX(pa.created_at) as last_activity_at,
          FALSE as is_overdue,
          FALSE as is_today,
          TRUE as is_upcoming
        FROM prospects p
        LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
        WHERE p.status = 'Active'
          AND p.client_id IS NULL
          AND p.follow_up_date IS NOT NULL
          AND p.follow_up_date > CURRENT_DATE
        GROUP BY p.id
        ORDER BY p.follow_up_date ASC
        LIMIT 20
      `;
    }

    const result = await query(sql, params);

    return Response.json({
      success: true,
      data: result.rows || [],
      count: result.rows?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching follow-ups:', error);
    return Response.json(
      {
        success: false,
        error: error.message || 'Failed to fetch follow-ups',
      },
      { status: 500 }
    );
  }
}
