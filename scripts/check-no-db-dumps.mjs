#!/usr/bin/env node
/**
 * Fails if a database dump / backup is tracked by git (CI + pre-push).
 *
 * Two layers: file names that look like dumps, and SQL files (outside
 * migrations/) whose content looks like pg_dump data output. Committed
 * backups of the production database leaked real user and financial data
 * once — this keeps it from happening again.
 *
 *   node scripts/check-no-db-dumps.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);

const NAME_RE = /(^|\/)(backups?\/.*\.sql|[^/]*(backup|dump)[^/]*\.sql|[^/]*\.(dump|backup|bak))$/i;
// pg_dump data markers: COPY ... FROM stdin, or a dump header.
const CONTENT_RE = /^COPY [\w."]+ \(.*\) FROM stdin;|^-- PostgreSQL database dump/m;

const offenders = [];
for (const file of tracked) {
  if (file.startsWith('migrations/')) continue;
  if (NAME_RE.test(file)) { offenders.push(`${file}  (file name looks like a dump)`); continue; }
  if (file.endsWith('.sql')) {
    try {
      if (statSync(file).size > 0 && CONTENT_RE.test(readFileSync(file, 'utf8'))) {
        offenders.push(`${file}  (contains pg_dump output)`);
      }
    } catch { /* deleted in working tree */ }
  }
}

if (offenders.length) {
  console.error('✖ Database dumps must never be committed:\n');
  for (const o of offenders) console.error(`  - ${o}`);
  console.error('\nRemove them (git rm --cached <file>) and keep dumps outside the repository.');
  process.exit(1);
}
console.log('✔ no database dumps are tracked');
