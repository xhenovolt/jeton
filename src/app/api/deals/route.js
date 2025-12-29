/**
 * Deals API Route
 * GET - List all deals
 * POST - Create new deal
 */

import { NextResponse } from 'next/server.js';
import { verifyToken } from '@/lib/jwt.js';
import { validateDeal } from '@/lib/validation.js';
import { getDeals, createDeal } from '@/lib/deals.js';
import { logAudit } from '@/lib/audit.js';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      await logAudit({
        action: 'TOKEN_VALIDATION_FAILURE',
        entity: 'deal',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        status: 'FAILURE',
      });
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const deals = await getDeals();

    return NextResponse.json({
      deals,
      count: deals.length,
    });
  } catch (error) {
    console.error('Error in GET /api/deals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      await logAudit({
        action: 'TOKEN_VALIDATION_FAILURE',
        entity: 'deal',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        status: 'FAILURE',
      });
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is FOUNDER
    if (decoded.role !== 'FOUNDER') {
      await logAudit({
        action: 'DEAL_CREATE_DENIED',
        entity: 'deal',
        actorId: decoded.userId,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        status: 'FAILURE',
      });
      return NextResponse.json(
        { error: 'Only founders can create deals' },
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

    const deal = await createDeal(validation.data, decoded.userId);

    // Log successful creation
    await logAudit({
      action: 'DEAL_CREATE',
      entity: 'deal',
      entityId: deal.id,
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

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/deals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
