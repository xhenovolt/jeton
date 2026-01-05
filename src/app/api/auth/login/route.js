/**
 * POST /api/auth/login
 * Authenticate user and create session with HTTP-only cookie
 */

import { NextResponse } from 'next/server.js';
import { validateLogin } from '@/lib/validation.js';
import { verifyCredentials, updateUserLastLogin } from '@/lib/auth.js';
import { logAuthEvent, extractRequestMetadata } from '@/lib/audit.js';
import { createSession, getSecureCookieOptions } from '@/lib/session.js';

export async function POST(request) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateLogin(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          fields: validation.errors,
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;
    const requestMetadata = extractRequestMetadata(request);

    // Verify credentials
    const user = await verifyCredentials(email, password);

    if (!user) {
      // Log failed attempt
      await logAuthEvent({
        action: 'LOGIN_FAILURE',
        email,
        reason: 'Invalid credentials',
        requestMetadata,
      });

      // Generic error - don't reveal whether email exists
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login
    await updateUserLastLogin(user.id);

    // Create session in database
    const sessionId = await createSession(user.id);

    // Log success
    await logAuthEvent({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      email: user.email,
      requestMetadata,
    });

    // Create response - do NOT return user data in JSON
    const response = NextResponse.json(
      { message: 'Logged in successfully' },
      { status: 200 }
    );

    // Set HTTP-only session cookie
    const cookieOptions = getSecureCookieOptions();
    response.cookies.set('jeton_session', sessionId, cookieOptions);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
