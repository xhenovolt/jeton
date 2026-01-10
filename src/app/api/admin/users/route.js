/**
 * Admin Users API
 * GET: List all users with filters
 * POST: Create new user
 */

import { query } from '@/lib/db';
import { verifyAuth } from '@/lib/auth-utils';
import crypto from 'crypto';

// Helper: Check if user has admin access (simplified - superadmins have all access)
async function checkAdminAccess(authData) {
  // Superadmin and admin roles have access
  return authData.role === 'superadmin' || authData.role === 'admin';
}

export async function GET(request) {
  try {
    const authData = await verifyAuth(request);
    if (!authData) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin access
    const hasPermission = checkAdminAccess(authData);
    if (!hasPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT 
        u.id, 
        u.email, 
        u.role, 
        u.status, 
        u.created_at,
        COALESCE(u.last_seen, NOW() - INTERVAL '1 day') as last_seen,
        COALESCE(u.is_online, false) as is_online
      FROM users u
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      params.push(status);
      queryStr += ` AND u.status = $${params.length}`;
    }

    queryStr += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams = [];

    if (status) {
      countParams.push(status);
      countQuery += ` AND status = $${countParams.length}`;
    }

    const countResult = await query(countQuery, countParams);

    return Response.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
      },
    });
  } catch (error) {
    console.error('Users GET error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authData = await verifyAuth(request);
    if (!authData) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin access
    const hasPermission = checkAdminAccess(authData);
    if (!hasPermission) {
      return Response.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      email,
      username,
      full_name,
      password,
      department,
      role_ids = [],
    } = body;

    // Validation
    if (!email || !username || !full_name || !password) {
      return Response.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check email uniqueness
    const emailCheck = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rowCount > 0) {
      return Response.json(
        { success: false, error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Check username uniqueness
    const usernameCheck = await query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (usernameCheck.rowCount > 0) {
      return Response.json(
        { success: false, error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    // Create user
    const userResult = await query(
      `INSERT INTO users (
        email, username, full_name, password_hash, 
        department, status, created_by_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, username, full_name, status, created_at`,
      [email, username, full_name, passwordHash, department || null, 'inactive', authData.userId]
    );

    const newUser = userResult.rows[0];

    // Assign roles if provided
    if (role_ids && role_ids.length > 0) {
      for (const roleId of role_ids) {
        await query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by_id)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [newUser.id, roleId, authData.userId]
        );
      }
    }

    // Log audit
    await query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [authData.userId, 'USER_CREATED', 'users', newUser.id, 'SUCCESS']
    );

    return Response.json(
      {
        success: true,
        message: 'User created successfully',
        data: newUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Users POST error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
