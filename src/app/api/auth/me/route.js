/**
 * GET /api/auth/me
 * Get current user information from session with roles and permissions
 */

import { NextResponse } from 'next/server.js';
import { cookies } from 'next/headers.js';
import { getSession, getSessionFromCookies } from '@/lib/session.js';
import { logRouteAccess, extractRequestMetadata } from '@/lib/audit.js';
import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const requestMetadata = extractRequestMetadata(request);

    // Get session from cookies
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('jeton_session')?.value;

    if (!sessionId) {
      await logRouteAccess({
        action: 'ROUTE_DENIED',
        route: '/api/auth/me',
        reason: 'No session provided',
        requestMetadata,
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate session
    const session = await getSession(sessionId);

    if (!session) {
      await logRouteAccess({
        action: 'ROUTE_DENIED',
        route: '/api/auth/me',
        reason: 'Invalid or expired session',
        requestMetadata,
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch detailed user information
    const userResult = await query(
      `SELECT 
        u.id,
        u.email,
        u.role,
        u.status
      FROM users u
      WHERE u.id = $1`,
      [session.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // Log successful access
    await logRouteAccess({
      action: 'PROTECTED_ROUTE_ACCESS',
      route: '/api/auth/me',
      userId: session.userId,
      requestMetadata,
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          full_name: user.full_name,
          profile_photo_url: user.profile_photo_url,
          role: user.role,
          status: user.status,
          is_superadmin: user.is_superadmin,
          roles: user.roles || [],
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
