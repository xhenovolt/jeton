import { Pool } from 'pg';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/issues/[id]
 */
export async function GET(req, { params }) {
  const { id } = params;
  
  try {
    const result = await pool.query(
      `SELECT 
        i.*,
        s.name as system_name,
        u.username as assigned_to_username
      FROM issues i
      LEFT JOIN systems s ON i.system_id = s.id
      LEFT JOIN users u ON i.assigned_to = u.id
      WHERE i.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching issue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch issue' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/issues/[id]
 */
export async function PUT(req, { params }) {
  const { id } = params;
  const { title, description, severity, status, assigned_to, resolved_at } = await req.json();
  
  try {
    let query = `UPDATE issues SET`;
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (severity !== undefined) {
      updates.push(`severity = $${paramIndex++}`);
      params.push(severity);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      params.push(assigned_to);
    }
    if (status === 'resolved' && !resolved_at) {
      updates.push(`resolved_at = $${paramIndex++}`);
      params.push(new Date());
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    query += ' ' + updates.join(', ') + ` WHERE id = $${paramIndex}`;
    params.push(id);
    
    const result = await pool.query(query + ' RETURNING *', params);
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating issue:', error);
    return NextResponse.json(
      { error: 'Failed to update issue: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/issues/[id]
 */
export async function DELETE(req, { params }) {
  const { id } = params;
  
  try {
    const result = await pool.query(
      'DELETE FROM issues WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting issue:', error);
    return NextResponse.json(
      { error: 'Failed to delete issue' },
      { status: 500 }
    );
  }
}
