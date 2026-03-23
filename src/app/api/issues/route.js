import { Pool } from 'pg';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/issues
 * Get all issues with filters and analytics
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const systemId = searchParams.get('system_id');
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const assignedTo = searchParams.get('assigned_to');
    
    let query = `
      SELECT 
        i.*,
        s.name as system_name,
        u.username as assigned_to_username,
        EXTRACT(EPOCH FROM (i.resolved_at - i.created_at))::INTEGER as resolution_time_seconds
      FROM issues i
      LEFT JOIN systems s ON i.system_id = s.id
      LEFT JOIN users u ON i.assigned_to = u.id
      WHERE 1 = 1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (systemId) {
      query += ` AND i.system_id = $${paramIndex++}`;
      params.push(systemId);
    }
    if (status) {
      query += ` AND i.status = $${paramIndex++}`;
      params.push(status);
    }
    if (severity) {
      query += ` AND i.severity = $${paramIndex++}`;
      params.push(severity);
    }
    if (assignedTo) {
      query += ` AND i.assigned_to = $${paramIndex++}`;
      params.push(assignedTo);
    }
    
    query += ' ORDER BY i.severity DESC, i.created_at DESC';
    
    const result = await pool.query(query, params);
    
    // Calculate analytics
    const analytics = await pool.query(`
      SELECT 
        COUNT(*) as total_issues,
        COUNT(*) FILTER (WHERE status = 'resolved' OR status = 'closed') as resolved_issues,
        COUNT(*) FILTER (WHERE status = 'open' OR status = 'in-progress') as open_issues,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))::INTEGER as avg_resolution_time_seconds,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_issues,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium_issues,
        COUNT(*) FILTER (WHERE severity = 'low') as low_issues
      FROM issues
      WHERE 1 = 1 ${systemId ? 'AND system_id = $' + params.length : ''}
    `, systemId ? params.slice(0, 1) : []);
    
    return NextResponse.json({
      issues: result.rows,
      analytics: analytics.rows[0]
    });
  } catch (error) {
    console.error('Error fetching issues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch issues' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/issues
 * Create a new issue
 */
export async function POST(req) {
  const { title, description, severity, system_id, assigned_to, created_by } = await req.json();
  
  if (!title || !severity) {
    return NextResponse.json(
      { error: 'Missing required fields: title, severity' },
      { status: 400 }
    );
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO issues (title, description, severity, system_id, assigned_to, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'open', $6)
       RETURNING *`,
      [title, description, severity, system_id, assigned_to, created_by]
    );
    
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating issue:', error);
    return NextResponse.json(
      { error: 'Failed to create issue: ' + error.message },
      { status: 500 }
    );
  }
}
