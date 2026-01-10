/**
 * POST /api/auth/register
 * Register a new user account with session
 */

import { NextResponse } from 'next/server.js';
import { validateRegister } from '@/lib/validation.js';
import { createUser, findUserByEmail, hashPassword } from '@/lib/auth.js';
import { logAuthEvent, extractRequestMetadata } from '@/lib/audit.js';
import { createSession, getSecureCookieOptions } from '@/lib/session.js';

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

    const { email, password, username, full_name } = validation.data;
    const requestMetadata = extractRequestMetadata(request);

    // Check if email already exists
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

    // Check if username is provided and unique
    if (username) {
      const { query } = await import('@/lib/db.js');
      const usernameCheck = await query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );

      if (usernameCheck.rowCount > 0) {
        return NextResponse.json(
          { error: 'Username already taken', code: 'USERNAME_TAKEN' },
          { status: 409 }
        );
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await createUser({
      email,
      passwordHash,
      username: username || null,
      full_name: full_name || null,
      role: 'FOUNDER',
      status: 'dormant', // Users are dormant until activated by admin
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

    // Create session in database
    const sessionId = await createSession(user.id);

    // Log success
    await logAuthEvent({
      action: 'REGISTER',
      userId: user.id,
      email: user.email,
      requestMetadata,
    });

    // Set cookie - do NOT return user data in JSON
    const response = NextResponse.json(
      { 
        message: 'Account created successfully. Please wait for admin activation.',
        userId: user.id,
      },
      { status: 201 }
    );

    const cookieOptions = getSecureCookieOptions();
    response.cookies.set('jeton_session', sessionId, cookieOptions);

    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
