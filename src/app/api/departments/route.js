import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/departments
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const result = await query(`
      SELECT d.*, 
        COUNT(DISTINCT e.id) as employee_count,
        COUNT(DISTINCT r.id) as role_count
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id AND e.employment_status = 'active'
      LEFT JOIN roles r ON r.department_id = d.id
      GROUP BY d.id
      ORDER BY d.department_name
    `);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch departments' }, { status: 500 });
  }
}

// POST /api/departments
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { department_name, description } = body;
    if (!department_name) return NextResponse.json({ success: false, error: 'department_name required' }, { status: 400 });

    const result = await query(
      `INSERT INTO departments (department_name, description) VALUES ($1,$2) RETURNING *`,
      [department_name, description || null]
    );
    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (error.code === '23505') return NextResponse.json({ success: false, error: 'Department already exists' }, { status: 409 });
    return NextResponse.json({ success: false, error: 'Failed to create department' }, { status: 500 });
  }
}
