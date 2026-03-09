import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/assets
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const result = await query(`SELECT * FROM assets ORDER BY created_at DESC`);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch assets' }, { status: 500 });
  }
}

// POST /api/assets
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { name, value, currency, description } = body;

    if (!name) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });

    const result = await query(
      `INSERT INTO assets (name, value, currency, description) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, value || null, currency || 'UGX', description || null]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create asset' }, { status: 500 });
  }
}

// DELETE /api/assets?id=xxx
export async function DELETE(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    await query(`DELETE FROM assets WHERE id=$1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete asset' }, { status: 500 });
  }
}
