/**
 * GET/POST /api/liabilities
 * Retrieve all liabilities or create a new liability
 */

import { NextResponse } from 'next/server.js';
import { verifyToken } from '@/lib/jwt.js';
import { validateLiability } from '@/lib/validation.js';
import { getLiabilities, createLiability } from '@/lib/financial.js';
import { logAudit, extractRequestMetadata } from '@/lib/audit.js';
import { query } from '@/lib/db.js';
import { canAccess } from '@/lib/permissions.js';
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

    // Get user to check permissions
    const userResult = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );
    const user = userResult.rows[0];

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check permission to read liabilities
    if (!canAccess(user, 'liabilities', 'read')) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get liabilities excluding soft-deleted records
    const result = await query(
      'SELECT * FROM liabilities WHERE deleted_at IS NULL ORDER BY created_at DESC'
    );

    return NextResponse.json({
      liabilities: result.rows,
      total: result.rows.length,
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

    // Get user to check permissions
    const userResult = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );
    const user = userResult.rows[0];

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check permission to create liabilities
    if (!canAccess(user, 'liabilities', 'create')) {
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
        { error: 'Forbidden - you do not have permission to create liabilities' },
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
