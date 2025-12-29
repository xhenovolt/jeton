/**
 * Audit Logging System
 * Tracks all security-relevant events for compliance and debugging
 */

import { query } from './db.js';

/**
 * Valid audit actions
 */
const VALID_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  TOKEN_VALIDATION_FAILURE: 'TOKEN_VALIDATION_FAILURE',
  PROTECTED_ROUTE_ACCESS: 'PROTECTED_ROUTE_ACCESS',
  ROUTE_DENIED: 'ROUTE_DENIED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  ASSET_CREATE: 'ASSET_CREATE',
  ASSET_CREATE_DENIED: 'ASSET_CREATE_DENIED',
  ASSET_UPDATE: 'ASSET_UPDATE',
  ASSET_UPDATE_DENIED: 'ASSET_UPDATE_DENIED',
  ASSET_DELETE: 'ASSET_DELETE',
  ASSET_DELETE_DENIED: 'ASSET_DELETE_DENIED',
  LIABILITY_CREATE: 'LIABILITY_CREATE',
  LIABILITY_CREATE_DENIED: 'LIABILITY_CREATE_DENIED',
  LIABILITY_UPDATE: 'LIABILITY_UPDATE',
  LIABILITY_UPDATE_DENIED: 'LIABILITY_UPDATE_DENIED',
  LIABILITY_DELETE: 'LIABILITY_DELETE',
  LIABILITY_DELETE_DENIED: 'LIABILITY_DELETE_DENIED',
  DEAL_CREATE: 'DEAL_CREATE',
  DEAL_CREATE_DENIED: 'DEAL_CREATE_DENIED',
  DEAL_UPDATE: 'DEAL_UPDATE',
  DEAL_UPDATE_DENIED: 'DEAL_UPDATE_DENIED',
  DEAL_DELETE: 'DEAL_DELETE',
  DEAL_DELETE_DENIED: 'DEAL_DELETE_DENIED',
  DEAL_STAGE_CHANGE: 'DEAL_STAGE_CHANGE',
  DEAL_STAGE_CHANGE_DENIED: 'DEAL_STAGE_CHANGE_DENIED',
};

/**
 * Log an audit event
 * @param {Object} params - Audit log parameters
 * @param {string} params.action - Action type (from VALID_ACTIONS)
 * @param {string} params.entity - Entity type (e.g., 'USER', 'AUTH')
 * @param {string} [params.entityId] - ID of the entity affected
 * @param {string} [params.actorId] - User ID who performed the action
 * @param {Object} [params.metadata] - Additional context as JSON
 * @param {string} [params.ipAddress] - IP address of the request
 * @param {string} [params.userAgent] - User agent of the request
 * @param {string} [params.status] - 'SUCCESS' or 'FAILURE'
 * @returns {Promise<Object|null>} Audit log record or null on error
 */
export async function logAudit({
  action,
  entity,
  entityId = null,
  actorId = null,
  metadata = {},
  ipAddress = null,
  userAgent = null,
  status = 'SUCCESS',
}) {
  try {
    // Validate action
    if (!VALID_ACTIONS[action]) {
      console.error(`Invalid audit action: ${action}`);
      return null;
    }

    // Validate status
    if (!['SUCCESS', 'FAILURE'].includes(status)) {
      console.error(`Invalid audit status: ${status}`);
      return null;
    }

    const result = await query(
      `INSERT INTO audit_logs (
        action,
        entity,
        entity_id,
        actor_id,
        metadata,
        ip_address,
        user_agent,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        action,
        entity,
        entityId,
        actorId,
        JSON.stringify(metadata),
        ipAddress,
        userAgent,
        status,
      ]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Audit logging error:', error.message);
    return null;
  }
}

/**
 * Extract request metadata from Next.js request
 * @param {Object} request - Next.js request object
 * @returns {Object} Extracted metadata (IP, user agent)
 */
export function extractRequestMetadata(request) {
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    request.ip ||
    'unknown';

  const userAgent = request.headers.get('user-agent') || 'unknown';

  return { ipAddress, userAgent };
}

/**
 * Convenience method to log authentication events
 * @param {Object} params - Auth log parameters
 * @param {string} params.action - AUTH action (LOGIN_SUCCESS, LOGIN_FAILURE, etc.)
 * @param {string} [params.userId] - User ID if applicable
 * @param {string} [params.email] - Email for failed login attempts
 * @param {string} [params.reason] - Reason for failure (if applicable)
 * @param {Object} [params.requestMetadata] - IP and user agent
 * @returns {Promise<Object|null>} Audit log or null
 */
export async function logAuthEvent({
  action,
  userId = null,
  email = null,
  reason = null,
  requestMetadata = {},
}) {
  return logAudit({
    action,
    entity: 'AUTH',
    entityId: userId,
    actorId: userId,
    metadata: {
      email,
      reason,
    },
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
    status: action.includes('FAILURE') ? 'FAILURE' : 'SUCCESS',
  });
}

/**
 * Convenience method to log route access events
 * @param {Object} params - Route access parameters
 * @param {string} params.action - PROTECTED_ROUTE_ACCESS or ROUTE_DENIED
 * @param {string} params.route - Route path
 * @param {string} [params.userId] - User ID if authenticated
 * @param {string} [params.reason] - Reason for denial (if applicable)
 * @param {Object} [params.requestMetadata] - IP and user agent
 * @returns {Promise<Object|null>} Audit log or null
 */
export async function logRouteAccess({
  action,
  route,
  userId = null,
  reason = null,
  requestMetadata = {},
}) {
  return logAudit({
    action,
    entity: 'ROUTE',
    entityId: route,
    actorId: userId,
    metadata: { reason },
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
    status: action === 'ROUTE_DENIED' ? 'FAILURE' : 'SUCCESS',
  });
}

export { VALID_ACTIONS };

export default {
  logAudit,
  logAuthEvent,
  logRouteAccess,
  extractRequestMetadata,
  VALID_ACTIONS,
};
