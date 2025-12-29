/**
 * GET /api/auth/me
 * Get current user information
 */

import { NextResponse } from 'next/server.js';
import { verifyToken, getTokenFromCookies } from '@/lib/jwt.js';
import { findUserById } from '@/lib/auth.js';
import { logRouteAccess, extractRequestMetadata } from '@/lib/audit.js';
import { cookies } from 'next/headers.js';

export async function GET(request) {
  try {
    const requestMetadata = extractRequestMetadata(request);

    // Get token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      await logRouteAccess({
        action: 'ROUTE_DENIED',
        route: '/api/auth/me',
        reason: 'No token provided',
        requestMetadata,
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      await logRouteAccess({
        action: 'ROUTE_DENIED',
        route: '/api/auth/me',
        reason: 'Invalid or expired token',
        requestMetadata,
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await findUserById(decoded.userId);

    if (!user || !user.is_active) {
      await logRouteAccess({
        action: 'ROUTE_DENIED',
        route: '/api/auth/me',
        userId: decoded.userId,
        reason: 'User not found or inactive',
        requestMetadata,
      });

      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Log successful access
    await logRouteAccess({
      action: 'PROTECTED_ROUTE_ACCESS',
      route: '/api/auth/me',
      userId: user.id,
      requestMetadata,
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
          createdAt: user.created_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
