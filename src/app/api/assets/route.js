/**
 * GET/POST /api/assets
 * Retrieve all assets or create a new asset
 */

import { validateAsset } from '@/lib/validation.js';
import { getAssets, createAsset } from '@/lib/financial.js';
import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    // Get assets excluding soft-deleted records
    const result = await query(
      'SELECT * FROM assets WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );

    return Response.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Get assets error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateAsset(body);
    if (!validation.success) {
      return Response.json(
        {
          success: false,
          error: 'Validation failed',
          fields: validation.errors,
        },
        { status: 400 }
      );
    }

    // Get userId from headers or session (optional for now since created_by is nullable)
    const userId = request.headers.get('x-user-id') || null;

    // Create asset
    const asset = await createAsset(validation.data, userId);

    if (!asset) {
      return Response.json(
        { success: false, error: 'Failed to create asset' },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        data: asset,
        message: 'Asset created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create asset error:', error);
    return Response.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error.message,
        details: error.detail || error.hint
      },
      { status: 500 }
    );
  }
}
