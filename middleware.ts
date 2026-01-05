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
  '/dashboard',
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
];

// Routes that are only for unauthenticated users
const AUTH_ONLY_ROUTES = ['/login', '/register'];

/**
 * Extract session ID from cookie
 * Edge-safe: only reads cookie, no parsing or verification
 */
function getSessionCookie(request: NextRequest): string | null {
  const sessionCookie = request.cookies.get('jeton_session')?.value;
  return sessionCookie || null;
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

  // Protected routes: require session cookie to exist
  if (isProtectedRoute(pathname)) {
    if (!hasSessionCookie) {
      // Redirect to login if no session cookie
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Session cookie exists - allow access
    // Full validation happens in API routes and server components
    return NextResponse.next();
  }

  // Auth-only routes: redirect away if session exists
  if (isAuthOnlyRoute(pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
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
