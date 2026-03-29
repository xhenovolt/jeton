import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUserOrThrow } from '@/lib/current-user';

/**
 * GET /api/profile — Fetch current user's full profile
 */
export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();

    const result = await query(
      `SELECT 
        u.id, u.email, u.full_name, u.role, u.status,
        u.profile_image_url, u.avatar_id, u.cover_image_url,
        u.department, u.hierarchy_level, u.bio, u.phone, u.timezone,
        u.last_active_device, u.created_at, u.updated_at, u.last_login,
        s.full_name as staff_name, s.id as staff_id
      FROM users u
      LEFT JOIN staff s ON s.user_id = u.id
      WHERE u.id = $1`,
      [user.id]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = result.rows[0];

    // Fetch permissions summary
    const permsResult = await query(
      `SELECT p.name, p.description 
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = $1
       ORDER BY p.name`,
      [profile.role]
    );

    // Fetch recent activity
    const activityResult = await query(
      `SELECT action, entity_type, entity_id, details, created_at
       FROM user_activity_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [user.id]
    );

    // Fetch devices
    const devicesResult = await query(
      `SELECT id, device_name, browser, os, ip_address, last_active_at, is_current
       FROM user_devices
       WHERE user_id = $1
       ORDER BY last_active_at DESC
       LIMIT 10`,
      [user.id]
    );

    return NextResponse.json({
      success: true,
      data: {
        ...profile,
        permissions: permsResult.rows,
        activity: activityResult.rows,
        devices: devicesResult.rows,
      },
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Profile fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

/**
 * PATCH /api/profile — Update current user's profile
 */
export async function PATCH(request) {
  try {
    const user = await getCurrentUserOrThrow();
    const body = await request.json();

    const allowedFields = [
      'full_name', 'profile_image_url', 'avatar_id', 'cover_image_url',
      'bio', 'phone', 'timezone',
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(user.id);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING
        id, email, full_name, role, status, profile_image_url, avatar_id,
        cover_image_url, department, bio, phone, timezone, updated_at`,
      values
    );

    // Log activity
    await query(
      `INSERT INTO user_activity_log (user_id, action, entity_type, details)
       VALUES ($1, 'profile_updated', 'user', $2)`,
      [user.id, JSON.stringify({ fields: Object.keys(body).filter(k => allowedFields.includes(k)) })]
    ).catch(() => {}); // Don't fail on activity log errors

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Profile updated successfully',
    });
  } catch (err) {
    if (err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.error('Profile update error:', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
