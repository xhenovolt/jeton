/**
 * GET/PUT/DELETE /api/liabilities/[id]
 * Retrieve, update, or delete a specific liability
 */

import { NextResponse } from 'next/server.js';
import { requireApiAuth } from '@/lib/api-auth.js';
import { validateLiability } from '@/lib/validation.js';
import { getLiabilityById, updateLiability, deleteLiability } from '@/lib/financial.js';
import { logAudit, extractRequestMetadata } from '@/lib/audit.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    ,
        { status: 401 }
      );
    }

    const user = await requireApiAuth();

    const liability = await getLiabilityById(params.id);
    if (!liability) {
      return NextResponse.json(
        { error: 'Liability not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ liability });
  } catch (error) {
    console.error('Get liability error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    ,
        { status: 401 }
      );
    }

    const user = await requireApiAuth();

    // Only FOUNDER can update liabilities
    if (user.role !== 'FOUNDER') {
      await logAudit({
        action: 'LIABILITY_UPDATE_DENIED',
        entity: 'LIABILITY',
        entityId: id,
        actorId: user.userId,
        status: 'FAILURE',
        metadata: { reason: 'Insufficient permissions' },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return NextResponse.json(
        { error: 'Only founders can update liabilities' },
        { status: 403 }
      );
    }

    // Check if liability exists
    const existingLiability = await getLiabilityById(id);
    if (!existingLiability) {
      return NextResponse.json(
        { error: 'Liability not found' },
        { status: 404 }
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

    // Update liability
    const updated = await updateLiability(id, validation.data);

    if (!updated) {
      await logAudit({
        action: 'LIABILITY_UPDATE',
        entity: 'LIABILITY',
        entityId: id,
        actorId: user.userId,
        status: 'FAILURE',
        metadata: { reason: 'Database error' },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return NextResponse.json(
        { error: 'Failed to update liability' },
        { status: 500 }
      );
    }

    // Log audit event
    await logAudit({
      action: 'LIABILITY_UPDATE',
      entity: 'LIABILITY',
      entityId: id,
      actorId: user.userId,
      status: 'SUCCESS',
      metadata: {
        name: updated.name,
        category: updated.category,
        amount: updated.outstanding_amount,
        status: updated.status,
      },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });

    return NextResponse.json(
      {
        message: 'Liability updated successfully',
        liability: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update liability error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    ,
        { status: 401 }
      );
    }

    const user = await requireApiAuth();

    // Only FOUNDER can delete liabilities
    if (user.role !== 'FOUNDER') {
      await logAudit({
        action: 'LIABILITY_DELETE_DENIED',
        entity: 'LIABILITY',
        entityId: id,
        actorId: user.userId,
        status: 'FAILURE',
        metadata: { reason: 'Insufficient permissions' },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return NextResponse.json(
        { error: 'Only founders can delete liabilities' },
        { status: 403 }
      );
    }

    // Check if liability exists
    const liability = await getLiabilityById(id);
    if (!liability) {
      return NextResponse.json(
        { error: 'Liability not found' },
        { status: 404 }
      );
    }

    // Delete liability
    const success = await deleteLiability(id);

    if (!success) {
      await logAudit({
        action: 'LIABILITY_DELETE',
        entity: 'LIABILITY',
        entityId: id,
        actorId: user.userId,
        status: 'FAILURE',
        metadata: { reason: 'Database error' },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return NextResponse.json(
        { error: 'Failed to delete liability' },
        { status: 500 }
      );
    }

    // Log audit event
    await logAudit({
      action: 'LIABILITY_DELETE',
      entity: 'LIABILITY',
      entityId: id,
      actorId: user.userId,
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
      { message: 'Liability deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete liability error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
