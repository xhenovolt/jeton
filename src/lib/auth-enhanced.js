/**
 * Enhanced Authentication Utilities
 * Session management, permission checking, geolocation
 */

import { query } from './db.js';
import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';

/**
 * Create a new session for user
 * @param {string} userId - User ID
 * @param {string} tokenHash - Hashed session token
 * @param {string} userAgent - User agent string
 * @param {string} ipAddress - Client IP address
 * @returns {Promise<Object>} Session object
 */
export async function createSession(userId, tokenHash, userAgent, ipAddress) {
  try {
    // Parse user agent
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    // Get geolocation from IP
    const geoData = geoip.lookup(ipAddress);

    // Set token expiry to 30 days
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const sessionResult = await query(
      `INSERT INTO sessions (
        user_id, token_hash, device_name, browser, os,
        ip_address, country, city, user_agent, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, user_id, token_hash, device_name, browser, os,
                ip_address, country, city, expires_at, created_at`,
      [
        userId,
        tokenHash,
        result.device?.name || 'Unknown Device',
        `${result.browser?.name || 'Unknown'} ${result.browser?.version || ''}`.trim(),
        `${result.os?.name || 'Unknown'} ${result.os?.version || ''}`.trim(),
        ipAddress,
        geoData?.country || 'Unknown',
        geoData?.city || 'Unknown',
        userAgent,
        expiresAt,
      ]
    );

    return sessionResult.rows[0];
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}

/**
 * Get session by token hash
 * @param {string} tokenHash - Hashed token
 * @returns {Promise<Object|null>} Session object or null
 */
export async function getSessionByTokenHash(tokenHash) {
  try {
    const result = await query(
      `SELECT * FROM sessions
       WHERE token_hash = $1 AND is_active = true AND expires_at > NOW()`,
      [tokenHash]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Update session last activity
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
export async function updateSessionActivity(sessionId) {
  try {
    await query(
      `UPDATE sessions
       SET last_activity = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [sessionId]
    );
  } catch (error) {
    console.error('Error updating session activity:', error);
  }
}

/**
 * Get user permissions (role-based + overrides)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of permission names
 */
export async function getUserPermissions(userId) {
  try {
    // Get role-based permissions
    const rolePerms = await query(
      `SELECT DISTINCT p.name FROM role_permissions rp
       JOIN user_roles ur ON ur.role_id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1`,
      [userId]
    );

    // Get user-specific permission overrides
    const userPerms = await query(
      `SELECT p.name FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = $1
       AND (up.expires_at IS NULL OR up.expires_at > NOW())`,
      [userId]
    );

    const allPermissions = new Set();
    rolePerms.rows.forEach((row) => allPermissions.add(row.name));
    userPerms.rows.forEach((row) => allPermissions.add(row.name));

    return Array.from(allPermissions);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Check if user has permission
 * @param {string} userId - User ID
 * @param {string} permissionName - Permission name (e.g., 'assets.view')
 * @returns {Promise<boolean>} True if user has permission
 */
export async function hasPermission(userId, permissionName) {
  try {
    // Superadmins always have permission
    const superAdminCheck = await query(
      'SELECT is_superadmin FROM users WHERE id = $1',
      [userId]
    );

    if (superAdminCheck.rows[0]?.is_superadmin) {
      return true;
    }

    // Check user-specific permission override
    const userPermCheck = await query(
      `SELECT up.id FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = $1 AND p.name = $2
       AND (up.expires_at IS NULL OR up.expires_at > NOW())`,
      [userId, permissionName]
    );

    if (userPermCheck.rowCount > 0) {
      return true;
    }

    // Check role-based permissions
    const rolePermCheck = await query(
      `SELECT rp.id FROM role_permissions rp
       JOIN user_roles ur ON ur.role_id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1 AND p.name = $2`,
      [userId, permissionName]
    );

    return rolePermCheck.rowCount > 0;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Get user roles
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of role objects
 */
export async function getUserRoles(userId) {
  try {
    const result = await query(
      `SELECT r.id, r.name, r.description FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
}

/**
 * Log activity
 * @param {Object} activityData - {user_id, session_id, action_type, module, resource_type, resource_id, path, metadata, duration_ms}
 * @returns {Promise<void>}
 */
export async function logActivity(activityData) {
  try {
    const {
      user_id,
      session_id,
      action_type,
      module,
      resource_type,
      resource_id,
      path,
      metadata,
      duration_ms,
    } = activityData;

    await query(
      `INSERT INTO activity_logs (
        user_id, session_id, action_type, module, resource_type,
        resource_id, path, metadata, duration_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        user_id,
        session_id,
        action_type,
        module,
        resource_type,
        resource_id,
        path,
        metadata ? JSON.stringify(metadata) : null,
        duration_ms,
      ]
    );
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

/**
 * Log audit event
 * @param {Object} auditData - {actor_id, action, entity, entity_id, changes, ip_address, session_id, status}
 * @returns {Promise<void>}
 */
export async function logAudit(auditData) {
  try {
    const {
      actor_id,
      action,
      entity,
      entity_id,
      changes,
      ip_address,
      session_id,
      status = 'SUCCESS',
    } = auditData;

    await query(
      `INSERT INTO audit_logs (
        actor_id, action, entity, entity_id, changes,
        ip_address, session_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        actor_id,
        action,
        entity,
        entity_id,
        changes ? JSON.stringify(changes) : null,
        ip_address,
        session_id,
        status,
      ]
    );
  } catch (error) {
    console.error('Error logging audit:', error);
  }
}

/**
 * Get user with full profile (for navbar)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User profile object
 */
export async function getUserProfile(userId) {
  try {
    const result = await query(
      `SELECT 
        u.id, u.email, u.username, u.full_name, u.profile_photo_url,
        u.status, u.is_superadmin, u.department, u.last_seen,
        ARRAY_AGG(DISTINCT r.name) as roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const user = result.rows[0];

    // Get permissions
    const permissions = await getUserPermissions(userId);

    return {
      ...user,
      permissions,
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

/**
 * Get online users for admin dashboard
 * @returns {Promise<Array>} Array of online users
 */
export async function getOnlineUsers() {
  try {
    const result = await query(
      `SELECT DISTINCT ON (s.user_id)
        u.id, u.username, u.full_name, u.profile_photo_url,
        s.device_name, s.browser, s.last_activity, s.country, s.city
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.is_active = true AND s.expires_at > NOW()
       ORDER BY s.user_id, s.last_activity DESC`
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting online users:', error);
    return [];
  }
}
