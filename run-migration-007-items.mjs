import dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Your env file has been named both '.env.local' and 'env.local' at
// different points — try both so this just works either way.
dotenv.config({ path: path.join(__dirname, '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, 'env.local') });
}

async function run() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set (checked .env.local and env.local)');
    process.exit(1);
  }
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    const client = await pool.connect();

    // Fix for: relation "invoice_items" does not exist (42P01)
    // This table is queried by /api/invoices/[id]/pdf but the migration
    // that creates it was apparently never run against this database.
    const file = path.join(__dirname, 'migrations', '007_create_invoice_items_table.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    console.log('Running migration: 007_create_invoice_items_table.sql ...');
    await client.query(sql);
    console.log('Done: invoice_items table created (or already existed).');

    // Sanity check: confirm the invoices table itself has the columns the
    // invoice engine expects. If this table is also missing/incomplete,
    // migration 500 needs to be run too.
    const check = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'invoices'
      ORDER BY ordinal_position
    `);
    console.log(`\ninvoices table has ${check.rows.length} columns.`);
    if (check.rows.length === 0) {
      console.log('WARNING: invoices table does not exist — also run migrations/500_invoice_and_intelligence.sql');
    } else {
      const hasVerificationToken = check.rows.some(r => r.column_name === 'verification_token');
      if (!hasVerificationToken) {
        console.log('NOTE: invoices table is missing newer columns (e.g. verification_token) — also run migrations/979_invoice_engine_rebuild.sql and migrations/980_invoice_permissions.sql');
      } else {
        console.log('invoices table looks up to date.');
      }
    }

    client.release();
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
