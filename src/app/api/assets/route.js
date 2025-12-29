/**
 * GET/POST /api/assets
 * Retrieve all assets or create a new asset
 */

import { NextResponse } from 'next/server.js';
import { verifyToken, getTokenFromCookies } from '@/lib/jwt.js';
import { validateAsset } from '@/lib/validation.js';
import { getAssets, createAsset } from '@/lib/financial.js';
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

    const assets = await getAssets();

    return NextResponse.json({
      assets,
      total: assets.length,
    });
  } catch (error) {
    console.error('Get assets error:', error);
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

    // Only FOUNDER can create assets
    if (decoded.role !== 'FOUNDER') {
      await logAudit({
        action: 'ASSET_CREATE_DENIED',
        entity: 'ASSET',
        actorId: decoded.userId,
        status: 'FAILURE',
        metadata: { reason: 'Insufficient permissions' },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return NextResponse.json(
        { error: 'Only founders can create assets' },
        { status: 403 }
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

    // Create asset
    const asset = await createAsset(validation.data, decoded.userId);

    if (!asset) {
      await logAudit({
        action: 'ASSET_CREATE',
        entity: 'ASSET',
        actorId: decoded.userId,
        status: 'FAILURE',
        metadata: { reason: 'Database error' },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return NextResponse.json(
        { error: 'Failed to create asset' },
        { status: 500 }
      );
    }

    // Log audit event
    await logAudit({
      action: 'ASSET_CREATE',
      entity: 'ASSET',
      entityId: asset.id,
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
      {
        message: 'Asset created successfully',
        asset,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create asset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
