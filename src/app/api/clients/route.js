import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/clients
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let sql = `SELECT c.*, 
      (SELECT COUNT(*) FROM deals d WHERE d.client_id = c.id) as deal_count,
      (SELECT COALESCE(SUM(d.total_amount),0) FROM deals d WHERE d.client_id = c.id) as total_deal_value
      FROM clients c WHERE 1=1`;
    const params = [];

    if (status) { params.push(status); sql += ` AND c.status = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (c.company_name ILIKE $${params.length} OR c.contact_name ILIKE $${params.length} OR c.email ILIKE $${params.length})`;
    }
    sql += ` ORDER BY c.created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Clients] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch clients' }, { status: 500 });
  }
}

// POST /api/clients - Create client directly (without prospect conversion)
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { company_name, contact_name, email, phone, website, industry, billing_address, tax_id, payment_terms, preferred_currency, notes, tags } = body;
    if (!company_name) return NextResponse.json({ success: false, error: 'company_name is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO clients (company_name, contact_name, email, phone, website, industry, billing_address, tax_id, payment_terms, preferred_currency, notes, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [company_name, contact_name||null, email||null, phone||null, website||null, industry||null,
       billing_address||null, tax_id||null, payment_terms||30, preferred_currency||'UGX', notes||null, tags||'{}', auth.userId]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'client', result.rows[0].id, JSON.stringify({ company_name })]);

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Clients] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create client' }, { status: 500 });
  }
}
