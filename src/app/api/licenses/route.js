import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { logEvent } from '@/lib/events.js';

// GET /api/licenses
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const system_id = searchParams.get('system_id');
    const status = searchParams.get('status');
    const client_id = searchParams.get('client_id');

    let sql = `
      SELECT l.*,
        s.name as system_name,
        c.company_name as client_company,
        d.total_amount as deal_value,
        d.currency as deal_currency,
        p.name as plan_name,
        p.installation_fee,
        p.monthly_fee
      FROM licenses l
      LEFT JOIN systems s ON l.system_id = s.id
      LEFT JOIN clients c ON l.client_id = c.id
      LEFT JOIN deals d ON l.deal_id = d.id
      LEFT JOIN system_pricing_plans p ON l.plan_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (system_id) { params.push(system_id); sql += ` AND l.system_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND l.status = $${params.length}`; }
    if (client_id) { params.push(client_id); sql += ` AND l.client_id = $${params.length}`; }
    sql += ` ORDER BY l.created_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, licenses: result.rows });
  } catch (error) {
    console.error('[Licenses] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch licenses' }, { status: 500 });
  }
}

// POST /api/licenses
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const {
      system_id, deal_id, client_id, client_name, plan_id,
      license_type, issued_date, issue_date, is_historical,
      start_date, end_date, expiry_date, status, notes,
      skip_backdated_warning,
    } = body;

    const effectiveClientName = client_name || 'Unknown';
    const effectiveIssueDate = issue_date || issued_date || null;

    // Check for backdated license warning
    if (effectiveIssueDate && !skip_backdated_warning) {
      const issueMs = new Date(effectiveIssueDate).getTime();
      const todayMs = Date.now();
      if (issueMs < todayMs - 86400000) { // more than 1 day in the past
        return NextResponse.json({
          success: false,
          error: 'backdated_license',
          message: 'You are creating a license in the past. Set skip_backdated_warning: true to proceed.',
          issue_date: effectiveIssueDate,
        }, { status: 409 });
      }
    }

    const result = await query(
      `INSERT INTO licenses (
        system_id, deal_id, client_id, client_name, plan_id,
        license_type, issued_date, is_historical, start_date, end_date, status, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        system_id || null, deal_id || null, client_id || null,
        effectiveClientName, plan_id || null,
        license_type || 'lifetime',
        effectiveIssueDate, is_historical || false,
        start_date || effectiveIssueDate || null,
        end_date || expiry_date || null,
        status || 'active', notes || null,
      ]
    );

    try {
      await logEvent({
        event_type: 'license_issued',
        entity_type: 'license',
        entity_id: result.rows[0].id,
        description: `License issued to ${effectiveClientName}`,
        metadata: { system_id, license_type: license_type || 'lifetime', is_historical },
        created_by: auth.userId,
      });
    } catch { /* logEvent may not exist */ }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'license', result.rows[0].id,
       JSON.stringify({ client_name: effectiveClientName, system_id, license_type, is_historical })]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Licenses] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create license: ' + error.message }, { status: 500 });
  }
}

// PATCH /api/licenses — update status, notes, or expiry
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id, status, notes, end_date, expiry_date } = body;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const result = await query(
      `UPDATE licenses SET
        status = COALESCE($1, status),
        notes = COALESCE($2, notes),
        end_date = COALESCE($3, end_date)
       WHERE id = $4 RETURNING *`,
      [status || null, notes || null, end_date || expiry_date || null, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'License not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[Licenses] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update license' }, { status: 500 });
  }
}
