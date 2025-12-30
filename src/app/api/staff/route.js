/**
 * Staff Management - List & Create
 * GET: List all staff
 * POST: Create new staff account
 */

import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { isStaffAdmin } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { cookies } from 'next/headers';
import { z } from 'zod';

const createStaffSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Full name required').max(255),
  role: z.enum(['FINANCE', 'SALES', 'VIEWER'], 'Invalid role'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  department: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
});

// Helper function to extract token from cookies or Authorization header
async function getToken(req) {
  // Try Authorization header first (Bearer token)
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Fall back to cookie (HttpOnly from browser)
  try {
    const cookieStore = await cookies();
    return cookieStore.get('auth-token')?.value;
  } catch (error) {
    return null;
  }
}

export async function GET(req) {
  try {
    // Extract token from either cookies or Authorization header
    const token = await getToken(req);

    if (!token) {
      await logAudit({
        action: 'ROUTE_DENIED',
        entity: 'STAFF',
        status: 'FAILURE',
        metadata: { reason: 'No token provided' },
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      await logAudit({
        action: 'ROUTE_DENIED',
        entity: 'STAFF',
        status: 'FAILURE',
        metadata: { reason: 'Invalid token' },
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const userResult = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );
    const user = userResult.rows[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permission - any authenticated user can view staff
    const result = await query(`
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.status,
        u.last_login,
        u.created_at,
        sp.department,
        sp.title,
        sp.phone
      FROM users u
      LEFT JOIN staff_profiles sp ON u.id = sp.user_id
      WHERE u.role != 'FOUNDER'
      ORDER BY u.created_at DESC
    `);

    return NextResponse.json({
      staff: result.rows,
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    // Extract token from either cookies or Authorization header
    const token = await getToken(req);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const userResult = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );
    const user = userResult.rows[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse and validate request
    const body = await req.json();
    const validation = createStaffSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const {
      email,
      full_name,
      role,
      password,
      department,
      title,
      phone,
    } = validation.data;

    // Check if email already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [
      email,
    ]);

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user in transaction
    const userInsertResult = await query(
      `INSERT INTO users (email, password_hash, full_name, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, email, full_name, role, status, created_at`,
      [email, passwordHash, full_name, role]
    );

    const newUser = userInsertResult.rows[0];

    // Create staff profile
    await query(
      `INSERT INTO staff_profiles (user_id, department, title, phone, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [newUser.id, department || null, title || null, phone || null]
    );

    // Log action
    await logAudit({
      actor_id: user.id,
      action: 'STAFF_CREATED',
      entity: 'STAFF',
      entity_id: newUser.id,
      status: 'SUCCESS',
      metadata: {
        email,
        full_name,
        role,
        department,
        title,
      },
    });

    return NextResponse.json(
      {
        staff: newUser,
        message: 'Staff account created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
