#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  try {
    console.log('shareholdings columns:');
    const colResult = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name='shareholdings'
      ORDER BY ordinal_position
    `);
    colResult.rows.forEach(row => console.log('  -', row.column_name, '(' + row.data_type + ')'));
  } finally {
    client.release();
    pool.end();
  }
})();
