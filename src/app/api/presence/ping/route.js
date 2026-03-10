/**
 * POST /api/presence/ping
 * Called by authenticated clients every 30 seconds.
 * Upserts user_presence row and marks user as online.
 * Optionally accepts { route, page_title } in body to track current page.
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/current-user';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let route = null;
    let page_title = null;

    try {
      const body = await request.json();
      route = body?.route || null;
      page_title = body?.page_title || null;
    } catch {
      // Body is optional
    }

    await query(
      `INSERT INTO user_presence (user_id, last_ping, last_seen, status, is_online, current_route, current_page_title)
       VALUES ($1, NOW(), NOW(), 'online', true, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET last_ping          = NOW(),
           last_seen          = NOW(),
           status             = 'online',
           is_online          = true,
           current_route      = COALESCE($2, user_presence.current_route),
           current_page_title = COALESCE($3, user_presence.current_page_title),
           updated_at         = NOW()`,
      [user.id, route, page_title]
    );

    return NextResponse.json({ ok: true, status: 'online' });
  } catch (err) {
    console.error('[presence/ping]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
