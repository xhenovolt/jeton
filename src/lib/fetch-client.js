/**
 * Client-side fetch utility.
 *
 * IMPORTANT: this does NOT return a Response.
 *
 * It returns the already-parsed JSON body. That is unusual enough to have
 * caused real bugs in both directions:
 *
 *   - Code written as `if (res.ok) { ...success... }` never ran its success
 *     branch, because `ok` did not exist on the parsed body and `undefined` is
 *     falsy. Buttons appeared to do nothing while the request had in fact
 *     succeeded (the tech-stack, designs and advances screens all had this).
 *
 *   - Code written as `if (!res.ok) { ...error... }` ALWAYS took its error
 *     branch for the same reason, reporting failure after a successful call
 *     and rendering messages like "HTTP undefined".
 *
 * Rather than change the return type and break ~150 existing callers, the
 * parsed body now carries the transport outcome as well:
 *
 *   httpOk      always present - true when the HTTP status was 2xx
 *   httpStatus  always present - the numeric HTTP status (0 if the request
 *               never completed)
 *   _ok, _status  retained aliases, previously the only way to read this
 *   ok, status    attached ONLY when the payload does not already define them
 *
 * `ok` and `status` are conditional on purpose: /api/health answers
 * `{ status: 'degraded' }` and /api/presence/ping answers
 * `{ ok: true, status: 'online' }`, and clobbering those would break callers
 * that legitimately read the payload field. New code should prefer httpOk and
 * httpStatus, which can never collide.
 *
 * A `.json()` shim is kept so the common
 *   `const res = await fetchWithAuth(url); const data = await res.json();`
 * pattern keeps working.
 */

/**
 * @param {string} url
 * @param {object} options - standard fetch options
 * @returns {Promise<object>} parsed body, annotated with httpOk / httpStatus
 */
export async function fetchWithAuth(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { ...options, credentials: 'include' });
  } catch (networkError) {
    // The request never reached the server. Returned in the same shape as
    // every other outcome so callers need only one code path.
    return annotate(
      { success: false, error: networkError?.message || 'Network request failed' },
      { ok: false, status: 0 }
    );
  }

  let data;
  try {
    data = await res.json();
  } catch {
    // Non-JSON body: a proxy error page, a redirect to HTML, or 204 No Content.
    return annotate(
      {
        success: res.ok,
        ...(res.ok ? {} : { error: `HTTP ${res.status}: ${res.statusText || 'request failed'}` }),
      },
      { ok: res.ok, status: res.status }
    );
  }

  if (data === null || typeof data !== 'object') {
    // A bare scalar cannot carry properties, so wrap it.
    return annotate({ success: res.ok, data }, { ok: res.ok, status: res.status });
  }

  // Arrays are returned AS the array, annotated, not wrapped in { data }.
  // Several endpoints answer with a bare list (/api/salary-accounts returns
  // result.rows), and their callers index the result directly, so wrapping it
  // would break them.
  return annotate(data, { ok: res.ok, status: res.status });
}

/**
 * Attach the transport outcome to a parsed body without destroying payload
 * fields that happen to be named `ok` or `status`.
 */
function annotate(data, { ok, status }) {
  // Unambiguous, always present.
  Object.defineProperty(data, 'httpOk', { value: ok, enumerable: false, configurable: true });
  Object.defineProperty(data, 'httpStatus', { value: status, enumerable: false, configurable: true });

  // Historical aliases, kept for existing callers.
  Object.defineProperty(data, '_ok', { value: ok, enumerable: false, configurable: true });
  Object.defineProperty(data, '_status', { value: status, enumerable: false, configurable: true });

  // Response-style names, only where the payload leaves them free.
  if (!('ok' in data)) {
    Object.defineProperty(data, 'ok', { value: ok, enumerable: false, configurable: true });
  }
  if (!('status' in data)) {
    Object.defineProperty(data, 'status', { value: status, enumerable: false, configurable: true });
  }

  // Lets `await res.json()` keep working on the returned object.
  if (typeof data.json !== 'function') {
    Object.defineProperty(data, 'json', {
      value: () => Promise.resolve(data),
      enumerable: false,
      configurable: true,
    });
  }

  return data;
}

/**
 * Did the call succeed, by both transport and application rules?
 *
 * Checks httpOk and then `success === false`, so an endpoint that answers
 * HTTP 200 with `{ success: false }` is still treated as a failure.
 */
export function requestOk(payload) {
  if (!payload) return false;
  if (payload.httpOk === false) return false;
  return payload.success !== false;
}

/** The best available error message, with the HTTP status as a last resort. */
export function requestError(payload, fallback = 'The request failed.') {
  if (!payload) return fallback;
  if (payload.error) return payload.error;
  if (payload.message) return payload.message;
  const status = payload.httpStatus;
  return status ? `${fallback} (HTTP ${status})` : fallback;
}

export default fetchWithAuth;
