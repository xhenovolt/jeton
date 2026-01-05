/**
 * Middleware
 * Protects routes based on session authentication
 * No JWT - all auth state derived from server-side sessions
 */

import { NextResponse } from 'next/server.js';
import pg from 'pg';

const { Pool } = pg;

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/assets',
  '/liabilities',
  '/deals',
  '/pipeline',
  '/reports',
  '/staff',
  '/settings',
  '/shares',
  '/app',
];

// Routes that are only for unauthenticated users
const AUTH_ONLY_ROUTES = [
  '/login',
  '/register',
];

// Role-based route access
const ROLE_BASED_ROUTES = {
  '/dashboard': ['FOUNDER', 'FINANCE', 'SALES', 'VIEWER'],
  '/assets': ['FOUNDER', 'FINANCE'],
  '/liabilities': ['FOUNDER', 'FINANCE'],
  '/deals': ['FOUNDER', 'SALES'],
  '/pipeline': ['FOUNDER', 'SALES'],
  '/reports': ['FOUNDER', 'FINANCE'],
  '/staff': ['FOUNDER'],
  '/settings': ['FOUNDER'],
  '/shares': ['FOUNDER', 'FINANCE'],
};

/**
 * Get database pool for middleware
 * Minimal pool configuration for edge runtime compatibility
 */
function getMiddlewarePool() {
  if (!global.middlewarePool) {
    global.middlewarePool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });
  }
  return global.middlewarePool;
}

/**
 * Validate session against database
 * @param {string} sessionId - Session ID from cookie
 * @returns {Promise<Object|null>} Session data with user info or null
 */
async function validateSession(sessionId) {
  if (!sessionId) {
    return null;
  }

  try {
    const pool = getMiddlewarePool();
    const result = await pool.query(
      `SELECT 
        s.id, 
        s.user_id, 
        s.expires_at,
        u.email,
        u.role,
        u.status
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1
       AND s.expires_at > CURRENT_TIMESTAMP
       AND u.status = 'active'`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      role: row.role,
    };
  } catch (error) {
    console.error('Session validation error:', error.message);
    return null;
  }
}

/**
 * Extract session ID from cookie header
 */
function getSessionFromRequest(request) {
  // Try request.cookies first
  const sessionId = request.cookies.get('jeton_session')?.value;
  if (sessionId) {
    return sessionId;
  }

  // Fallback: manually parse from Cookie header (needed for Edge Runtime)
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      acc[name] = decodeURIComponent(value);
    }
    return acc;
  }, {});

  return cookies['jeton_session'] || null;
}

/**
 * Check if route matches any protected route pattern
 */
function isProtectedRoute(pathname) {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Check if route matches any auth-only route pattern
 */
function isAuthOnlyRoute(pathname) {
  return AUTH_ONLY_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Check if user has required role for route
 */
function hasRequiredRole(pathname, userRole) {
  for (const [route, roles] of Object.entries(ROLE_BASED_ROUTES)) {
    if (pathname.startsWith(route)) {
      return roles.includes(userRole);
    }
  }
  return true;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Get session from cookie
  const sessionId = getSessionFromRequest(request);
  
  // Validate session
  const session = sessionId ? await validateSession(sessionId) : null;

  // If accessing protected routes
  if (isProtectedRoute(pathname)) {
    if (!session) {
      // Redirect unauthenticated users to login
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check role-based access
    if (!hasRequiredRole(pathname, session.role)) {
      // User doesn't have required role - redirect to login
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }

    // Allow access - attach user context to request
    const response = NextResponse.next();
    response.headers.set('x-user-id', session.userId);
    response.headers.set('x-user-email', session.email);
    response.headers.set('x-user-role', session.role);
    return response;
  }

  // If accessing auth pages while authenticated
  if (isAuthOnlyRoute(pathname) && session) {
    // Redirect authenticated users to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

/**
 * Configure which routes this middleware applies to
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
