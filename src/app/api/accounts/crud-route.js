import { Pool } from 'pg';
import { NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/accounts
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    
    let query = 'SELECT * FROM accounts WHERE 1 = 1';
    const params = [];
    
    if (status) {
      query += ' AND status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounts
 * Create a new account
 */
export async function POST(req) {
  const { name, account_type, status, balance, currency } = await req.json();
  
  if (!name) {
    return NextResponse.json(
      { error: 'Account name is required' },
      { status: 400 }
    );
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO accounts (name, account_type, status, balance, currency)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, account_type, status || 'active', balance || 0, currency || 'UGX']
    );
    
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account: ' + error.message },
      { status: 500 }
    );
  }
}
