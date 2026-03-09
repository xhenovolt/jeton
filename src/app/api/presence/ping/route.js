/**
 * POST /api/presence/ping
 * Called by authenticated clients every 30 seconds.
 * Upserts user_presence row and marks user as online.
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/current-user';
import { query } from '@/lib/db';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await query(
      `INSERT INTO user_presence (user_id, last_ping, last_seen, status)
       VALUES ($1, NOW(), NOW(), 'online')
       ON CONFLICT (user_id) DO UPDATE
       SET last_ping = NOW(),
           last_seen = NOW(),
           status    = 'online'`,
      [user.id]
    );

    return NextResponse.json({ ok: true, status: 'online' });
  } catch (err) {
    console.error('[presence/ping]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
