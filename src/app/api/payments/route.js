import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { Events } from '@/lib/events.js';

// GET /api/payments
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const deal_id = searchParams.get('deal_id');
    const status = searchParams.get('status');

    let sql = `SELECT p.*, d.title as deal_title, COALESCE(c.company_name, d.client_name) as client_name, a.name as account_name
               FROM payments p
               LEFT JOIN deals d ON p.deal_id = d.id
               LEFT JOIN clients c ON d.client_id = c.id
               LEFT JOIN accounts a ON p.account_id = a.id WHERE 1=1`;
    const params = [];
    if (deal_id) { params.push(deal_id); sql += ` AND p.deal_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND p.status = $${params.length}`; }
    sql += ` ORDER BY p.payment_date DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Payments] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST /api/payments - Create payment WITH automatic ledger entry
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { deal_id, account_id, amount, currency, method, reference, status, payment_date, notes } = body;
    
    if (!deal_id || !account_id || !amount) {
      return NextResponse.json({ success: false, error: 'deal_id, account_id, and amount are required' }, { status: 400 });
    }

    // Validate deal exists and check remaining amount
    const deal = await query(`SELECT d.*, COALESCE(c.company_name, d.client_name) as company_name FROM deals d LEFT JOIN clients c ON d.client_id = c.id WHERE d.id = $1`, [deal_id]);
    if (!deal.rows[0]) return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });

    const paymentStatus = status || 'completed';

    // Create payment
    const payResult = await query(
      `INSERT INTO payments (deal_id, account_id, amount, currency, method, reference, status, payment_date, notes, received_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [deal_id, account_id, amount, currency||'UGX', method||null, reference||null,
       paymentStatus, payment_date||new Date().toISOString().split('T')[0],
       notes||null, paymentStatus === 'completed' ? new Date() : null, auth.userId]
    );

    const payment = payResult.rows[0];

    // If completed, create ledger entry (CREDIT to account)
    if (paymentStatus === 'completed') {
      const ledgerResult = await query(
        `INSERT INTO ledger (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
         VALUES ($1,$2,$3,'payment',$4,$5,'revenue',$6,$7) RETURNING id`,
        [account_id, amount, currency||'UGX', payment.id,
         `Payment from ${deal.rows[0].company_name} - ${deal.rows[0].title}`,
         payment_date||new Date().toISOString().split('T')[0], auth.userId]
      );
      // Link ledger entry back to payment
      await query(`UPDATE payments SET ledger_entry_id = $1 WHERE id = $2`, [ledgerResult.rows[0].id, payment.id]);
      payment.ledger_entry_id = ledgerResult.rows[0].id;
    }

    // Auto-compute deal status based on total completed payments
    if (paymentStatus === 'completed') {
      const totals = await query(
        `SELECT COALESCE(SUM(p.amount),0) as paid FROM payments p WHERE p.deal_id = $1 AND p.status = 'completed'`, [deal_id]
      );
      const totalPaid = parseFloat(totals.rows[0].paid);
      const totalDeal = parseFloat(deal.rows[0].total_amount);
      let newDealStatus = deal.rows[0].status;
      if (totalPaid >= totalDeal) newDealStatus = 'completed';
      else if (totalPaid > 0) newDealStatus = 'in_progress';
      if (newDealStatus !== deal.rows[0].status) {
        await query(`UPDATE deals SET status = $1 WHERE id = $2`, [newDealStatus, deal_id]);
      }
    }

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'payment', payment.id, JSON.stringify({ deal_id, amount, method })]);
    await Events.paymentReceived(payment.id, amount, currency || 'UGX', deal.rows[0].title, auth.userId);

    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (error) {
    console.error('[Payments] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create payment' }, { status: 500 });
  }
}
