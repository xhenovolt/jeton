'use server';

import { query } from '@/lib/db';

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  try {
    const result = await query('SELECT * FROM assets_accounting WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return Response.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    return Response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ success: false, error: 'Failed to fetch asset' }, { status: 500 });
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
      asset_name,
      asset_type,
      purchase_price,
      depreciation_method,
      useful_life_years,
      location,
      description,
      serial_number,
    } = body;

    // Validate asset type
    const validTypes = ['laptop', 'phone', 'equipment', 'furniture', 'other'];
    if (asset_type && !validTypes.includes(asset_type)) {
      return Response.json({ success: false, error: 'Invalid asset type' }, { status: 400 });
    }

    const updateResult = await query(
      `UPDATE assets_accounting 
       SET asset_name = COALESCE($1, asset_name),
           asset_type = COALESCE($2, asset_type),
           purchase_price = COALESCE($3, purchase_price),
           depreciation_method = COALESCE($4, depreciation_method),
           useful_life_years = COALESCE($5, useful_life_years),
           location = COALESCE($6, location),
           description = COALESCE($7, description),
           serial_number = COALESCE($8, serial_number),
           updated_at = NOW()
       WHERE id = $9 AND deleted_at IS NULL
       RETURNING *`,
      [
        asset_name,
        asset_type,
        purchase_price,
        depreciation_method,
        useful_life_years,
        location,
        description,
        serial_number,
        id,
      ]
    );

    if (updateResult.rowCount === 0) {
      return Response.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    return Response.json({ success: true, data: updateResult.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ success: false, error: 'Failed to update asset' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  try {
    // Soft delete by setting disposal_date and status
    const result = await query(
      `UPDATE assets_accounting 
       SET disposal_date = CURRENT_DATE, status = 'disposed', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return Response.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    return Response.json({ success: true, message: 'Asset disposed', data: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ success: false, error: 'Failed to delete asset' }, { status: 500 });
  }
}
