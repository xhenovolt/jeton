import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { updateUserPresence, getUserPresence } from '@/lib/communication-utils.js';

/**
 * POST /api/communication/presence
 * Update the current user's online/offline status.
 * Body: { is_online, device_type } — camelCase equivalents also accepted.
 */
export async function POST(req) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { userId } = auth;

    const body = await req.json();
    const isOnline   = body.is_online   ?? body.isOnline   ?? true;
    const deviceType = body.device_type ?? body.deviceType ?? 'web';

    const presence = await updateUserPresence(userId, isOnline, deviceType);
    return NextResponse.json({ success: true, presence });
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/communication/presence?userId=<uuid>
 * Look up a user's presence. Auth required — the old handler let anyone
 * probe presence, and worse, parsed the userId from pathname.split which
 * always resolved to the literal string "presence".
 */
export async function GET(req) {
  try {
    const perm = await requirePermission(req, 'communication.view_conversations');
    if (perm instanceof NextResponse) return perm;

    const url = new URL(req.url);
    const target = url.searchParams.get('userId') || url.searchParams.get('user_id');
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'userId query param is required' },
        { status: 400 }
      );
    }

    const presence = await getUserPresence(target);
    return NextResponse.json({
      success: true,
      presence: presence || { is_online: false },
    });
  } catch (error) {
    console.error('Error fetching presence:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
