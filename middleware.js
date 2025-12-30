/**
 * Middleware
 * Protects routes based on authentication and authorization
 */

import { NextResponse } from 'next/server.js';
import { verifyToken } from '@/lib/jwt.js';

/**
 * Routes that require authentication
 */
const PROTECTED_ROUTES = [
  '/app',
];

/**
 * Routes that are only for authenticated users
 */
const AUTH_ONLY_ROUTES = [
  '/login',
  '/register',
];

/**
 * Role-based route access
 * Maps routes to required roles
 */
const ROLE_BASED_ROUTES = {
  '/app': ['FOUNDER'], // Only founders can access /app for now
};

/**
 * Extract token from cookie header
 * Parses the Cookie header to find the auth-token
 */
function getTokenFromRequest(request) {
  // Try using request.cookies first (works in some environments)
  const cookieToken = request.cookies.get('auth-token')?.value;
  if (cookieToken) {
    console.log('✅ Token from request.cookies');
    return cookieToken;
  }

  // Fallback: manually parse from Cookie header (needed for Edge Runtime)
  const cookieHeader = request.headers.get('cookie') || '';
  console.log('📦 Cookie header received:', cookieHeader ? cookieHeader.substring(0, 50) + '...' : 'EMPTY');
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      acc[name] = decodeURIComponent(value);
    }
    return acc;
  }, {});

  const token = cookies['auth-token'] || null;
  console.log('🔑 Extracted token:', token ? token.substring(0, 50) + '...' : 'NULL');
  return token;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Get auth token from request
  const token = getTokenFromRequest(request);
  console.log('🚀 Middleware for:', pathname);
  console.log('🔐 JWT_SECRET available?', !!process.env.JWT_SECRET);
  
  const decoded = token ? verifyToken(token) : null;
  
  console.log('✔️ Token verification result:', {
    hasToken: !!token,
    hasDecoded: !!decoded,
    role: decoded?.role || 'NONE',
  });

  // Debug logging (temporary)
  if (pathname.startsWith('/app')) {
    console.log('🔍 Middleware Debug - /app access:', {
      pathname,
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenStart: token ? token.substring(0, 50) : 'NONE',
      hasDecoded: !!decoded,
      decodedRole: decoded?.role,
    });
  }

  // If accessing protected routes
  if (pathname.startsWith('/app')) {
    if (!token || !decoded) {
      console.log('❌ Redirecting to /login - missing token or decoded');
      // Redirect unauthenticated users to login
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check role-based access
    const requiredRoles = ROLE_BASED_ROUTES['/app'];
    if (requiredRoles && !requiredRoles.includes(decoded.role)) {
      console.log('❌ Redirecting to /login - unauthorized role:', decoded.role);
      // User doesn't have required role
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }
    
    console.log('✅ Allowing /app access');
  }

  // If accessing auth pages while authenticated
  if (AUTH_ONLY_ROUTES.some(route => pathname.startsWith(route))) {
    if (token && decoded) {
      console.log('➡️ Redirecting authenticated user from auth page to /app');
      // Redirect authenticated users away from auth pages
      return NextResponse.redirect(new URL('/app', request.url));
    }
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
