import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db.js', () => ({ query: vi.fn(async () => ({ rows: [], rowCount: 0 })) }));
const { getRpId, getRpOrigin, consumeChallengeById } = await import('@/lib/passkeys.js');
const { query } = await import('@/lib/db.js');

const req = headers => ({ headers: new Headers(headers) });
const ENV = ['WEBAUTHN_RP_ID', 'WEBAUTHN_ORIGIN', 'NEXT_PUBLIC_APP_URL'];
let saved;

beforeEach(() => { saved = Object.fromEntries(ENV.map(k => [k, process.env[k]])); ENV.forEach(k => delete process.env[k]); });
afterEach(() => { ENV.forEach(k => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))); });

describe('WebAuthn relying-party resolution', () => {
  it('prefers explicit env configuration', () => {
    process.env.WEBAUTHN_RP_ID = 'jeton.example.com';
    process.env.WEBAUTHN_ORIGIN = 'https://jeton.example.com, https://www.jeton.example.com';
    expect(getRpId(req({ origin: 'https://evil.test' }))).toBe('jeton.example.com');
    expect(getRpOrigin()).toEqual(['https://jeton.example.com', 'https://www.jeton.example.com']);
  });

  it('falls back to the request origin (preview / custom domains)', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://prod.example.com';
    const r = req({ origin: 'https://preview-123.vercel.app' });
    expect(getRpId(r)).toBe('preview-123.vercel.app');
    expect(getRpOrigin(r)).toBe('https://preview-123.vercel.app');
  });

  it('reconstructs the origin from forwarded headers when Origin is absent', () => {
    const r = req({ 'x-forwarded-host': 'jeton.example.com', 'x-forwarded-proto': 'https' });
    expect(getRpOrigin(r)).toBe('https://jeton.example.com');
  });

  it('uses http for localhost', () => {
    expect(getRpOrigin(req({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
    expect(getRpId()).toBe('localhost');
  });
});

describe('consumeChallengeById', () => {
  it('rejects non-UUID cookie values without touching the DB', async () => {
    query.mockClear();
    expect(await consumeChallengeById({ id: "x' OR 1=1 --", type: 'authentication' })).toBeNull();
    expect(await consumeChallengeById({ id: undefined, type: 'authentication' })).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });
});
