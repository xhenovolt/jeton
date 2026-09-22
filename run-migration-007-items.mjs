import dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  console.log('1/5 Got DATABASE_URL, creating pool...');

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000, // fail fast instead of hanging forever
  });

  pool.on('error', (err) => console.error('Pool error event:', err.message));

  try {
    console.log('2/5 Connecting to database (10s timeout)...');
    const client = await pool.connect();
    console.log('3/5 Connected! Reading migration file...');

    const file = path.join(__dirname, 'migrations', '007_create_invoice_items_table.sql');
    const sql = fs.readFileSync(file, 'utf-8');
    console.log('4/5 Running migration: 007_create_invoice_items_table.sql ...');
    await client.query(sql);
    console.log('5/5 Done: invoice_items table created (or already existed).');

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
        console.log('NOTE: also run migrations/979_invoice_engine_rebuild.sql and migrations/980_invoice_permissions.sql');
      } else {
        console.log('invoices table looks up to date.');
      }
    }

    client.release();
  } catch (err) {
    console.error('\nFAILED at connection/query step:', err.message);
    console.error('Full error:', err);
    if (err.message.includes('timeout') || err.code === 'ETIMEDOUT') {
      console.error('\nThis looks like a network/firewall block on this machine, not a database problem.');
      console.error('Try: temporarily disable Windows Firewall / antivirus network protection and re-run,');
      console.error('or check if a firewall prompt for "node.exe" is waiting for approval (check the taskbar / notification area).');
    }
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
