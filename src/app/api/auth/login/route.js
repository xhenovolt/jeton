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

    // Handle status-based errors (pending, suspended, disabled)
    if (user && user.error) {
      await logAuthEvent({
        action: 'LOGIN_BLOCKED',
        email,
        reason: user.error,
        requestMetadata,
      });

      const statusMessages = {
        ACCOUNT_PENDING: 'Your account is pending admin activation.',
        ACCOUNT_SUSPENDED: 'Your account has been suspended.',
        ACCOUNT_DISABLED: 'Your account has been disabled.',
      };

      return NextResponse.json(
        { error: statusMessages[user.error] || user.message || 'Login failed', code: user.error },
        { status: 403 }
      );
    }

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

    // Collect device metadata for session tracking
    const deviceInfo = {
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || null,
      userAgent: request.headers.get('user-agent') || null,
      deviceName: null, // Can be set by the client via a request header in the future
    };
    const ua = deviceInfo.userAgent ?? '';
    if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
      deviceInfo.deviceName = 'Mobile';
    } else if (ua.includes('Tablet') || ua.includes('iPad')) {
      deviceInfo.deviceName = 'Tablet';
    } else if (ua) {
      deviceInfo.deviceName = 'Desktop';
    }

    // Create session in database
    const sessionId = await createSession(user.id, deviceInfo);

    // Log success
    await logAuthEvent({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      email: user.email,
      requestMetadata,
    });

    // Check if user must reset their temporary password on first login
    const mustReset = user.must_reset_password === true;

    // Create response
    const response = NextResponse.json(
      {
        message: mustReset ? 'Password reset required' : 'Logged in successfully',
        requirePasswordReset: mustReset,
      },
      { status: 200 }
    );

    // Set HTTP-only session cookie
    const cookieOptions = getSecureCookieOptions();
    response.cookies.set('jeton_session', sessionId, cookieOptions);

    // Set a short-lived indicator cookie when password reset is required.
    // Middleware uses this to guard all app routes until reset is complete.
    if (mustReset) {
      response.cookies.set('jeton_must_reset', '1', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        // Expires with the session
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
