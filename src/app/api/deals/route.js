import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/deals
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const client_id = searchParams.get('client_id');

    let sql = `SELECT d.*, c.company_name as client_name, o.name as offering_name,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.deal_id = d.id AND p.status = 'completed'), 0) as paid_amount,
      d.total_amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.deal_id = d.id AND p.status = 'completed'), 0) as remaining_amount,
      (SELECT COUNT(*) FROM payments p WHERE p.deal_id = d.id AND p.status = 'completed') as payment_count
      FROM deals d
      JOIN clients c ON d.client_id = c.id
      LEFT JOIN offerings o ON d.offering_id = o.id
      WHERE 1=1`;
    const params = [];

    if (status) { params.push(status); sql += ` AND d.status = $${params.length}`; }
    if (client_id) { params.push(client_id); sql += ` AND d.client_id = $${params.length}`; }
    sql += ` ORDER BY d.created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Deals] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch deals' }, { status: 500 });
  }
}

// POST /api/deals
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { client_id, prospect_id, offering_id, title, description, total_amount, currency, status, start_date, end_date, due_date, invoice_number, terms, notes, tags } = body;
    
    if (!client_id || !title || !total_amount) {
      return NextResponse.json({ success: false, error: 'client_id, title, and total_amount are required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO deals (client_id, prospect_id, offering_id, title, description, total_amount, currency, status, start_date, end_date, due_date, invoice_number, terms, notes, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [client_id, prospect_id||null, offering_id||null, title, description||null, total_amount,
       currency||'USD', status||'draft', start_date||null, end_date||null, due_date||null,
       invoice_number||null, terms||null, notes||null, tags||'{}', auth.userId]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'deal', result.rows[0].id, JSON.stringify({ title, total_amount })]);

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Deals] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create deal' }, { status: 500 });
  }
}
