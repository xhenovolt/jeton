/**
 * Deal Details API Route
 * GET - Get single deal
 * PUT - Update deal
 * DELETE - Delete deal
 */

import { NextResponse } from 'next/server.js';
import { requireApiAuth } from '@/lib/api-auth.js';
import { validateDeal } from '@/lib/validation.js';
import { getDealById, updateDeal, deleteDeal } from '@/lib/deals.js';
import { logAudit } from '@/lib/audit.js';
import { query } from '@/lib/db.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Get user from session
    const user = await requireApiAuth();

    const deal = await getDealById(id);
    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(deal);
  } catch (error) {
    if (error instanceof NextResponse) throw error;
    console.error('Error in GET /api/deals/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;

    // Get user from session
    const user = await requireApiAuth();

    // Get user record to check role
    const userResult = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [user.userId]
    );
    const userRecord = userResult.rows[0];

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is FOUNDER
    if (userRecord.role !== 'FOUNDER') {
      await logAudit({
        action: 'DEAL_UPDATE_DENIED',
        entity: 'deal',
        entityId: id,
        actorId: user.userId,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        status: 'FAILURE',
      });
      return NextResponse.json(
        { error: 'Only founders can update deals' },
        { status: 403 }
      );
    }

    // Check if deal exists
    const existingDeal = await getDealById(id);
    if (!existingDeal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
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

    const updatedDeal = await updateDeal(id, validation.data);

    // Log successful update
    await logAudit({
      action: 'DEAL_UPDATE',
      entity: 'deal',
      entityId: id,
      actorId: user.userId,
      metadata: {
        title: updatedDeal.title,
        value_estimate: updatedDeal.value_estimate,
        stage: updatedDeal.stage,
        probability: updatedDeal.probability,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent'),
      status: 'SUCCESS',
    });

    return NextResponse.json(updatedDeal);
  } catch (error) {
    if (error instanceof NextResponse) throw error;
    console.error('Error in PUT /api/deals/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Get user from session
    const user = await requireApiAuth();

    // Get user record to check role
    const userResult = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [user.userId]
    );
    const userRecord = userResult.rows[0];

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is FOUNDER
    if (userRecord.role !== 'FOUNDER') {
      await logAudit({
        action: 'DEAL_DELETE_DENIED',
        entity: 'deal',
        entityId: id,
        actorId: user.userId,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        status: 'FAILURE',
      });
      return NextResponse.json(
        { error: 'Only founders can delete deals' },
        { status: 403 }
      );
    }

    // Check if deal exists
    const deal = await getDealById(id);
    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    const success = await deleteDeal(id);

    if (success) {
      // Log successful deletion
      await logAudit({
        action: 'DEAL_DELETE',
        entity: 'deal',
        entityId: id,
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

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to delete deal' },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof NextResponse) throw error;
    console.error('Error in DELETE /api/deals/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
