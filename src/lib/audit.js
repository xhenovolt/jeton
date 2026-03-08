/**
 * Audit logging utility
 * Logs events to the audit_logs table
 */
import { query } from '@/lib/db.js';

/**
 * Log an authentication event
 */
export async function logAuthEvent(action, userId, details = {}, metadata = {}) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId || null, action, 'session', userId || null, JSON.stringify({ ...details, ...metadata })]
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

/**
 * Log a route access event
 */
export async function logRouteAccess(route, userId, metadata = {}) {
  // Route access logging is optional/lightweight - just log to console in dev
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AUDIT] Route access: ${route} by user ${userId}`);
  }
}

/**
 * Extract request metadata for audit logging
 */
export function extractRequestMetadata(request) {
  return {
    ip: request.headers?.get('x-forwarded-for') || request.headers?.get('x-real-ip') || 'unknown',
    userAgent: request.headers?.get('user-agent') || 'unknown',
    url: request.url || '',
  };
}
