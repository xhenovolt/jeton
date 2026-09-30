/**
 * Auth Utilities - Centralized Authentication Verification
 * Single source of truth for ALL API authentication
 * 
 * CRITICAL: All API routes should use this for consistency
 */

import { cookies } from 'next/headers.js';
import { NextResponse } from 'next/server';
import { getSession } from './session.js';
import { getUserScopeInfo } from './permissions.js';

/**
 * Verify authentication from request
 * Returns auth data or null if not authenticated
 * @param {Request} request - Next.js request object
 * @returns {Promise<{userId: string, email: string, role: string, is_superadmin: boolean} | null>}
 */
export async function verifyAuth(request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('jeton_session')?.value;

    if (!sessionId) {
      console.warn('[Auth] No session cookie found');
      return null;
    }

    const session = await getSession(sessionId);
    if (!session) {
      console.warn('[Auth] Session invalid or expired:', sessionId);
      return null;
    }

    const isSuperadmin = session.user.role === 'superadmin';
    // Fetch data scope (non-blocking, default to GLOBAL for superadmin)
    let dataScope = 'GLOBAL';
    let departmentId = null;
    if (!isSuperadmin) {
      try {
        const scopeInfo = await getUserScopeInfo(session.userId);
        dataScope = scopeInfo.dataScope;
        departmentId = scopeInfo.departmentId;
      } catch { /* non-fatal */ }
    }

    return {
      userId: session.userId,
      email: session.user.email,
      role: session.user.role,
      is_superadmin: isSuperadmin,
      status: session.user.status,
      dataScope,
      departmentId,
    };
  } catch (error) {
    // Bubble DB-down so the API route can return a clean 503 instead of
    // pretending the user is unauthenticated.
    if (error?.name === 'DatabaseUnavailableError') {
      throw error;
    }
    console.error('[Auth] Verification failed:', error.message);
    return null;
  }
}

/**
 * Require authentication on API routes
 * Use this in API routes that need auth
 * @param {Request} request - Next.js request object
 * @returns {Promise<{userId: string, email: string, role: string, is_superadmin: boolean}>}
 * @throws {Response} 401 if not authenticated
 */
export async function requireAuth(request) {
  const authData = await verifyAuth(request);

  if (!authData) {
    const error = new Error('Unauthorized');
    error.status = 401;
    error.response = {
      success: false,
      error: 'Authentication required',
    };
    throw error;
  }

  return authData;
}

/**
 * Require admin role on API routes
 * @param {Request} request - Next.js request object
 * @returns {Promise<{userId: string, email: string, role: string, is_superadmin: boolean}>}
 * @throws {Response} 401 if not authenticated, 403 if not admin
 */
export async function requireAdmin(request) {
  const authData = await verifyAuth(request);

  if (!authData) {
    const error = new Error('Unauthorized');
    error.status = 401;
    error.response = {
      success: false,
      error: 'Authentication required',
    };
    throw error;
  }

  const isAdmin = authData.is_superadmin || authData.role === 'admin';

  if (!isAdmin) {
    const error = new Error('Forbidden');
    error.status = 403;
    error.response = {
      success: false,
      error: 'Admin privileges required',
    };
    throw error;
  }

  return authData;
}

/**
 * Require superadmin role on API routes
 * @param {Request} request - Next.js request object
 * @returns {Promise<{userId: string, email: string, role: string, is_superadmin: boolean}>}
 * @throws {Response} 401 if not authenticated, 403 if not superadmin
 */
export async function requireSuperAdmin(request) {
  const authData = await verifyAuth(request);

  if (!authData) {
    const error = new Error('Unauthorized');
    error.status = 401;
    error.response = {
      success: false,
      error: 'Authentication required',
    };
    throw error;
  }

  if (!authData.is_superadmin) {
    const error = new Error('Forbidden');
    error.status = 403;
    error.response = {
      success: false,
      error: 'Superadmin privileges required',
    };
    throw error;
  }

  return authData;
}

/**
 * Route-handler friendly superadmin gate.
 * Returns the auth object on success, or a NextResponse (401/403) the caller
 * should return as-is:
 *
 *   const gate = await guardSuperAdmin(request);
 *   if (gate instanceof NextResponse) return gate;
 */
export async function guardSuperAdmin(request) {
  const authData = await verifyAuth(request);
  if (!authData) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  if (!authData.is_superadmin) {
    return NextResponse.json({ success: false, error: 'Superadmin privileges required' }, { status: 403 });
  }
  return authData;
}

export default {
  verifyAuth,
  guardSuperAdmin,
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
};
