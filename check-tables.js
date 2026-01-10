#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' 
      ORDER BY table_name
    `);
    console.log('Tables in database:');
    result.rows.forEach(row => console.log('  -', row.table_name));
    
    // Check shares_config structure
    console.log('\nshares_config columns:');
    const colResult = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name='shares_config'
      ORDER BY ordinal_position
    `);
    colResult.rows.forEach(row => console.log('  -', row.column_name, '(' + row.data_type + ')'));
  } finally {
    client.release();
    pool.end();
  }
})();
