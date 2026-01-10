/**
 * GET/PUT/DELETE /api/liabilities/[id]
 * Retrieve, update, or delete a specific liability
 */

import { validateLiability } from '@/lib/validation.js';
import { getLiabilityById, updateLiability, deleteLiability } from '@/lib/financial.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const liability = await getLiabilityById(id);
    if (!liability) {
      return Response.json(
        { success: false, error: 'Liability not found' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: liability });
  } catch (error) {
    console.error('Get liability error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;

    // Check if liability exists
    const existingLiability = await getLiabilityById(id);
    if (!existingLiability) {
      return Response.json(
        { success: false, error: 'Liability not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = validateLiability(body);
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

    // Update liability
    const updated = await updateLiability(id, validation.data);

    if (!updated) {
      return Response.json(
        { success: false, error: 'Failed to update liability' },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        data: updated,
        message: 'Liability updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update liability error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Check if liability exists
    const liability = await getLiabilityById(id);
    if (!liability) {
      return Response.json(
        { success: false, error: 'Liability not found' },
        { status: 404 }
      );
    }

    // Delete liability
    const success = await deleteLiability(id);

    if (!success) {
      return Response.json(
        { success: false, error: 'Failed to delete liability' },
        { status: 500 }
      );
    }

    return Response.json(
      { success: true, message: 'Liability deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete liability error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
