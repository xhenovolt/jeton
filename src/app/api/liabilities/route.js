/**
 * GET/POST /api/liabilities
 * Retrieve all liabilities or create a new liability
 */

import { validateLiability } from '@/lib/validation.js';
import { getLiabilities, createLiability } from '@/lib/financial.js';
import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    // Get liabilities excluding soft-deleted records
    const result = await query(
      'SELECT * FROM liabilities WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );

    return Response.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Get liabilities error:', error);
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

    // Create liability (without user tracking)
    const liability = await createLiability(validation.data, null);

    if (!liability) {
      return Response.json(
        { success: false, error: 'Failed to create liability' },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        data: liability,
        message: 'Liability created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create liability error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
