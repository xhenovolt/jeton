/**
 * GET/PUT/DELETE /api/assets/[id]
 * Retrieve, update, or delete a specific asset
 */

import { NextResponse } from 'next/server.js';
import { verifyToken } from '@/lib/jwt.js';
import { validateAsset } from '@/lib/validation.js';
import { getAssetById, updateAsset, deleteAsset } from '@/lib/financial.js';
import { logAudit, extractRequestMetadata } from '@/lib/audit.js';
import { cookies } from 'next/headers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
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

    const asset = await getAssetById(id);
    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('Get asset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
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

    // Only FOUNDER can update assets
    if (decoded.role !== 'FOUNDER') {
      await logAudit({
        action: 'ASSET_UPDATE_DENIED',
        entity: 'ASSET',
        entityId: id,
        actorId: decoded.userId,
        status: 'FAILURE',
        metadata: { reason: 'Insufficient permissions' },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return NextResponse.json(
        { error: 'Only founders can update assets' },
        { status: 403 }
      );
    }

    // Check if asset exists
    const existingAsset = await getAssetById(id);
    if (!existingAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = validateAsset(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          fields: validation.errors,
        },
        { status: 400 }
      );
    }

    // Update asset
    const updated = await updateAsset(id, validation.data);

    if (!updated) {
      await logAudit({
        action: 'ASSET_UPDATE',
        entity: 'ASSET',
        entityId: id,
        actorId: decoded.userId,
        status: 'FAILURE',
        metadata: { reason: 'Database error' },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return NextResponse.json(
        { error: 'Failed to update asset' },
        { status: 500 }
      );
    }

    // Log audit event
    await logAudit({
      action: 'ASSET_UPDATE',
      entity: 'ASSET',
      entityId: id,
      actorId: decoded.userId,
      status: 'SUCCESS',
      metadata: {
        name: updated.name,
        category: updated.category,
        value: updated.current_value,
      },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });

    return NextResponse.json(
      {
        message: 'Asset updated successfully',
        asset: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update asset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
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

    // Only FOUNDER can delete assets
    if (decoded.role !== 'FOUNDER') {
      await logAudit({
        action: 'ASSET_DELETE_DENIED',
        entity: 'ASSET',
        entityId: id,
        actorId: decoded.userId,
        status: 'FAILURE',
        metadata: { reason: 'Insufficient permissions' },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return NextResponse.json(
        { error: 'Only founders can delete assets' },
        { status: 403 }
      );
    }

    // Check if asset exists
    const asset = await getAssetById(id);
    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Delete asset
    const success = await deleteAsset(id);

    if (!success) {
      await logAudit({
        action: 'ASSET_DELETE',
        entity: 'ASSET',
        entityId: id,
        actorId: decoded.userId,
        status: 'FAILURE',
        metadata: { reason: 'Database error' },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return NextResponse.json(
        { error: 'Failed to delete asset' },
        { status: 500 }
      );
    }

    // Log audit event
    await logAudit({
      action: 'ASSET_DELETE',
      entity: 'ASSET',
      entityId: id,
      actorId: decoded.userId,
      status: 'SUCCESS',
      metadata: {
        name: asset.name,
        category: asset.category,
        value: asset.current_value,
      },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });

    return NextResponse.json(
      { message: 'Asset deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete asset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
