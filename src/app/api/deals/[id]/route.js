import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/deals/[id]
export async function GET(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const { id } = await params;
    const result = await query(
      `SELECT d.*, c.company_name as client_name, o.name as offering_name,
        (SELECT json_agg(p.* ORDER BY p.payment_date DESC) FROM payments p WHERE p.deal_id = d.id) as payments,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.deal_id = d.id AND p.status = 'completed'), 0) as paid_amount
       FROM deals d
       JOIN clients c ON d.client_id = c.id
       LEFT JOIN offerings o ON d.offering_id = o.id
       WHERE d.id = $1`, [id]
    );
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });
    const deal = result.rows[0];
    deal.remaining_amount = parseFloat(deal.total_amount) - parseFloat(deal.paid_amount);
    return NextResponse.json({ success: true, data: deal });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch deal' }, { status: 500 });
  }
}

// PUT /api/deals/[id]
export async function PUT(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const fields = ['title','description','total_amount','currency','status','start_date','end_date','due_date','invoice_number','invoice_sent_at','invoice_pdf_url','terms','notes','tags','metadata'];
    const updates = [];
    const values = [];
    fields.forEach(f => { if (body[f] !== undefined) { values.push(typeof body[f] === 'object' && !Array.isArray(body[f]) ? JSON.stringify(body[f]) : body[f]); updates.push(`${f} = $${values.length}`); } });
    if (updates.length === 0) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    if (body.status === 'completed') updates.push(`closed_at = NOW()`);
    values.push(id);
    const result = await query(`UPDATE deals SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });
    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'UPDATE', 'deal', id, JSON.stringify(body)]);
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update deal' }, { status: 500 });
  }
}

// DELETE /api/deals/[id]
export async function DELETE(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    const { id } = await params;
    const payments = await query(`SELECT COUNT(*) FROM payments WHERE deal_id = $1 AND status = 'completed'`, [id]);
    if (parseInt(payments.rows[0].count) > 0) {
      return NextResponse.json({ success: false, error: 'Cannot delete deal with completed payments' }, { status: 409 });
    }
    await query(`DELETE FROM payments WHERE deal_id = $1`, [id]);
    const result = await query(`DELETE FROM deals WHERE id = $1 RETURNING id, title`, [id]);
    if (!result.rows[0]) return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Deal deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete deal' }, { status: 500 });
  }
}
