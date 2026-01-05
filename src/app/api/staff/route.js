/**
 * Staff Management - List & Create
 * GET: List all staff
 * POST: Create new staff account
 */

import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth.js';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
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

export async function GET(req) {
  try {
    // Use session-based auth via requireApiAuth
    // This handles all auth validation defensively
    const user = await requireApiAuth();

    if (!user) {
      await logAudit({
        action: 'ROUTE_DENIED',
        entity: 'STAFF',
        status: 'FAILURE',
        metadata: { reason: 'Invalid session' },
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get full user record to check status and role
    const userResult = await query(
      'SELECT id, role, status, email FROM users WHERE id = $1',
      [user.userId]
    );
    const userRecord = userResult.rows[0];

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userRole = userRecord.role;

    // Check permission - admin users can view staff
    if (!['FOUNDER', 'ADMIN'].includes(userRole)) {
      await logAudit({
        userId: user.userId,
        action: 'STAFF_VIEW',
        entity: 'STAFF',
        status: 'DENIED',
        metadata: { reason: 'Insufficient permissions' },
      });
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Fetch staff members
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

    await logAudit({
      userId: user.userId,
      action: 'STAFF_VIEW',
      entity: 'STAFF',
      status: 'SUCCESS',
      metadata: { count: result.rows.length },
    });

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
    // Use session-based auth
    const user = await requireApiAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role
    const userResult = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [user.userId]
    );
    const userRecord = userResult.rows[0];

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permission - only FOUNDER/ADMIN can create staff
    if (!['FOUNDER', 'ADMIN'].includes(userRecord.role)) {
      await logAudit({
        userId: user.userId,
        action: 'STAFF_CREATE',
        entity: 'STAFF',
        status: 'DENIED',
        metadata: { reason: 'Insufficient permissions' },
      });
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
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
      userId: user.userId,
      action: 'STAFF_CREATE',
      entity: 'STAFF',
      entityId: newUser.id,
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
