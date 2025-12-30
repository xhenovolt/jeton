/**
 * Staff Management - Single Staff Member
 * GET: Get staff details
 * PUT: Update staff details
 * PATCH: Suspend/reactivate staff
 */

import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { isStaffAdmin } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { cookies } from 'next/headers';
import { z } from 'zod';

const updateStaffSchema = z.object({
  full_name: z.string().min(2).max(255).optional(),
  role: z.enum(['FINANCE', 'SALES', 'VIEWER']).optional(),
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

export async function GET(req, { params }) {
  try {
    const { id } = await params;

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

    // Get staff member
    const result = await query(
      `SELECT 
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
      WHERE u.id = $1 AND u.role != 'FOUNDER'`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    return NextResponse.json({
      staff: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;

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

    // Get current user
    const userResult = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );
    const user = userResult.rows[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permission - only FOUNDER can update staff
    if (!isStaffAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate request
    const body = await req.json();
    const validation = updateStaffSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { full_name, role, department, title, phone } = validation.data;

    // Update user
    if (full_name || role) {
      const updates = [];
      const values = [id];
      let paramIndex = 2;

      if (full_name) {
        updates.push(`full_name = $${paramIndex}`);
        values.push(full_name);
        paramIndex++;
      }

      if (role) {
        updates.push(`role = $${paramIndex}`);
        values.push(role);
        paramIndex++;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      if (updates.length > 0) {
        await query(
          `UPDATE users SET ${updates.join(', ')} WHERE id = $1`,
          values
        );
      }
    }

    // Update staff profile
    if (department !== undefined || title !== undefined || phone !== undefined) {
      const profileUpdates = [];
      const profileValues = [id];
      let paramIndex = 2;

      if (department !== undefined) {
        profileUpdates.push(`department = $${paramIndex}`);
        profileValues.push(department || null);
        paramIndex++;
      }

      if (title !== undefined) {
        profileUpdates.push(`title = $${paramIndex}`);
        profileValues.push(title || null);
        paramIndex++;
      }

      if (phone !== undefined) {
        profileUpdates.push(`phone = $${paramIndex}`);
        profileValues.push(phone || null);
        paramIndex++;
      }

      profileUpdates.push(`updated_at = CURRENT_TIMESTAMP`);

      if (profileUpdates.length > 0) {
        await query(
          `UPDATE staff_profiles SET ${profileUpdates.join(', ')} WHERE user_id = $1`,
          profileValues
        );
      }
    }

    // Log action
    await logAudit({
      actor_id: user.id,
      action: 'STAFF_UPDATED',
      entity: 'STAFF',
      entity_id: id,
      status: 'SUCCESS',
      metadata: validation.data,
    });

    // Get updated staff
    const updatedResult = await query(
      `SELECT 
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
      WHERE u.id = $1`,
      [id]
    );

    return NextResponse.json({
      staff: updatedResult.rows[0],
      message: 'Staff updated successfully',
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;

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

    // Get current user
    const userResult = await query(
      'SELECT id, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );
    const user = userResult.rows[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permission - only FOUNDER can suspend
    if (!isStaffAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse action
    const body = await req.json();
    const { action } = body;

    if (!action || !['suspend', 'reactivate'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be suspend or reactivate' },
        { status: 400 }
      );
    }

    // Cannot suspend yourself
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Cannot suspend your own account' },
        { status: 400 }
      );
    }

    const newStatus = action === 'suspend' ? 'suspended' : 'active';

    // Update status
    await query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newStatus, id]
    );

    // Log action
    const auditAction = action === 'suspend' ? 'STAFF_SUSPENDED' : 'STAFF_REACTIVATED';
    await logAudit({
      actor_id: user.id,
      action: auditAction,
      entity: 'STAFF',
      entity_id: id,
      status: 'SUCCESS',
      metadata: { action },
    });

    // Get updated staff
    const updatedResult = await query(
      `SELECT 
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
      WHERE u.id = $1`,
      [id]
    );

    return NextResponse.json({
      staff: updatedResult.rows[0],
      message: `Staff ${newStatus === 'suspended' ? 'suspended' : 'reactivated'} successfully`,
    });
  } catch (error) {
    console.error('Error suspending staff:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
