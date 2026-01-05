/**
 * Deals API Route
 * GET - List all deals
 * POST - Create new deal
 */

import { NextResponse } from 'next/server.js';
import { requireApiAuth } from '@/lib/api-auth.js';
import { validateDeal } from '@/lib/validation.js';
import { getDeals, createDeal } from '@/lib/deals.js';
import { logAudit } from '@/lib/audit.js';
import { query } from '@/lib/db.js';
import { canAccess } from '@/lib/permissions.js';

export async function GET(request) {
  try {
    // Validate session and get user
    const user = await requireApiAuth();

    // Get user to check permissions
    const userResult = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [user.userId]
    );
    const userRow = userResult.rows[0];

    if (!userRow) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check permission to read deals
    if (!canAccess(userRow, 'deals', 'read')) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get deals excluding soft-deleted records
    const result = await query(
      'SELECT * FROM deals WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );

    return NextResponse.json({
      deals: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    // If error is a Response (from requireApiAuth), return it
    if (error instanceof Response) {
      return error;
    }
    console.error('Error in GET /api/deals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    // Validate session and get user
    const user = await requireApiAuth();

    // Get user to check permissions
    const userResult = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [user.userId]
    );
    const userRow = userResult.rows[0];

    if (!userRow) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user can create deals
    if (!canAccess(userRow, 'deals', 'create')) {
      await logAudit({
        action: 'DEAL_CREATE_DENIED',
        entity: 'deal',
        actorId: user.userId,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        status: 'FAILURE',
      });
      return NextResponse.json(
        { error: 'Forbidden - you do not have permission to create deals' },
        { status: 403 }
      );
    }

    const data = await request.json();

    // Validate input
    const validation = validateDeal(data);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const deal = await createDeal(validation.data, user.userId);

    // Log successful creation
    await logAudit({
      action: 'DEAL_CREATE',
      entity: 'deal',
      entityId: deal.id,
      actorId: user.userId,
      metadata: {
        title: deal.title,
        value_estimate: deal.value_estimate,
        stage: deal.stage,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent'),
      status: 'SUCCESS',
    });

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    // If error is a Response (from requireApiAuth), return it
    if (error instanceof Response) {
      return error;
    }
    console.error('Error in POST /api/deals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
