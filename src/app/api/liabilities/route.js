/**
 * GET/POST /api/liabilities
 * Retrieve all liabilities or create a new liability
 */

import { NextResponse } from 'next/server.js';
import { verifyToken } from '@/lib/jwt.js';
import { validateLiability } from '@/lib/validation.js';
import { getLiabilities, createLiability } from '@/lib/financial.js';
import { logAudit, extractRequestMetadata } from '@/lib/audit.js';
import { cookies } from 'next/headers.js';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const liabilities = await getLiabilities();

    return NextResponse.json({
      liabilities,
      total: liabilities.length,
    });
  } catch (error) {
    console.error('Get liabilities error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    const requestMetadata = extractRequestMetadata(request);

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only FOUNDER can create liabilities
    if (decoded.role !== 'FOUNDER') {
      await logAudit({
        action: 'LIABILITY_CREATE_DENIED',
        entity: 'LIABILITY',
        actorId: decoded.userId,
        status: 'FAILURE',
        metadata: { reason: 'Insufficient permissions' },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return NextResponse.json(
        { error: 'Only founders can create liabilities' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = validateLiability(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          fields: validation.errors,
        },
        { status: 400 }
      );
    }

    // Create liability
    const liability = await createLiability(validation.data, decoded.userId);

    if (!liability) {
      await logAudit({
        action: 'LIABILITY_CREATE',
        entity: 'LIABILITY',
        actorId: decoded.userId,
        status: 'FAILURE',
        metadata: { reason: 'Database error' },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return NextResponse.json(
        { error: 'Failed to create liability' },
        { status: 500 }
      );
    }

    // Log audit event
    await logAudit({
      action: 'LIABILITY_CREATE',
      entity: 'LIABILITY',
      entityId: liability.id,
      actorId: decoded.userId,
      status: 'SUCCESS',
      metadata: {
        name: liability.name,
        category: liability.category,
        amount: liability.outstanding_amount,
        status: liability.status,
      },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });

    return NextResponse.json(
      {
        message: 'Liability created successfully',
        liability,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create liability error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
