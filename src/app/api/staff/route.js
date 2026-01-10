/**
 * Staff Management - List & Create
 * GET: List all staff
 * POST: Create new staff account
 */

import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';

const createStaffSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Full name required').max(255),
  role: z.enum(['ADMIN', 'FINANCE', 'SALES', 'AUDITOR', 'VIEWER'], 'Invalid role'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  department: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
});

export async function GET(req) {
  try {
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

    return Response.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    // Parse and validate request
    const body = await req.json();
    const validation = createStaffSchema.safeParse(body);

    if (!validation.success) {
      return Response.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
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
      return Response.json(
        { success: false, error: 'Email already exists' },
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

    return Response.json(
      {
        success: true,
        data: newUser,
        message: 'Staff account created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating staff:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
