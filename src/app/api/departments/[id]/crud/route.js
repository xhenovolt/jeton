import { Pool } from 'pg';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * PUT /api/departments/[id]
 * Update department
 */
export async function PUT(req, { params }) {
  const { id } = params;
  const { name, description } = await req.json();
  
  try {
    const result = await pool.query(
      `UPDATE departments 
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, name, description]
    );
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json(
      { error: 'Failed to update department: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/departments/[id]
 * Delete department with safety checks
 */
export async function DELETE(req, { params }) {
  const { id } = params;
  
  try {
    // Check for active staff
    const staffCheck = await pool.query(
      `SELECT COUNT(*) as count FROM staff 
       WHERE department_id = $1 AND account_status IN ('active', 'pending')`,
      [id]
    );
    
    if (staffCheck.rows[0].count > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete department with active staff members',
          staff_count: staffCheck.rows[0].count
        },
        { status: 409 }
      );
    }
    
    // Check for dependencies
    const depsCheck = await pool.query(
      `SELECT COUNT(*) as count FROM (
        SELECT 1 FROM systems WHERE department_id = $1
        UNION ALL
        SELECT 1 FROM operations WHERE department_id = $1
       ) AS deps`,
      [id]
    );
    
    if (depsCheck.rows[0].count > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete department with linked systems/operations',
          dependency_count: depsCheck.rows[0].count
        },
        { status: 409 }
      );
    }
    
    // Safe to delete
    const result = await pool.query(
      `UPDATE departments 
       SET deleted_at = CURRENT_TIMESTAMP, deleted_reason = $2, account_status = 'deleted'
       WHERE id = $1
       RETURNING *`,
      [id, 'Deleted via API']
    );
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }
    
    // Log the deletion
    await pool.query(
      `INSERT INTO system_logs (level, module, action, message, details)
       VALUES ('info', 'departments', 'department_deleted', $1, $2)`,
      [`Department deleted: ${result.rows[0].name}`, JSON.stringify({ id })]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { error: 'Failed to delete department: ' + error.message },
      { status: 500 }
    );
  }
}
