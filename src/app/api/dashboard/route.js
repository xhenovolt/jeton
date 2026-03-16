import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/dashboard - Founder dashboard summary
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'dashboard.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    // Parallel fetch all dashboard data
    const [
      prospectPipeline,
      recentFollowups,
      dealSummary,
      financialSummary,
      accountBalances,
      recentActivity,
      monthlyFinancials,
      operationsStats,
      attentionItems,
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
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as completed_value,
          COALESCE(SUM(total_amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.deal_id = deals.id AND p.status = 'completed'), 0))
            FILTER (WHERE status IN ('in_progress','accepted','sent')), 0) as outstanding_balance,
          COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('completed','cancelled')) as overdue_deals
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
      // Operations stats — spending by category + system
      query(`
        SELECT
          COUNT(*) as total_ops,
          COALESCE(SUM(amount), 0) as total_spent,
          COUNT(*) FILTER (WHERE amount IS NULL OR amount = 0) as unlinked_ops,
          COALESCE(SUM(amount) FILTER (WHERE operation_date >= date_trunc('month', NOW())), 0) as month_spent,
          COUNT(*) FILTER (WHERE operation_date >= date_trunc('month', NOW())) as month_ops
        FROM operations
      `),
      // Attention items — things the founder should act on
      query(`
        SELECT * FROM (
          SELECT 'overdue_followup' as item_type, f.id::text as item_id,
            p.company_name as label, f.scheduled_at::text as detail
          FROM followups f JOIN prospects p ON f.prospect_id = p.id
          WHERE f.status = 'scheduled' AND f.scheduled_at < NOW()
          ORDER BY f.scheduled_at ASC LIMIT 5
        ) ff
        UNION ALL
        SELECT * FROM (
          SELECT 'overdue_deal' as item_type, d.id::text as item_id,
            d.title as label, d.due_date::text as detail
          FROM deals d
          WHERE d.due_date IS NOT NULL AND d.due_date < NOW()
            AND d.status NOT IN ('completed','cancelled')
          ORDER BY d.due_date ASC LIMIT 5
        ) dd
        UNION ALL
        SELECT * FROM (
          SELECT 'unlinked_op' as item_type, o.id::text as item_id,
            COALESCE(o.title, o.description, o.category) as label,
            o.operation_date::text as detail
          FROM operations o
          WHERE (o.amount IS NULL OR o.amount = 0)
          ORDER BY o.created_at DESC LIMIT 5
        ) oo
      `),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        pipeline: prospectPipeline.rows,
        upcomingFollowups: recentFollowups.rows,
        deals: dealSummary.rows[0] || { active_deals: 0, active_value: 0, completed_deals: 0, completed_value: 0, outstanding_balance: 0, overdue_deals: 0 },
        financial: financialSummary.rows[0] || { total_income: 0, total_expenses: 0, net_position: 0 },
        accounts: accountBalances.rows,
        recentActivity: recentActivity.rows,
        monthlyFinancials: monthlyFinancials.rows,
        operations: operationsStats.rows[0] || { total_ops: 0, total_spent: 0, unlinked_ops: 0, month_spent: 0, month_ops: 0 },
        attention: attentionItems.rows,
      },
    });
  } catch (error) {
    console.error('[Dashboard API] Error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to load dashboard' }, { status: 500 });
  }
}
