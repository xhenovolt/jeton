/**
 * POST /api/auth/register
 * Register a new user account with session
 * 
 * SUPERADMIN BOOTSTRAP: First user in the system automatically becomes superadmin (active).
 * All subsequent users are created with status 'pending' and require admin activation.
 */

import { NextResponse } from 'next/server.js';
import { validateRegister } from '@/lib/validation.js';
import { createUser, findUserByEmail, hashPassword, getUserCount } from '@/lib/auth.js';
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

    const { email, password, name } = validation.data;
    const requestMetadata = extractRequestMetadata(request);

    // Check if email already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      await logAuthEvent({
        action: 'REGISTER_DUPLICATE',
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

    // SUPERADMIN BOOTSTRAP: First user = superadmin (active), rest = pending
    const userCount = await getUserCount();
    const isFirstUser = userCount === 0;

    const role = isFirstUser ? 'superadmin' : 'user';
    const status = isFirstUser ? 'active' : 'pending';

    // Create user
    const user = await createUser({
      email,
      passwordHash,
      name,
      role,
      isActive: true,
      status,
    });

    if (!user || user.error) {
      await logAuthEvent({
        action: 'REGISTER_FAILED',
        email,
        reason: user?.error || 'Unknown error',
        requestMetadata,
      });

      return NextResponse.json(
        { error: user?.error || 'Failed to create user' },
        { status: 500 }
      );
    }

    // Log success
    await logAuthEvent({
      action: isFirstUser ? 'SUPERADMIN_BOOTSTRAP' : 'REGISTER_SUCCESS',
      userId: user.id,
      email: user.email,
      requestMetadata,
    });

    // If first user (superadmin), create session and log them in immediately
    if (isFirstUser) {
      const sessionId = await createSession(user.id);

      const response = NextResponse.json(
        {
          message: 'Welcome! You are now the system superadmin.',
          userId: user.id,
          role: 'superadmin',
          status: 'active',
        },
        { status: 201 }
      );

      const cookieOptions = getSecureCookieOptions();
      response.cookies.set('jeton_session', sessionId, cookieOptions);
      return response;
    }

    // For non-first users, respond with pending message (no session)
    return NextResponse.json(
      {
        message: 'Account created successfully. Your account is pending admin activation.',
        userId: user.id,
        status: 'pending',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
