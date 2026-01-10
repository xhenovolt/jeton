/**
 * Deal Details API Route
 * GET - Get single deal
 * PUT - Update deal
 * DELETE - Delete deal
 */

import { validateDeal } from '@/lib/validation.js';
import { getDealById, updateDeal, deleteDeal } from '@/lib/deals.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const deal = await getDealById(id);
    if (!deal) {
      return Response.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: deal });
  } catch (error) {
    console.error('Error in GET /api/deals/[id]:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;

    // Check if deal exists
    const existingDeal = await getDealById(id);
    if (!existingDeal) {
      return Response.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      );
    }

    const data = await request.json();

    // Validate input
    const validation = validateDeal(data);
    if (!validation.success) {
      return Response.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const updatedDeal = await updateDeal(id, validation.data);

    return Response.json({
      success: true,
      data: updatedDeal,
      message: 'Deal updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/deals/[id]:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Check if deal exists
    const deal = await getDealById(id);
    if (!deal) {
      return Response.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      );
    }

    const success = await deleteDeal(id);

    if (success) {
      return Response.json({
        success: true,
        message: 'Deal deleted successfully',
      });
    } else {
      return Response.json(
        { success: false, error: 'Failed to delete deal' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in DELETE /api/deals/[id]:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
