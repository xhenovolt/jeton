/**
 * GET/POST /api/prospects
 * Prospecting notebook API
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage');
    const q = searchParams.get('q');

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (stage) {
      where += ` AND sales_stage = $${idx}`;
      params.push(stage);
      idx += 1;
    }

    if (q) {
      where += ` AND (prospect_name ILIKE $${idx} OR business_name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`;
      params.push(`%${q}%`);
      idx += 1;
    }

    const result = await query(
      `
      SELECT *
      FROM prospects
      ${where}
      ORDER BY created_at DESC
      `,
      params
    );

    return Response.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Prospects GET error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      prospect_name,
      phone,
      email,
      business_name,
      address,
      industry,
      source,
      product_discussed,
      conversation_notes,
      objections,
      estimated_budget,
      follow_up_date,
      sales_stage = 'Prospect',
    } = body;

    if (!prospect_name) {
      return Response.json({ success: false, error: 'prospect_name is required' }, { status: 400 });
    }

    const userId = request.headers.get('x-user-id') || null;

    const result = await query(
      `
      INSERT INTO prospects (
        prospect_name, phone, email, business_name, address, industry, source,
        product_discussed, conversation_notes, objections, estimated_budget,
        follow_up_date, sales_stage, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
      `,
      [
        prospect_name,
        phone || null,
        email || null,
        business_name || null,
        address || null,
        industry || null,
        source || null,
        product_discussed || null,
        conversation_notes || null,
        objections || null,
        estimated_budget || 0,
        follow_up_date || null,
        sales_stage,
        userId,
      ]
    );

    return Response.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Prospects POST error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
