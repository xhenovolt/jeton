import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import {
  getUserNotifications,
  markNotificationAsRead,
} from '@/lib/communication-utils.js';
import { query } from '@/lib/db.js';

/**
 * GET /api/communication/notifications
 * Legacy — reads communication_notifications (parallel to the main
 * notifications table). The Navbar bell uses /api/notifications, not
 * this. Kept working for direct callers only.
 */
export async function GET(req) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const notifications = await getUserNotifications(userId, unreadOnly);
    return NextResponse.json({ success: true, notifications, count: notifications.length });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/communication/notifications?id=<uuid>
 * Mark a notification as read. Owner-only — the previous version had no
 * ownership check and would happily mark anyone else's notifications
 * read via a crafted URL.
 */
export async function PUT(req) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;

    const url = new URL(req.url);
    const notificationId = url.searchParams.get('id');
    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: 'id query param is required' },
        { status: 400 }
      );
    }

    // Ownership check before mutating.
    const owner = await query(
      `SELECT user_id FROM communication_notifications WHERE id = $1`,
      [notificationId]
    );
    if (owner.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    if (owner.rows[0].user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const result = await markNotificationAsRead(notificationId);
    return NextResponse.json({ success: true, notification: result });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
