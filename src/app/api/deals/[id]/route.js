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

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const deal = await getDealById(id);
    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(deal);
  } catch (error) {
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

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is FOUNDER
    if (decoded.role !== 'FOUNDER') {
      await logAudit({
        action: 'DEAL_UPDATE_DENIED',
        entity: 'deal',
        entityId: id,
        actorId: decoded.userId,
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
      actorId: decoded.userId,
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

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is FOUNDER
    if (decoded.role !== 'FOUNDER') {
      await logAudit({
        action: 'DEAL_DELETE_DENIED',
        entity: 'deal',
        entityId: id,
        actorId: decoded.userId,
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
        actorId: decoded.userId,
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
    console.error('Error in DELETE /api/deals/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
