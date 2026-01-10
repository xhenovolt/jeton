/**
 * Client-side fetch utility
 * Automatically includes credentials for authentication
 */

/**
 * Fetch with automatic credential inclusion
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function fetchWithAuth(url, options = {}) {
  return fetch(url, {
    ...options,
    credentials: 'include', // Always include cookies
  });
}

export default fetchWithAuth;
