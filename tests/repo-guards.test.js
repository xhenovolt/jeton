import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

const run = script => execFileSync('node', [script], { encoding: 'utf8' });

describe('repository guard scripts', () => {
  it('every API route is guarded or explicitly public', () => {
    expect(run('scripts/check-route-auth.mjs')).toMatch(/✔/);
  });
  it('every page resolves to a permission or is explicitly open', () => {
    expect(run('scripts/check-route-registry.mjs')).toMatch(/✔/);
  });
  it('no database dumps are tracked', () => {
    expect(run('scripts/check-no-db-dumps.mjs')).toMatch(/✔/);
  });
});
