#!/usr/bin/env node
/**
 * Route-auth guard check (CI).
 *
 * Fails if any src/app/api/**\/route.js exports a handler without calling one
 * of the recognised auth guards — unless the route is on the explicit PUBLIC
 * allowlist below, with a reason. This is what stops a new route from shipping
 * wide open (see docs/ARCHITECTURE_REVIEW_AND_ROADMAP.md, finding A1).
 *
 *   node scripts/check-route-auth.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const API_ROOT = 'src/app/api';

// Calls that count as "this handler authenticates the caller".
// Matched as real calls (`name(` / `name<suffix>(`) with comments stripped,
// so a guard mentioned in a comment does not count.
const GUARDS = [
  'requirePermission\\w*', 'verifyAuth', 'requireAuth', 'requireAdmin',
  'requireSuperAdmin', 'guardSuperAdmin', 'getCurrentUser\\w*', 'getSession', 'withRoute',
  // Machine-to-machine: verified by shared-secret signature, not a session.
  'verifyWebhook\\w*', 'verifyDraisSignature',
];
const GUARD_RE = new RegExp(`\\b(?:${GUARDS.join('|')})\\s*\\(`);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Routes that are intentionally public. Path is relative to src/app/api.
const PUBLIC = {
  'health':                              'uptime probe',
  'version':                             'build metadata',
  'auth/login':                          'sign-in',
  'auth/register':                       'sign-up',
  'auth/username-suggestions':           'used by the sign-up form',
  'auth/passkeys/authenticate-options':  'biometric sign-in, before a session exists',
  'auth/passkeys/authenticate':          'biometric sign-in, before a session exists',
  'pricing/system/[system]':             'public pricing feed',
  'profile/avatars':                     'static avatar catalogue',
  'assets':                              'deprecated stub, always 410',
  'resources':                           'deprecated stub, always 410',
};

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name === 'route.js' || name === 'route.ts') out.push(p);
  }
  return out;
}

const failures = [];
for (const file of walk(API_ROOT)) {
  const route = relative(API_ROOT, file).split(sep).slice(0, -1).join('/');
  if (route in PUBLIC) continue;
  // withRoute({ public: true }) is NOT a guard — such routes must be allowlisted.
  const src = stripComments(readFileSync(file, 'utf8'))
    .replace(/withRoute\(\s*\{[^}]*\bpublic\s*:\s*true[^}]*\}/g, '');
  if (!/export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b|export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/.test(src)) continue;
  if (!GUARD_RE.test(src)) failures.push(route);
}

if (failures.length) {
  console.error(`✖ ${failures.length} API route(s) have no auth guard:\n`);
  for (const f of failures) console.error(`  - src/app/api/${f}/route.js`);
  console.error('\nAdd requirePermission()/verifyAuth()/guardSuperAdmin(), or add the route to PUBLIC in scripts/check-route-auth.mjs with a reason.');
  process.exit(1);
}
console.log('✔ every API route is guarded or explicitly public');
