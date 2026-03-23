import { Pool } from 'pg';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/systems/[systemId]/tech-stack
 * Fetch tech stack for a system
 */
export async function GET(req, { params }) {
  const { systemId } = params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM system_tech_stack WHERE system_id = $1 ORDER BY created_at DESC',
      [systemId]
    );
    
    return NextResponse.json(result.rows || null);
  } catch (error) {
    console.error('Error fetching tech stack:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tech stack' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/systems/[systemId]/tech-stack
 * Add/update tech stack for a system
 */
export async function POST(req, { params }) {
  const { systemId } = params;
  const { language, framework, database, platform, notes } = await req.json();
  
  try {
    const result = await pool.query(
      `INSERT INTO system_tech_stack (system_id, language, framework, database, platform, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [systemId, language, framework, database, platform, notes]
    );
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating tech stack:', error);
    return NextResponse.json(
      { error: 'Failed to create tech stack' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/systems/[systemId]/tech-stack/[id]
 * Update tech stack entry
 */
export async function PUT(req, { params }) {
  const { systemId, id } = params;
  const { language, framework, database, platform, notes } = await req.json();
  
  try {
    const result = await pool.query(
      `UPDATE system_tech_stack 
       SET language = COALESCE($2, language),
           framework = COALESCE($3, framework),
           database = COALESCE($4, database),
           platform = COALESCE($5, platform),
           notes = COALESCE($6, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND system_id = $7
       RETURNING *`,
      [id, language, framework, database, platform, notes, systemId]
    );
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Tech stack entry not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating tech stack:', error);
    return NextResponse.json(
      { error: 'Failed to update tech stack' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/systems/[systemId]/tech-stack/[id]
 * Delete tech stack entry
 */
export async function DELETE(req, { params }) {
  const { systemId, id } = params;
  
  try {
    const result = await pool.query(
      'DELETE FROM system_tech_stack WHERE id = $1 AND system_id = $2 RETURNING id',
      [id, systemId]
    );
    
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Tech stack entry not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tech stack:', error);
    return NextResponse.json(
      { error: 'Failed to delete tech stack' },
      { status: 500 }
    );
  }
}
