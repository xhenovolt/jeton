#!/usr/bin/env node
/**
 * Jeton version bumper.
 *
 * Usage:
 *   node scripts/version.js patch "one-line reason"
 *   node scripts/version.js minor "new feature description"
 *   node scripts/version.js major "architectural rebuild summary"
 *
 * Effects:
 *   1. Reads VERSION.
 *   2. Bumps according to the level (patch|minor|major).
 *   3. Writes the new version to VERSION and package.json.
 *   4. Prepends an entry to CHANGELOG.md above older versions.
 *   5. Prints the new version to stdout (so CI can `read VERSION < VERSION`).
 *
 * Does NOT commit. The intent is for a commit hook or the operator to
 * decide when to commit — this script is a pure edit.
 *
 * Bump rules — enforce them yourself when choosing the level; this script
 * doesn't second-guess:
 *   - major: architectural rebuild / breaking change (comm module rewrite,
 *            invoice engine rebuild, session-model changes)
 *   - minor: new feature or module (a new dashboard, a new capability)
 *   - patch: bug fix, polish, copy change, additive idempotent migration
 */

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const VER_FILE = path.join(ROOT, 'VERSION');
const PKG_FILE = path.join(ROOT, 'package.json');
const CHG_FILE = path.join(ROOT, 'CHANGELOG.md');

const level  = (process.argv[2] || '').toLowerCase();
const reason = (process.argv.slice(3).join(' ') || '').trim();

if (!['patch', 'minor', 'major'].includes(level)) {
  console.error('Usage: node scripts/version.js <patch|minor|major> "reason"');
  process.exit(1);
}
if (!reason) {
  console.error('A reason is required so the CHANGELOG stays meaningful.');
  process.exit(1);
}

const current = fs.readFileSync(VER_FILE, 'utf8').trim();
const m = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!m) {
  console.error(`VERSION file has invalid contents: "${current}"`);
  process.exit(1);
}
let [_, maj, min, pat] = m.map(Number);

if (level === 'major')      { maj += 1; min = 0; pat = 0; }
else if (level === 'minor') { min += 1; pat = 0; }
else                        { pat += 1; }

const next = `${maj}.${min}.${pat}`;

// 1. VERSION
fs.writeFileSync(VER_FILE, next + '\n');

// 2. package.json (keep formatting stable — just swap the version string)
const pkgRaw = fs.readFileSync(PKG_FILE, 'utf8');
const pkgNew = pkgRaw.replace(
  /^(\s*"version":\s*)"[^"]+"/m,
  `$1"${next}"`
);
if (pkgNew === pkgRaw) {
  console.warn('package.json version line not found — check regex.');
} else {
  fs.writeFileSync(PKG_FILE, pkgNew);
}

// 3. CHANGELOG — prepend the new entry above the previous newest.
const today = new Date().toISOString().slice(0, 10);
const entry = `## ${next} — ${today} — ${reason}\n\n`;
const chg   = fs.readFileSync(CHG_FILE, 'utf8');
const marker = '\n## ';
const idx = chg.indexOf(marker);
const chgNew = idx === -1
  ? chg + '\n' + entry
  : chg.slice(0, idx + 1) + entry + chg.slice(idx + 1);
fs.writeFileSync(CHG_FILE, chgNew);

console.log(`${current} → ${next}`);
console.log(`Wrote VERSION, package.json, CHANGELOG.md`);
console.log('');
console.log('Next: review the diff, then commit:');
console.log(`  git add VERSION package.json CHANGELOG.md`);
console.log(`  git commit -m "chore(version): bump to ${next} — ${reason}"`);
