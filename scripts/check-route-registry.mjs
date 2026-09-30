#!/usr/bin/env node
/**
 * Route-registry check (CI).
 *
 * Every page under src/app/app must either resolve to a permission through
 * lib/navigation-config.js (menu entry, EXTRA_ROUTE_PERMISSIONS, or a parent
 * path) or be listed in OPEN_ROUTES. A page that resolves to neither has no
 * client-side gate at all, which is how pages like /app/admin/identity and
 * company settings ended up open to every role.
 *
 *   node scripts/check-route-registry.mjs
 */

import { readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const nav = await import(pathToFileURL(join(process.cwd(), 'src/lib/navigation-config.js')).href);
const ROOT = join('src', 'app', 'app');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/^page\.(js|jsx|ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const missing = [];
for (const file of walk(ROOT)) {
  const rel = file.slice(ROOT.length).split(sep).slice(0, -1).join('/');
  const route = '/app' + rel;
  // Dynamic segments ([id]) resolve through their parent path.
  const probe = route.replace(/\/\[[^\]]+\]/g, '/_');
  if (nav.isOpenRoute(route)) continue;
  if (nav.getRoutePermission(probe)) continue;
  missing.push(route);
}

if (missing.length) {
  console.error(`✖ ${missing.length} page(s) resolve to no permission and are not in OPEN_ROUTES:\n`);
  for (const m of missing) console.error(`  - ${m}`);
  console.error('\nAdd them to the menu, EXTRA_ROUTE_PERMISSIONS or OPEN_ROUTES in src/lib/navigation-config.js.');
  process.exit(1);
}
console.log('✔ every page resolves to a permission or is explicitly open');
