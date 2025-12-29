/**
 * POST /api/auth/logout
 * Clear user session
 */

import { NextResponse } from 'next/server.js';
import { logAuthEvent, extractRequestMetadata } from '@/lib/audit.js';
import { verifyToken } from '@/lib/jwt.js';
import { cookies } from 'next/headers.js';

export async function POST(request) {
  try {
    const requestMetadata = extractRequestMetadata(request);

    // Get token to log the correct user
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    let userId = null;

    if (token) {
      const decoded = verifyToken(token);
      userId = decoded?.userId;

      // Log logout event
      await logAuthEvent({
        action: 'LOGOUT',
        userId,
        requestMetadata,
      });
    }

    // Create response and clear cookie
    const response = NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );

    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
