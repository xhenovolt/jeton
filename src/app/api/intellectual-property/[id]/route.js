'use server';

import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  try {
    const result = await query('SELECT * FROM intellectual_property WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return Response.json({ success: false, error: 'IP asset not found' }, { status: 404 });
    }

    return Response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ success: false, error: 'Failed to fetch IP asset' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { name, ip_type, description, valuation_estimate, monetization_model, status, revenue_generated_monthly, clients_count } = body;

    // Validate IP type if provided
    const validTypes = ['software', 'internal_system', 'licensed_ip', 'brand'];
    if (ip_type && !validTypes.includes(ip_type)) {
      return Response.json({ success: false, error: 'Invalid IP type' }, { status: 400 });
    }

    // Check name uniqueness (excluding current item)
    if (name) {
      const nameCheck = await query('SELECT id FROM intellectual_property WHERE name = $1 AND id != $2', [name, id]);
      if (nameCheck.rowCount > 0) {
        return Response.json({ success: false, error: 'IP name already exists' }, { status: 409 });
      }
    }

    const updateResult = await query(
      `UPDATE intellectual_property 
       SET name = COALESCE(NULLIF($1, ''), name),
           ip_type = COALESCE(NULLIF($2, ''), ip_type),
           description = COALESCE(NULLIF($3, ''), description),
           valuation_estimate = COALESCE($4, valuation_estimate),
           monetization_model = COALESCE(NULLIF($5, ''), monetization_model),
           status = COALESCE(NULLIF($6, ''), status),
           revenue_generated_monthly = COALESCE($7, revenue_generated_monthly),
           clients_count = COALESCE($8, clients_count),
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [name || '', ip_type || '', description || '', valuation_estimate, monetization_model || '', status || '', revenue_generated_monthly, clients_count, id]
    );

    if (updateResult.rowCount === 0) {
      return Response.json({ success: false, error: 'IP asset not found' }, { status: 404 });
    }

    return Response.json({ success: true, data: updateResult.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ success: false, error: 'Failed to update IP asset' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  try {
    // Soft delete by setting sunset_date and status to deprecated
    const result = await query(
      `UPDATE intellectual_property 
       SET sunset_date = CURRENT_DATE, status = 'deprecated', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return Response.json({ success: false, error: 'IP asset not found' }, { status: 404 });
    }

    return Response.json({ success: true, message: 'IP asset archived', data: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ success: false, error: 'Failed to delete IP asset' }, { status: 500 });
  }
}
