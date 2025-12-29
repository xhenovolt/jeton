/**
 * POST /api/auth/login
 * Authenticate user and create session
 */

import { NextResponse } from 'next/server.js';
import { validateLogin } from '@/lib/validation.js';
import { verifyCredentials, updateUserLastLogin } from '@/lib/auth.js';
import { logAuthEvent, extractRequestMetadata } from '@/lib/audit.js';
import { generateToken, getSecureCookieOptions } from '@/lib/jwt.js';

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

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login
    await updateUserLastLogin(user.id);

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Log success
    await logAuthEvent({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      email: user.email,
      requestMetadata,
    });

    // Set cookie
    const response = NextResponse.json(
      {
        message: 'Logged in successfully',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
        },
      },
      { status: 200 }
    );

    const cookieOptions = getSecureCookieOptions();
    response.cookies.set('auth-token', token, cookieOptions);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
