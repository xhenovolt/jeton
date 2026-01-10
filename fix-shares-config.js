#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  try {
    console.log('🚀 Adding missing columns to shares_config table...\n');
    
    // Add missing columns
    console.log('📝 Adding status column...');
    try {
      await client.query(`ALTER TABLE shares_config ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active'`);
      console.log('✅ status column added');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('✅ status column already exists');
      } else {
        throw e;
      }
    }
    
    console.log('📝 Adding company_id column...');
    try {
      await client.query(`ALTER TABLE shares_config ADD COLUMN company_id UUID`);
      console.log('✅ company_id column added');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('✅ company_id column already exists');
      } else {
        throw e;
      }
    }
    
    console.log('📝 Adding notes column...');
    try {
      await client.query(`ALTER TABLE shares_config ADD COLUMN notes TEXT`);
      console.log('✅ notes column added');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('✅ notes column already exists');
      } else {
        throw e;
      }
    }
    
    // Insert default config if not exists
    console.log('\n📝 Checking default configuration...');
    const check = await client.query('SELECT COUNT(*) FROM shares_config');
    if (check.rows[0].count === '0') {
      console.log('📝 Inserting default shares configuration...');
      await client.query(`
        INSERT INTO shares_config (authorized_shares, issued_shares, par_value, class_type, status)
        VALUES (10000000, 1000000, 1.0000, 'Common', 'active')
      `);
      console.log('✅ Default configuration inserted');
    } else {
      console.log('✅ Default configuration already exists');
    }
    
    console.log('\n✨ shares_config table is now complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
})();
