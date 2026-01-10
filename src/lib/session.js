/**
 * Session Management Utilities
 * Handles server-side session creation, validation, and cleanup
 */

import { randomUUID } from 'crypto';
import { query } from './db.js';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Create a new session for a user
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<string>} Session ID
 */
export async function createSession(userId) {
  try {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);

    await query(
      `INSERT INTO sessions (id, user_id, expires_at, created_at, last_activity)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [sessionId, userId, expiresAt]
    );

    return sessionId;
  } catch (error) {
    console.error('Error creating session:', error.message);
    throw error;
  }
}

/**
 * Get session data from session ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Session data with user info or null if invalid/expired
 */
export async function getSession(sessionId) {
  try {
    const result = await query(
      `SELECT 
        s.id, 
        s.user_id, 
        s.expires_at, 
        s.created_at,
        s.last_activity,
        u.id,
        u.email,
        u.role,
        u.status
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1
       AND s.expires_at > CURRENT_TIMESTAMP`,
      [sessionId]
    );

    if (!result.rows[0]) {
      return null;
    }

    const sessionRow = result.rows[0];
    
    // Update last activity
    await updateSessionActivity(sessionId);

    return {
      id: sessionRow.id,
      userId: sessionRow.user_id,
      expiresAt: sessionRow.expires_at,
      user: {
        id: sessionRow.user_id,
        email: sessionRow.email,
        role: sessionRow.role,
        status: sessionRow.status,
      },
    };
  } catch (error) {
    console.error('Error getting session:', error.message);
    return null;
  }
}

/**
 * Update session last activity timestamp
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
export async function updateSessionActivity(sessionId) {
  try {
    const sessionResult = await query(
      `UPDATE sessions 
       SET last_activity = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING user_id`,
      [sessionId]
    );

    // Also update user's last_seen timestamp
    if (sessionResult.rows[0]?.user_id) {
      await updateUserLastSeen(sessionResult.rows[0].user_id);
    }
  } catch (error) {
    console.error('Error updating session activity:', error.message);
  }
}

/**
 * Update user's last_seen timestamp and online status
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function updateUserLastSeen(userId) {
  try {
    // Try to update both last_seen and is_online columns
    // If they don't exist yet, the error will be caught and logged
    await query(
      `UPDATE users 
       SET last_seen = CURRENT_TIMESTAMP,
           is_online = true
       WHERE id = $1`,
      [userId]
    );
  } catch (error) {
    // Column might not exist yet if migration hasn't run
    // This is safe to ignore during migration period
    if (error.code === '42703') {
      // Column does not exist error - migration not run yet
      return;
    }
    console.error('Error updating user last_seen:', error.message);
  }
}

/**
 * Delete a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
export async function deleteSession(sessionId) {
  try {
    await query(
      `DELETE FROM sessions WHERE id = $1`,
      [sessionId]
    );
  } catch (error) {
    console.error('Error deleting session:', error.message);
    throw error;
  }
}

/**
 * Delete all sessions for a user (logout all devices)
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function deleteAllUserSessions(userId) {
  try {
    await query(
      `DELETE FROM sessions WHERE user_id = $1`,
      [userId]
    );
  } catch (error) {
    console.error('Error deleting all user sessions:', error.message);
    throw error;
  }
}

/**
 * Clean up expired sessions from database (maintenance)
 * @returns {Promise<number>} Number of deleted sessions
 */
export async function cleanupExpiredSessions() {
  try {
    const result = await query(
      `DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP`
    );
    return result.rowCount || 0;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error.message);
    return 0;
  }
}

/**
 * Get secure cookie options for HTTP-only session cookie
 * @returns {Object} Cookie options for Next.js response
 */
export function getSecureCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true, // Not accessible via JavaScript
    secure: isProduction, // HTTPS only in production
    sameSite: 'lax', // CSRF protection
    maxAge: SESSION_DURATION / 1000, // Convert ms to seconds for maxAge
    path: '/',
  };
}

/**
 * Extract session ID from cookie header
 * @param {Object} cookies - Cookies object from request
 * @returns {string|null} Session ID or null if not found
 */
export function getSessionFromCookies(cookies) {
  if (!cookies) return null;
  return cookies.get('jeton_session')?.value || null;
}

export default {
  createSession,
  getSession,
  updateSessionActivity,
  deleteSession,
  deleteAllUserSessions,
  cleanupExpiredSessions,
  getSecureCookieOptions,
  getSessionFromCookies,
};
