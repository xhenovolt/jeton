import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/staff
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const result = await query(`SELECT * FROM staff ORDER BY joined_at DESC NULLS LAST, created_at DESC`);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch staff' }, { status: 500 });
  }
}

// POST /api/staff
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { name, role, status, joined_at, notes } = body;

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO staff (name, role, status, joined_at, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, role || null, status || 'active', joined_at || null, notes || null]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create staff member' }, { status: 500 });
  }
}

// PATCH /api/staff — update status
export async function PATCH(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { id, status, role, notes } = body;

    const result = await query(
      `UPDATE staff SET status=$1, role=$2, notes=$3 WHERE id=$4 RETURNING *`,
      [status, role, notes, id]
    );
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update staff member' }, { status: 500 });
  }
}

// DELETE /api/staff?id=xxx
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    await query(`DELETE FROM staff WHERE id=$1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete staff member' }, { status: 500 });
  }
}
