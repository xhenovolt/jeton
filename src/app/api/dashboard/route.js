import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/dashboard - Founder dashboard summary
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // Parallel fetch all dashboard data
    const [
      prospectPipeline,
      recentFollowups,
      dealSummary,
      financialSummary,
      accountBalances,
      recentActivity,
      monthlyFinancials,
    ] = await Promise.all([
      // Prospect pipeline
      query(`
        SELECT stage, COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as total_value
        FROM prospects WHERE stage NOT IN ('won', 'lost')
        GROUP BY stage ORDER BY 
          CASE stage WHEN 'new' THEN 1 WHEN 'contacted' THEN 2 WHEN 'qualified' THEN 3 
          WHEN 'proposal' THEN 4 WHEN 'negotiation' THEN 5 ELSE 6 END
      `),
      // Upcoming follow-ups
      query(`
        SELECT f.id, f.type, f.status, f.scheduled_at, f.summary,
               p.company_name as prospect_name
        FROM followups f
        JOIN prospects p ON f.prospect_id = p.id
        WHERE f.status = 'scheduled' AND f.scheduled_at >= NOW()
        ORDER BY f.scheduled_at ASC LIMIT 10
      `),
      // Deal summary
      query(`
        SELECT 
          COUNT(*) FILTER (WHERE status IN ('draft','sent','accepted','in_progress')) as active_deals,
          COALESCE(SUM(total_amount) FILTER (WHERE status IN ('draft','sent','accepted','in_progress')), 0) as active_value,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_deals,
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as completed_value
        FROM deals
      `),
      // Financial summary from ledger
      query(`SELECT * FROM v_financial_summary`),
      // Account balances  
      query(`SELECT * FROM v_account_balances WHERE is_active = true ORDER BY balance DESC`),
      // Recent audit log
      query(`
        SELECT action, entity_type, details, created_at
        FROM audit_logs ORDER BY created_at DESC LIMIT 10
      `),
      // Monthly financials
      query(`SELECT * FROM v_monthly_financials LIMIT 12`),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        pipeline: prospectPipeline.rows,
        upcomingFollowups: recentFollowups.rows,
        deals: dealSummary.rows[0] || { active_deals: 0, active_value: 0, completed_deals: 0, completed_value: 0 },
        financial: financialSummary.rows[0] || { total_income: 0, total_expenses: 0, net_position: 0 },
        accounts: accountBalances.rows,
        recentActivity: recentActivity.rows,
        monthlyFinancials: monthlyFinancials.rows,
      },
    });
  } catch (error) {
    console.error('[Dashboard API] Error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to load dashboard' }, { status: 500 });
  }
}
