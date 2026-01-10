/**
 * GET/PUT/DELETE /api/assets/[id]
 * Retrieve, update, or delete a specific asset
 */

import { validateAsset } from '@/lib/validation.js';
import { getAssetById, updateAsset, deleteAsset } from '@/lib/financial.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const asset = await getAssetById(id);
    if (!asset) {
      return Response.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: asset });
  } catch (error) {
    console.error('Get asset error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;

    // Check if asset exists
    const existingAsset = await getAssetById(id);
    if (!existingAsset) {
      return Response.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

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

    // Update asset
    const updated = await updateAsset(id, validation.data);

    if (!updated) {
      return Response.json(
        { success: false, error: 'Failed to update asset' },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        data: updated,
        message: 'Asset updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update asset error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Check if asset exists
    const asset = await getAssetById(id);
    if (!asset) {
      return Response.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Delete asset
    const success = await deleteAsset(id);

    if (!success) {
      return Response.json(
        { success: false, error: 'Failed to delete asset' },
        { status: 500 }
      );
    }

    return Response.json(
      { success: true, message: 'Asset deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete asset error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
