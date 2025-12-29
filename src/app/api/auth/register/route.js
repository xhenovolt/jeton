/**
 * POST /api/auth/register
 * Register a new user account
 */

import { NextResponse } from 'next/server.js';
import { validateRegister } from '@/lib/validation.js';
import { createUser, findUserByEmail, hashPassword } from '@/lib/auth.js';
import { logAuthEvent, extractRequestMetadata } from '@/lib/audit.js';
import { generateToken, getSecureCookieOptions } from '@/lib/jwt.js';

export async function POST(request) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateRegister(body);
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

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      await logAuthEvent({
        action: 'REGISTER',
        email,
        reason: 'Email already exists',
        requestMetadata,
      });

      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await createUser({
      email,
      passwordHash,
      role: 'FOUNDER',
    });

    if (!user || user.error) {
      await logAuthEvent({
        action: 'REGISTER',
        email,
        reason: user?.error || 'Unknown error',
        requestMetadata,
      });

      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Log success
    await logAuthEvent({
      action: 'REGISTER',
      userId: user.id,
      email: user.email,
      requestMetadata,
    });

    // Set cookie
    const response = NextResponse.json(
      {
        message: 'Account created successfully',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    );

    const cookieOptions = getSecureCookieOptions();
    response.cookies.set('auth-token', token, cookieOptions);

    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
