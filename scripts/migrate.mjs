#!/usr/bin/env node
/**
 * Jeton migration runner — the ONE way to apply migrations/*.sql.
 *
 * Replaces the ten ad-hoc runners (run-migration-*.mjs at the repo root and
 * run-*migration*.js in scripts/), none of which recorded what had been
 * applied. Applied files are tracked in `schema_migrations` with a checksum.
 *
 *   node scripts/migrate.mjs status            # what is applied / pending (default)
 *   node scripts/migrate.mjs up                # apply every pending file, in order
 *   node scripts/migrate.mjs up --to 985       # apply pending files up to prefix 985
 *   node scripts/migrate.mjs baseline          # mark ALL current files as applied
 *   node scripts/migrate.mjs baseline --to 980 #   …or only those up to prefix 980
 *   node scripts/migrate.mjs lint              # naming rules only; no database (CI)
 *
 * Existing databases: run `baseline --to <last prefix you know is applied>`
 * once, then `up` from then on.
 *
 * Rules for new files (enforced by `lint`): `NNN_description.sql`, prefix
 * unique and greater than every existing prefix. Each file runs in its own
 * transaction; put `-- migrate:no-transaction` on the first line for
 * statements that can't (e.g. CREATE INDEX CONCURRENTLY).
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const DIR = 'migrations';
// Files that predate the naming rules. Frozen: never raise the limit or add
// to the unnumbered list.
const LEGACY_PREFIX_LIMIT = 981;
const LEGACY_UNNUMBERED = new Set(['create_sales_tables.sql', 'create_shares_tables.sql']);

function parsePrefix(name) {
  const m = /^(\d+)_/.exec(name);
  return m ? Number(m[1]) : null;
}

function listFiles() {
  return readdirSync(DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      const pa = parsePrefix(a), pb = parsePrefix(b);
      if (pa === null && pb === null) return a.localeCompare(b);
      if (pa === null) return 1;          // unnumbered legacy files last
      if (pb === null) return -1;
      return pa - pb || a.localeCompare(b);
    });
}

const checksum = sql => createHash('sha256').update(sql).digest('hex').slice(0, 16);

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

// ── lint (no DB) ────────────────────────────────────────────────────────────
function lint() {
  const files = listFiles();
  const problems = [];
  const seen = new Map();
  let maxLegacy = 0;
  for (const f of files) {
    const p = parsePrefix(f);
    if (p !== null && p < LEGACY_PREFIX_LIMIT) { maxLegacy = Math.max(maxLegacy, p); continue; }
    if (p === null) {
      if (!LEGACY_UNNUMBERED.has(f)) problems.push(`${f}: missing numeric prefix (NNN_description.sql)`);
      continue;
    }
    if (seen.has(p)) problems.push(`${f}: prefix ${p} already used by ${seen.get(p)}`);
    seen.set(p, f);
    if (!/^\d+_[a-z0-9_]+\.sql$/.test(f)) problems.push(`${f}: use lowercase snake_case after the prefix`);
  }
  if (problems.length) {
    console.error('✖ migration naming problems:\n' + problems.map(p => `  - ${p}`).join('\n'));
    process.exit(1);
  }
  console.log(`✔ ${files.length} migration files; new-style prefixes are unique (legacy ≤ ${maxLegacy})`);
}

// ── DB commands ─────────────────────────────────────────────────────────────
async function connect() {
  if (existsSync('.env.local')) {
    const { config } = await import('dotenv');
    config({ path: '.env.local' });
  }
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
  const { default: pg } = await import('pg');
  const ssl = url.includes('neon.tech') || url.includes('sslmode=') ? { rejectUnauthorized: false } : false;
  const client = new pg.Client({ connectionString: url, ssl });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      checksum   TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      baseline   BOOLEAN NOT NULL DEFAULT FALSE
    )`);
  return client;
}

async function applied(client) {
  const { rows } = await client.query('SELECT filename, checksum FROM schema_migrations');
  return new Map(rows.map(r => [r.filename, r.checksum]));
}

function withinTarget(file, to) {
  if (to === undefined) return true;
  // Unnumbered legacy files predate every numbered one: a baseline "through
  // N" must cover them, or `up` would re-run old DDL on an existing database.
  if (LEGACY_UNNUMBERED.has(file)) return true;
  const p = parsePrefix(file);
  return p !== null && p <= Number(to);
}

async function status() {
  const client = await connect();
  try {
    const done = await applied(client);
    let pending = 0;
    for (const f of listFiles()) {
      const sum = checksum(readFileSync(join(DIR, f), 'utf8'));
      if (!done.has(f)) { pending++; console.log(`  pending   ${f}`); }
      else if (done.get(f) !== sum) console.log(`  CHANGED   ${f}  (edited after it was applied)`);
    }
    console.log(`\n${done.size} applied, ${pending} pending`);
  } finally { await client.end(); }
}

async function up() {
  const to = argValue('--to');
  const client = await connect();
  try {
    const done = await applied(client);
    const todo = listFiles().filter(f => !done.has(f) && withinTarget(f, to));
    if (!todo.length) { console.log('Nothing to apply.'); return; }
    for (const f of todo) {
      const sql = readFileSync(join(DIR, f), 'utf8');
      const noTx = /^--\s*migrate:no-transaction/.test(sql);
      process.stdout.write(`→ ${f} … `);
      try {
        if (!noTx) await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [f, checksum(sql)]
        );
        if (!noTx) await client.query('COMMIT');
        console.log('ok');
      } catch (err) {
        if (!noTx) await client.query('ROLLBACK').catch(() => {});
        console.log('FAILED');
        console.error(`\n${f}: ${err.message}\nStopped; nothing after this file was applied.`);
        process.exitCode = 1;
        return;
      }
    }
  } finally { await client.end(); }
}

async function baseline() {
  const to = argValue('--to');
  const client = await connect();
  try {
    const done = await applied(client);
    let n = 0;
    for (const f of listFiles()) {
      if (done.has(f) || !withinTarget(f, to)) continue;
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum, baseline) VALUES ($1, $2, TRUE)',
        [f, checksum(readFileSync(join(DIR, f), 'utf8'))]
      );
      n++;
    }
    console.log(`Marked ${n} file(s) as applied (baseline${to ? ` through ${to}` : ''}).`);
  } finally { await client.end(); }
}

const cmd = process.argv[2] || 'status';
const commands = { status, up, baseline, lint };
if (!commands[cmd]) {
  console.error(`Unknown command "${cmd}". Use: status | up [--to N] | baseline [--to N] | lint`);
  process.exit(1);
}
await commands[cmd]();
