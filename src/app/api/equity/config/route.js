/**
 * GET/PUT /api/equity/config
 * Get or update share configuration (authorized/issued)
 */

import { query } from '@/lib/db.js';
import {
  getShareConfiguration,
  updateShareConfiguration,
} from '@/lib/equity.js';

export async function GET(request) {
  try {
    const config = await getShareConfiguration();

    return Response.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Share config GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { authorized_shares, issued_shares, par_value, class_type, reason } = body;

    // Validate inputs
    if (
      !authorized_shares &&
      !issued_shares &&
      !par_value &&
      !class_type
    ) {
      return Response.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    const updated = await updateShareConfiguration(
      {
        authorized_shares,
        issued_shares,
        par_value,
        class_type,
      },
      reason
    );

    return Response.json({
      success: true,
      message: 'Share configuration updated',
      data: updated,
    });
  } catch (error) {
    console.error('Share config PUT error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
