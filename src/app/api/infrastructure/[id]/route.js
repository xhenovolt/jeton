'use server';

import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  try {
    const result = await query('SELECT * FROM infrastructure WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return Response.json({ success: false, error: 'Infrastructure item not found' }, { status: 404 });
    }

    return Response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ success: false, error: 'Failed to fetch infrastructure' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const {
      name,
      infrastructure_type,
      description,
      risk_level,
      replacement_cost,
      recovery_procedures,
      owner,
    } = body;

    // Validate infrastructure type
    const validTypes = ['brand', 'website', 'domain', 'social_media', 'design_system', 'other'];
    if (infrastructure_type && !validTypes.includes(infrastructure_type)) {
      return Response.json({ success: false, error: 'Invalid infrastructure type' }, { status: 400 });
    }

    // Validate risk level
    const validRisks = ['critical', 'high', 'medium', 'low'];
    if (risk_level && !validRisks.includes(risk_level)) {
      return Response.json({ success: false, error: 'Invalid risk level' }, { status: 400 });
    }

    const updateResult = await query(
      `UPDATE infrastructure 
       SET name = COALESCE(NULLIF($1, ''), name),
           infrastructure_type = COALESCE(NULLIF($2, ''), infrastructure_type),
           description = COALESCE(NULLIF($3, ''), description),
           risk_level = COALESCE(NULLIF($4, ''), risk_level),
           replacement_cost = COALESCE($5, replacement_cost),
           owner_name = COALESCE(NULLIF($6, ''), owner_name),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        name || '',
        infrastructure_type || '',
        description || '',
        risk_level || '',
        replacement_cost,
        owner || '',
        id,
      ]
    );

    if (updateResult.rowCount === 0) {
      return Response.json({ success: false, error: 'Infrastructure item not found' }, { status: 404 });
    }

    return Response.json({ success: true, data: updateResult.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ success: false, error: 'Failed to update infrastructure' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  try {
    // Soft delete by setting status to archived
    const result = await query(
      `UPDATE infrastructure 
       SET status = 'archived', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return Response.json({ success: false, error: 'Infrastructure item not found' }, { status: 404 });
    }

    return Response.json({ success: true, message: 'Infrastructure archived', data: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ success: false, error: 'Failed to delete infrastructure' }, { status: 500 });
  }
}
