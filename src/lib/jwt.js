/**
 * JWT Token Utilities
 * Handles token generation, verification, and cookie management
 */

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './env.js';

const TOKEN_EXPIRY = '7d'; // 7 days

/**
 * Generate a JWT token
 * @param {Object} payload - Token payload (e.g., { userId, email, role })
 * @param {string} expiresIn - Expiration time (default: 7d)
 * @returns {string} Signed JWT token
 */
export function generateToken(payload, expiresIn = TOKEN_EXPIRY) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256',
  });
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function verifyToken(token) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });
  } catch (error) {
    return null;
  }
}

/**
 * Decode a JWT token without verification (use with caution)
 * @param {string} token - JWT token to decode
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}

/**
 * Extract token from cookies
 * @param {Object} cookies - Cookies object from request
 * @returns {string|null} Token or null if not found
 */
export function getTokenFromCookies(cookies) {
  if (!cookies) return null;
  return cookies.get('auth-token')?.value || null;
}

/**
 * Generate cookie options for HTTP-only secure token
 * @returns {Object} Cookie options for Next.js response
 */
export function getSecureCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/',
  };
}

export default {
  generateToken,
  verifyToken,
  decodeToken,
  getTokenFromCookies,
  getSecureCookieOptions,
};
