/**
 * Authentication Utilities
 * Password hashing, user lookup, and user creation
 */

import bcrypt from 'bcryptjs';
import { query } from './db.js';

const SALT_ROUNDS = 10;

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Password hash
 * @returns {Promise<boolean>} True if password matches
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User object or null
 */
export async function findUserByEmail(email) {
  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by email:', error.message);
    return null;
  }
}

/**
 * Find user by ID
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<Object|null>} User object or null
 */
export async function findUserById(userId) {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by ID:', error.message);
    return null;
  }
}

/**
 * Create a new user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.passwordHash - Hashed password
 * @param {string} [userData.role] - User role (default: 'FOUNDER')
 * @param {string} [userData.firstName] - First name
 * @param {string} [userData.lastName] - Last name
 * @returns {Promise<Object|null>} Created user or null on error
 */
export async function createUser({
  email,
  passwordHash,
  role = 'FOUNDER',
  firstName = null,
  lastName = null,
}) {
  try {
    const result = await query(
      `INSERT INTO users (email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, email, role, is_active, created_at`,
      [email, passwordHash, role]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error creating user:', error.message);
    if (error.code === '23505') {
      // Unique violation
      return { error: 'Email already exists' };
    }
    return null;
  }
}

/**
 * Update user's last login timestamp
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if successful
 */
export async function updateUserLastLogin(userId) {
  try {
    const result = await query(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [userId]
    );
    return !!result.rows[0];
  } catch (error) {
    console.error('Error updating last login:', error.message);
    return false;
  }
}

/**
 * Verify user credentials (email and password)
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @returns {Promise<Object|null>} User object or null if invalid
 */
export async function verifyCredentials(email, password) {
  try {
    const user = await findUserByEmail(email);

    if (!user) {
      return null;
    }

    if (!user.is_active) {
      return null;
    }

    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return null;
    }

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    console.error('Error verifying credentials:', error.message);
    return null;
  }
}

export default {
  hashPassword,
  comparePassword,
  findUserByEmail,
  findUserById,
  createUser,
  updateUserLastLogin,
  verifyCredentials,
};
