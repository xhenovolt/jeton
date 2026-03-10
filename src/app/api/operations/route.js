import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

const VALID_CATEGORIES = [
  'transport', 'prospecting', 'internet_data', 'marketing',
  'equipment', 'office', 'utilities', 'communication', 'other',
];

// GET /api/operations
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const expense_type = searchParams.get('expense_type');
    const limit = parseInt(searchParams.get('limit') || '50');

    let sql = `
      SELECT o.*,
        a.name as account_name,
        u.name as created_by_name,
        s.name as system_name
      FROM operations o
      LEFT JOIN accounts a ON o.account_id = a.id
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN systems s ON o.related_system_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (category) { params.push(category); sql += ` AND o.category = $${params.length}`; }
    if (expense_type) { params.push(expense_type); sql += ` AND o.expense_type = $${params.length}`; }
    params.push(limit);
    sql += ` ORDER BY o.created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Operations] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch operations' }, { status: 500 });
  }
}

// POST /api/operations
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const {
      title, description, category, expense_type, amount, currency,
      account_id, operation_date, vendor, receipt_url, notes,
      operation_type, related_system_id, related_deal_id,
    } = body;

    const effectiveTitle = title || description || operation_type;
    const effectiveCategory = category || (VALID_CATEGORIES.includes(operation_type) ? operation_type : 'other');

    if (!effectiveTitle) {
      return NextResponse.json({ success: false, error: 'title or description is required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO operations (
        title, description, category, expense_type, amount, currency,
        account_id, operation_date, vendor, receipt_url, notes,
        related_system_id, related_deal_id, operation_type, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        effectiveTitle, description || null, effectiveCategory,
        expense_type || 'operational',
        amount ? parseFloat(amount) : null,
        currency || 'UGX', account_id || null,
        operation_date || null, vendor || null,
        receipt_url || null, notes || null,
        related_system_id || null, related_deal_id || null,
        operation_type || effectiveCategory, auth.userId,
      ]
    );

    if (amount && account_id) {
      try {
        const ledgerResult = await query(
          `INSERT INTO ledger (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
           VALUES ($1,$2,$3,'expense',$4,$5,'operations',COALESCE($6,CURRENT_DATE),$7) RETURNING id`,
          [account_id, -Math.abs(parseFloat(amount)), currency || 'UGX',
           result.rows[0].id, effectiveTitle, operation_date, auth.userId]
        );
        await query(
          `UPDATE operations SET ledger_entry_id=$1 WHERE id=$2`,
          [ledgerResult.rows[0].id, result.rows[0].id]
        );
      } catch (ledgerErr) {
        console.error('[Operations] Ledger entry failed:', ledgerErr.message);
      }
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'operation', result.rows[0].id,
       JSON.stringify({ title: effectiveTitle, category: effectiveCategory, amount })]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Operations] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create operation: ' + error.message }, { status: 500 });
  }
}
