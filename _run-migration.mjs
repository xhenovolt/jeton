import dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const file = process.argv[2];
const sql = fs.readFileSync(path.resolve(file), 'utf-8');
const c = await pool.connect();
try { console.log('Applying', file); await c.query(sql); console.log('OK'); }
catch (e) { console.error('FAIL:', e.message); process.exit(1); }
finally { c.release(); await pool.end(); }
