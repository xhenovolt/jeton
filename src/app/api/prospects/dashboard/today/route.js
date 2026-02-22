/**
 * GET /api/prospects/dashboard/today
 * Daily prospecting dashboard summary
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Get today's prospecting summary
    const summaryResult = await query(
      `
      SELECT * FROM get_today_prospecting_summary($1::DATE)
      `,
      [date]
    );

    const summary = summaryResult.rows[0];

    // Get overdue follow-ups
    const overdueResult = await query(
      `
      SELECT * FROM get_overdue_follow_ups()
      `
    );

    // Get today's prospects
    const todayProspectsResult = await query(
      `
      SELECT 
        id,
        prospect_name,
        business_name,
        phone,
        email,
        interest_level,
        sales_stage,
        next_follow_up_date,
        total_activities_count
      FROM prospects
      WHERE DATE(created_at) = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
      `,
      [date]
    );

    // Get today's follow-ups
    const todayFollowUpsResult = await query(
      `
      SELECT 
        p.id,
        p.prospect_name,
        p.business_name,
        p.next_follow_up_date,
        p.sales_stage,
        pa.id as last_activity_id,
        pa.title as last_activity_title,
        pa.activity_type
      FROM prospects p
      LEFT JOIN prospect_activities pa ON p.last_activity_id = pa.id
      WHERE p.next_follow_up_date = $1 AND p.deleted_at IS NULL AND p.sales_stage NOT IN ('Converted', 'Lost', 'Not Interested')
      ORDER BY p.next_follow_up_date ASC
      `,
      [date]
    );

    // Get today's conversations
    const conversationsResult = await query(
      `
      SELECT 
        p.id,
        p.prospect_name,
        pa.id as activity_id,
        pa.activity_type,
        pa.title,
        pa.outcome,
        pa.prospect_mood,
        pa.confidence_level,
        pa.created_at
      FROM prospects p
      JOIN prospect_activities pa ON p.id = pa.prospect_id
      WHERE DATE(pa.created_at) = $1 AND pa.activity_type IN ('CONVERSATION', 'MEETING', 'CALL')
      ORDER BY pa.created_at DESC
      `,
      [date]
    );

    // Get conversion rate (this week)
    const weekStartDate = new Date();
    weekStartDate.setDate(weekStartDate.getDate() - 7);
    const weekStart = weekStartDate.toISOString().split('T')[0];

    const conversionRateResult = await query(
      `
      SELECT 
        COUNT(DISTINCT CASE WHEN p.sales_stage = 'Converted' THEN p.id END) as converted,
        COUNT(DISTINCT p.id) as total
      FROM prospects p
      WHERE DATE(p.created_at) >= $1 AND p.deleted_at IS NULL
      `,
      [weekStart]
    );

    const conversionData = conversionRateResult.rows[0];
    const conversionRate = conversionData.total > 0 
      ? ((conversionData.converted / conversionData.total) * 100).toFixed(2)
      : 0;

    return Response.json({
      success: true,
      data: {
        summary: {
          newProspectsToday: summary.new_prospects_today,
          followUpsDueToday: summary.follow_ups_due_today,
          overdueFollowUps: summary.overdue_follow_ups,
          conversationsLoggedToday: summary.conversations_logged_today,
          conversionCountThisWeek: summary.conversion_count_this_week,
          conversionRateThisWeek: conversionRate,
        },
        overdueFollowUps: overdueResult.rows,
        todaysProspects: todayProspectsResult.rows,
        todaysFollowUps: todayFollowUpsResult.rows,
        todaysConversations: conversationsResult.rows,
      },
      date,
    });
  } catch (error) {
    console.error('Dashboard GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
