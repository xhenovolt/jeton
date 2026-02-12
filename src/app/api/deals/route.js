/**
 * Deals API Route
 * GET - List all deals
 * POST - Create new deal
 */

import { validateDeal } from '@/lib/validation.js';
import { getDeals, createDeal } from '@/lib/deals.js';
import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    // Get deals excluding soft-deleted records
    const result = await query(
      'SELECT * FROM deals WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );

    return Response.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error in GET /api/deals:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const data = await request.json();

    // Validate input
    const validation = validateDeal(data);
    if (!validation.success) {
      return Response.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Get userId from headers or session (optional for now since created_by is nullable)
    const userId = request.headers.get('x-user-id') || null;

    const deal = await createDeal(validation.data, userId);

    return Response.json(
      {
        success: true,
        data: deal,
        message: 'Deal created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/deals:', error);
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
