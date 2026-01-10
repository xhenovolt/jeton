/**
 * API Authentication Utilities
 * Helper functions for protecting API routes with session-based auth
 */

import { cookies } from 'next/headers.js';
import { NextResponse } from 'next/server.js';
import { getSession } from './session.js';

/**
 * Extract and validate session from request
 * Returns user info or null if not authenticated
 * @returns {Promise<Object|null>} User object or null
 */
export async function getApiAuthUser() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('jeton_session')?.value;

    if (!sessionId) {
      return null;
    }

    const session = await getSession(sessionId);
    if (!session) {
      return null;
    }

    return {
      userId: session.userId,
      email: session.user.email,
      role: session.user.role,
    };
  } catch (error) {
    console.error('API auth error:', error.message);
    return null;
  }
}

/**
 * Middleware for API routes - validates session and returns user
 * Use in API routes like: const user = await requireApiAuth();
 * @returns {Promise<Object>} User object
 * @throws {Object} Error object with status 401 if not authenticated
 */
export async function requireApiAuth() {
  const user = await getApiAuthUser();

  if (!user) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }

  return user;
}

/**
 * Require specific role for API access
 * @param {string|string[]} requiredRoles - Role(s) required
 * @returns {Promise<Object>} User object if authorized
 * @throws {Object} Error object with status 401 or 403
 */
export async function requireApiRole(requiredRoles) {
  const user = await requireApiAuth();

  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  if (!roles.includes(user.role)) {
    const error = new Error('Forbidden: Insufficient permissions');
    error.status = 403;
    throw error;
  }

  return user;
}

/**
 * Extract token from request for backward compatibility
 * (This is only for testing/migration purposes)
 */
export async function extractTokenFromRequest(request) {
  const cookieStore = await cookies();
  return cookieStore.get('jeton_session')?.value || null;
}

export default {
  getApiAuthUser,
  requireApiAuth,
  requireApiRole,
  extractTokenFromRequest,
};
