import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/assets
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const asset_type = searchParams.get('type');
    const historical = searchParams.get('historical');

    let sql = `
      SELECT a.*, u.name as created_by_name, acc.name as deducted_from_account
      FROM assets a
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN accounts acc ON a.account_deducted_from = acc.id
      WHERE 1=1
    `;
    const params = [];
    if (asset_type) { params.push(asset_type); sql += ` AND a.asset_type = $${params.length}`; }
    if (historical === 'true') sql += ` AND a.is_historical = true`;
    sql += ` ORDER BY a.created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Assets] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch assets' }, { status: 500 });
  }
}

// POST /api/assets
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const {
      name, asset_type, description, cost, currency, current_value,
      acquisition_date, is_historical, account_deducted_from,
      condition, location, serial_number, notes,
      // Legacy field
      value,
    } = body;

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });

    const effectiveCost = cost || value || null;
    const effectiveCurrency = currency || 'UGX';

    const result = await query(
      `INSERT INTO assets (
        name, asset_type, description, cost, value, currency, current_value,
        acquisition_date, is_historical, account_deducted_from,
        condition, location, serial_number, notes, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        name, asset_type || 'equipment', description || null,
        effectiveCost ? parseFloat(effectiveCost) : null,
        effectiveCost ? parseFloat(effectiveCost) : null, // legacy value col
        effectiveCurrency,
        current_value ? parseFloat(current_value) : (effectiveCost ? parseFloat(effectiveCost) : null),
        acquisition_date || null,
        is_historical || false,
        account_deducted_from || null,
        condition || 'good',
        location || null,
        serial_number || null,
        notes || null,
        auth.userId,
      ]
    );

    // If acquiring a historical asset — create ledger deduction if account provided
    if (effectiveCost && account_deducted_from) {
      try {
        const ledgerResult = await query(
          `INSERT INTO ledger (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
           VALUES ($1,$2,$3,'expense',$4,$5,'asset_acquisition',COALESCE($6, CURRENT_DATE),$7) RETURNING id`,
          [account_deducted_from, -Math.abs(parseFloat(effectiveCost)), effectiveCurrency,
           result.rows[0].id, `Asset acquisition: ${name}`, acquisition_date, auth.userId]
        );
        await query(
          `UPDATE assets SET ledger_entry_id=$1 WHERE id=$2`,
          [ledgerResult.rows[0].id, result.rows[0].id]
        );
      } catch (ledgerErr) {
        console.error('[Assets] Ledger entry failed:', ledgerErr.message);
      }
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'asset', result.rows[0].id,
       JSON.stringify({ name, asset_type, cost: effectiveCost, is_historical })]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Assets] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create asset: ' + error.message }, { status: 500 });
  }
}

// DELETE /api/assets?id=xxx
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    await query(`DELETE FROM assets WHERE id=$1`, [id]);
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'DELETE', 'asset', id, '{}']
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Assets] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete asset' }, { status: 500 });
  }
}
