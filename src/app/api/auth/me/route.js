/**
 * GET /api/auth/me
 * Get current user information from session
 */

import { NextResponse } from 'next/server.js';
import { cookies } from 'next/headers.js';
import { getSession, getSessionFromCookies } from '@/lib/session.js';
import { logRouteAccess, extractRequestMetadata } from '@/lib/audit.js';

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
          id: session.userId,
          email: session.user.email,
          role: session.user.role,
          status: session.user.status,
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
