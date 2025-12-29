import pg from 'pg';
import * as env from './env.js';

const { Pool } = pg;

/**
 * PostgreSQL Connection Pool
 * Supports both local development and serverless environments (Neon)
 */
let pool = null;

/**
 * Initialize the database connection pool
 * @returns {Pool} PostgreSQL connection pool instance
 */
function initializePool() {
  if (pool) {
    return pool;
  }

  const connectionString = env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  pool = new Pool({
    connectionString,
    // Serverless-friendly configuration
    max: 10, // Max connections in pool
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 5000, // 5 seconds
  });

  // Handle pool errors
  pool.on('error', (error) => {
    console.error('Unexpected error on idle client', error);
  });

  return pool;
}

/**
 * Get a client from the pool and execute a query
 * @param {string} query - SQL query string
 * @param {Array} params - Query parameters (for parameterized queries)
 * @returns {Promise<any>} Query result
 */
export async function query(query, params = []) {
  const client = await getPool().connect();
  try {
    return await client.query(query, params);
  } finally {
    client.release();
  }
}

/**
 * Get the connection pool instance
 * Creates it if it doesn't exist
 * @returns {Pool} PostgreSQL connection pool
 */
export function getPool() {
  if (!pool) {
    initializePool();
  }
  return pool;
}

/**
 * Test the database connection
 * @returns {Promise<boolean>} true if connection successful
 */
export async function testConnection() {
  try {
    const result = await query('SELECT NOW()');
    return !!result.rows;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Close all connections in the pool
 * Useful for cleanup during graceful shutdown
 * @returns {Promise<void>}
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default {
  query,
  getPool,
  testConnection,
  closePool,
};
