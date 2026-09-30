/**
 * Route-handler toolkit — the ONE way to write an API route.
 *
 *   export const POST = withRoute(
 *     { permission: 'deals.create', body: DealSchema },
 *     async ({ auth, body }) => ok(await createDeal(body, auth.userId), { status: 201 })
 *   );
 *
 * What it does, so each route doesn't have to:
 *   - authentication + authorization (permission | superadmin | public)
 *   - optional zod body validation → 400 with field errors
 *   - DatabaseUnavailableError → 503 + Retry-After
 *   - uncaught error → logged, 500 with a generic message (no stack leaks)
 *   - one response envelope: { success: true, data } | { success: false, error, code? }
 *
 * Options:
 *   permission  'module.action' — checked with requirePermission()
 *   signedIn    true            — any authenticated, active user
 *   superadmin  true            — superadmin only
 *   public      true            — no auth (must also be allowlisted in
 *                                  scripts/check-route-auth.mjs)
 *   body        zod schema      — parsed from request JSON
 *
 * The handler receives { request, params, auth, dataScope, departmentId, body }.
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions.js';
import { guardSuperAdmin, verifyAuth } from '@/lib/auth-utils.js';

/** Success envelope. */
export function ok(data = null, init = {}) {
  return NextResponse.json({ success: true, data }, init);
}

/** Error envelope. */
export function fail(status, error, code, extra = {}) {
  return NextResponse.json(
    { success: false, error, ...(code ? { code } : {}), ...extra },
    { status }
  );
}

function isDbDown(err) {
  return err?.name === 'DatabaseUnavailableError';
}

export function withRoute(options, handler) {
  const {
    permission, signedIn = false, superadmin = false, public: isPublic = false, body: schema,
  } = options || {};
  if (!isPublic && !permission && !superadmin && !signedIn) {
    // Fail at import time: a route must say how it is protected.
    throw new Error('withRoute: specify `permission`, `signedIn`, `superadmin` or `public`');
  }

  return async function routeHandler(request, context = {}) {
    try {
      let auth = null;
      let dataScope = null;
      let departmentId = null;

      if (superadmin) {
        const gate = await guardSuperAdmin(request);
        if (gate instanceof NextResponse) return gate;
        auth = gate;
      } else if (permission) {
        const perm = await requirePermission(request, permission);
        if (perm instanceof NextResponse) return perm;
        ({ auth, dataScope, departmentId } = perm);
      } else if (signedIn) {
        auth = await verifyAuth(request);
        if (!auth) return fail(401, 'Authentication required');
        if (auth.status === 'pending' || auth.status === 'suspended') {
          return fail(403, 'Your account is not active.');
        }
      } else if (isPublic) {
        // Public routes may still want to know who is calling.
        auth = await verifyAuth(request).catch(() => null);
      }

      let body;
      if (schema) {
        let raw;
        try {
          raw = await request.json();
        } catch {
          return fail(400, 'Request body must be valid JSON', 'INVALID_JSON');
        }
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
          return fail(400, parsed.error.issues[0]?.message || 'Invalid request', 'VALIDATION_ERROR', {
            issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
          });
        }
        body = parsed.data;
      }

      // Next 16: params is a Promise.
      const params = context?.params ? await context.params : {};

      return await handler({ request, params, auth, dataScope, departmentId, body });
    } catch (err) {
      if (isDbDown(err)) {
        return NextResponse.json(
          { success: false, error: 'Database temporarily unavailable. Please retry.', code: 'DB_UNAVAILABLE' },
          { status: 503, headers: { 'Retry-After': '3' } }
        );
      }
      console.error(`[api] ${request.method} ${new URL(request.url).pathname}:`, err);
      return fail(500, 'Internal server error', 'INTERNAL');
    }
  };
}
