/**
 * Middleware - Edge Runtime Safe
 * 
 * PURE EDGE LOGIC ONLY:
 * - Reads cookies
 * - Validates session existence (cookie presence only)
 * - Redirects unauthenticated users
 * - NO database access, NO crypto, NO Node-only APIs
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/app',
  '/assets',
  '/liabilities',
  '/deals',
  '/pipeline',
  '/reports',
  '/staff',
  '/settings',
  '/shares',
  '/infrastructure',
  '/intellectual-property',
  '/assets-accounting',
  '/equity',
  '/audit-logs',
  '/sales',
  '/admin',
];

// Routes that are only for unauthenticated users
const AUTH_ONLY_ROUTES = ['/login', '/register'];

// Route for forced first-login password reset (accessible while logged in)
const SETUP_PASSWORD_ROUTE = '/setup-password';

/**
 * Extract session ID from cookie
 * Edge-safe: only reads cookie, no parsing or verification
 */
function getSessionCookie(request: NextRequest): string | null {
  const sessionCookie = request.cookies.get('jeton_session')?.value;
  return sessionCookie || null;
}

/**
 * Check if user has a pending password reset
 */
function hasMustResetCookie(request: NextRequest): boolean {
  return request.cookies.get('jeton_must_reset')?.value === '1';
}

/**
 * Check if route requires authentication
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Check if route is auth-only (for unauthenticated users)
 */
function isAuthOnlyRoute(pathname: string): boolean {
  return AUTH_ONLY_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Edge-safe middleware - traffic gate only
 * 
 * Session validation happens in API routes, NOT middleware
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if session cookie exists (don't verify contents)
  const hasSessionCookie = !!getSessionCookie(request);

  // ── FORCED PASSWORD RESET GUARD ──────────────────────────────────────────
  // If the user has `jeton_must_reset=1`, block all app routes (except the
  // setup-password page itself) until the password has been changed.
  if (hasSessionCookie && hasMustResetCookie(request)) {
    if (!pathname.startsWith(SETUP_PASSWORD_ROUTE) && !pathname.startsWith('/api')) {
      return NextResponse.redirect(new URL(SETUP_PASSWORD_ROUTE, request.url));
    }
    return NextResponse.next();
  }

  // ── PROTECTED ROUTES ─────────────────────────────────────────────────────
  // Require session cookie to exist
  if (isProtectedRoute(pathname)) {
    if (!hasSessionCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // ── AUTH-ONLY ROUTES ─────────────────────────────────────────────────────
  // Redirect away if already logged in
  if (isAuthOnlyRoute(pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL('/app/dashboard', request.url));
  }

  // Public routes and API routes pass through
  return NextResponse.next();
}

/**
 * Matcher configuration
 * 
 * IMPORTANT: Exclude API routes to avoid middleware on API calls
 * Only match page routes that need protection
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes - validation happens in route handlers)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public (public assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
