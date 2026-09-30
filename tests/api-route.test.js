import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), verifyAuth: vi.fn(), guardSuperAdmin: vi.fn() }));
vi.mock('@/lib/permissions.js', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/lib/auth-utils.js', () => ({ verifyAuth: mocks.verifyAuth, guardSuperAdmin: mocks.guardSuperAdmin }));

const { withRoute, ok, fail } = await import('@/lib/api/route.js');
const { NextResponse } = await import('next/server');

const post = (body) => new Request('http://x/api/t', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

beforeEach(() => Object.values(mocks).forEach(m => m.mockReset()));

describe('withRoute', () => {
  it('refuses to build a route without a protection mode', () => {
    expect(() => withRoute({}, () => ok())).toThrow(/specify/);
  });

  it('returns the permission check response when denied', async () => {
    mocks.requirePermission.mockResolvedValue(NextResponse.json({ error: 'nope' }, { status: 403 }));
    const res = await withRoute({ permission: 'deals.view' }, () => ok('x'))(post({}));
    expect(res.status).toBe(403);
  });

  it('passes auth + scope to the handler and wraps data in the envelope', async () => {
    mocks.requirePermission.mockResolvedValue({ auth: { userId: 'u1' }, dataScope: 'OWN', departmentId: null });
    const res = await withRoute({ permission: 'deals.view' }, ({ auth, dataScope }) => ok({ id: auth.userId, dataScope }))(post({}));
    expect(await res.json()).toEqual({ success: true, data: { id: 'u1', dataScope: 'OWN' } });
  });

  it('signedIn: 401 without a session, 403 for suspended accounts', async () => {
    mocks.verifyAuth.mockResolvedValue(null);
    expect((await withRoute({ signedIn: true }, () => ok())(post({}))).status).toBe(401);
    mocks.verifyAuth.mockResolvedValue({ userId: 'u1', status: 'suspended' });
    expect((await withRoute({ signedIn: true }, () => ok())(post({}))).status).toBe(403);
  });

  it('validates the body with zod', async () => {
    mocks.verifyAuth.mockResolvedValue({ userId: 'u1', status: 'active' });
    const route = withRoute({ signedIn: true, body: z.object({ n: z.number() }) }, ({ body }) => ok(body.n * 2));
    const bad = await route(post({ n: 'x' }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe('VALIDATION_ERROR');
    expect((await route(post('{not json'))).status).toBe(400);
    expect(await (await route(post({ n: 21 }))).json()).toEqual({ success: true, data: 42 });
  });

  it('awaits Next 16 async params', async () => {
    mocks.verifyAuth.mockResolvedValue({ userId: 'u1', status: 'active' });
    const res = await withRoute({ signedIn: true }, ({ params }) => ok(params.id))(post({}), { params: Promise.resolve({ id: '7' }) });
    expect((await res.json()).data).toBe('7');
  });

  it('maps DatabaseUnavailableError to 503 and other errors to a generic 500', async () => {
    mocks.verifyAuth.mockResolvedValue({ userId: 'u1', status: 'active' });
    const dbDown = Object.assign(new Error('timeout'), { name: 'DatabaseUnavailableError' });
    const r1 = await withRoute({ signedIn: true }, () => { throw dbDown; })(post({}));
    expect(r1.status).toBe(503);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r2 = await withRoute({ signedIn: true }, () => { throw new Error('secret stack detail'); })(post({}));
    expect(r2.status).toBe(500);
    expect(JSON.stringify(await r2.json())).not.toContain('secret');
  });

  it('fail() produces the error envelope', async () => {
    const res = fail(404, 'Not found', 'NOT_FOUND');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: 'Not found', code: 'NOT_FOUND' });
  });
});
