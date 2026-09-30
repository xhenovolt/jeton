/**
 * WebAuthn / Passkeys — Server-Side Helpers
 *
 * Centralises all environment-aware config (rpId, origin) and provides
 * thin wrappers around the DB for challenge and credential management.
 *
 * Rules:
 *  - Challenges are stored in webauthn_challenges, TTL = 5 minutes.
 *  - We never store the private key — only the CBOR-encoded public key.
 *  - Counter is verified on every authentication to prevent replay attacks.
 *  - No JWT is ever issued; flow terminates in createSession().
 */

import { query } from './db.js';

// ─── Environment configuration ─────────────────────────────────────────────

/**
 * Work out the origin the browser is actually on, from the request.
 * Used only when WEBAUTHN_ORIGIN / WEBAUTHN_RP_ID are not configured.
 *
 * This is safe: the authenticator signs the real page origin into
 * clientDataJSON and scopes credentials to the rpId, so a request coming
 * from another site can never produce an assertion valid for this one.
 * Previously we fell back to NEXT_PUBLIC_APP_URL, which broke enrollment
 * on every preview / custom domain / LAN IP that didn't match it exactly
 * ("Registration failed" with no useful hint).
 */
function originFromRequest(request) {
  if (!request?.headers) return null;
  const origin = request.headers.get('origin');
  if (origin) return origin;
  const host  = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return null;
  const proto = request.headers.get('x-forwarded-proto')
    || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`;
}

/**
 * Return the Relying Party identifier (hostname only — no port, no scheme).
 * Priority: WEBAUTHN_RP_ID → request host → NEXT_PUBLIC_APP_URL → localhost.
 */
export function getRpId(request) {
  if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID;
  const fromReq = originFromRequest(request);
  if (fromReq) {
    try { return new URL(fromReq).hostname; } catch { /* ignore */ }
  }
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.API_URL || '';
  try { return new URL(url).hostname; } catch { /* ignore */ }
  return 'localhost';
}

/**
 * Return the origin(s) the authenticator is expected to sign.
 * WEBAUTHN_ORIGIN may be a comma-separated list (e.g. apex + www).
 * @returns {string|string[]}
 */
export function getRpOrigin(request) {
  if (process.env.WEBAUTHN_ORIGIN) {
    const list = process.env.WEBAUTHN_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);
    return list.length === 1 ? list[0] : list;
  }
  const fromReq = originFromRequest(request);
  if (fromReq) return fromReq;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return `http://localhost:${process.env.PORT || '3000'}`;
}

/** Human-readable name shown in the authenticator dialog. */
export function getRpName() {
  return process.env.WEBAUTHN_RP_NAME || 'Jeton';
}

// ─── Challenge helpers ──────────────────────────────────────────────────────

/**
 * Persist a challenge before sending it to the browser.
 * @param {Object} opts
 * @param {string}      opts.challenge   Base64url string
 * @param {'registration'|'authentication'} opts.type
 * @param {string|null} opts.userId      UUID (null for authenticate-options before user known)
 * @param {string|null} opts.ipAddress
 * @returns {Promise<void>}
 */
export async function saveChallenge({ challenge, type, userId = null, ipAddress = null }) {
  // Opportunistic cleanup so the table never grows unbounded.
  await query(`DELETE FROM webauthn_challenges WHERE expires_at < CURRENT_TIMESTAMP`).catch(() => {});
  // Clean up old challenges for this user+type first
  if (userId) {
    await query(
      `DELETE FROM webauthn_challenges WHERE user_id = $1 AND type = $2`,
      [userId, type]
    );
  }
  const result = await query(
    `INSERT INTO webauthn_challenges (user_id, type, challenge, ip_address)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, type, challenge, ipAddress]
  );
  return result.rows[0]?.id ?? null;
}

/** Cookie that binds an in-flight authentication challenge to one browser. */
export const CHALLENGE_COOKIE = 'jeton_webauthn_cid';

/**
 * Consume a specific challenge row by its id (consume-once).
 * This is the preferred path for the login flow: the id travels in an
 * httpOnly cookie, so a browser can only ever use the challenge it was
 * issued — not whichever anonymous challenge happens to be in the table.
 * @returns {Promise<string|null>}
 */
export async function consumeChallengeById({ id, type }) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const result = await query(
    `DELETE FROM webauthn_challenges
     WHERE id = $1 AND type = $2 AND expires_at > CURRENT_TIMESTAMP
     RETURNING challenge`,
    [id, type]
  );
  return result.rows[0]?.challenge ?? null;
}

/**
 * Retrieve and delete a valid challenge (consume-once pattern).
 * Returns null if challenge not found or expired.
 * @param {Object} opts
 * @param {string|null} opts.userId
 * @param {'registration'|'authentication'} opts.type
 * @returns {Promise<string|null>}
 */
export async function consumeChallenge({ userId, type }) {
  let result;
  if (userId) {
    result = await query(
      `DELETE FROM webauthn_challenges
       WHERE user_id = $1
         AND type    = $2
         AND expires_at > CURRENT_TIMESTAMP
       RETURNING challenge`,
      [userId, type]
    );
  } else {
    // Unauthenticated start (authenticate flow) — find any non-expired row of this type
    result = await query(
      `DELETE FROM webauthn_challenges
       WHERE user_id IS NULL
         AND type    = $1
         AND expires_at > CURRENT_TIMESTAMP
       RETURNING challenge`,
      [type]
    );
  }
  return result.rows[0]?.challenge ?? null;
}

// ─── Passkey CRUD ───────────────────────────────────────────────────────────

/**
 * Save a newly registered passkey.
 * @param {Object} opts
 * @param {string}   opts.userId
 * @param {string}   opts.credentialId   base64url
 * @param {Uint8Array|string} opts.publicKey  raw CBOR bytes or base64url
 * @param {number}   opts.counter
 * @param {string[]} opts.transports
 * @param {string}   opts.deviceName
 * @param {string}   [opts.aaguid]
 * @returns {Promise<Object>} Saved passkey row
 */
export async function savePasskey({
  userId,
  credentialId,
  publicKey,
  counter,
  transports,
  deviceName,
  aaguid,
}) {
  // Convert Uint8Array → base64url if needed
  const pubKeyStr = publicKey instanceof Uint8Array
    ? Buffer.from(publicKey).toString('base64url')
    : publicKey;

  const result = await query(
    `INSERT INTO auth_passkeys
       (user_id, credential_id, public_key, counter, device_name, transports, aaguid)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      credentialId,
      pubKeyStr,
      counter,
      deviceName,
      JSON.stringify(transports || []),
      aaguid || null,
    ]
  );
  return result.rows[0];
}

/**
 * Look up a passkey by credential ID.
 * @param {string} credentialId base64url
 * @returns {Promise<Object|null>}
 */
export async function getPasskeyByCredentialId(credentialId) {
  const result = await query(
    `SELECT ap.*, u.email, u.role, u.status
     FROM auth_passkeys ap
     JOIN users u ON u.id = ap.user_id
     WHERE ap.credential_id = $1`,
    [credentialId]
  );
  return result.rows[0] ?? null;
}

/**
 * Return all passkeys for a user (for display in Settings).
 * @param {string} userId
 * @returns {Promise<Object[]>}
 */
export async function getPasskeysByUserId(userId) {
  const result = await query(
    `SELECT id, credential_id, device_name, transports, created_at, last_used_at
     FROM auth_passkeys
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Update counter + last_used_at after successful authentication.
 * @param {string} credentialId base64url
 * @param {number} newCounter
 */
export async function updatePasskeyCounter(credentialId, newCounter) {
  await query(
    `UPDATE auth_passkeys
     SET counter = $2, last_used_at = CURRENT_TIMESTAMP
     WHERE credential_id = $1`,
    [credentialId, newCounter]
  );
}

/**
 * Rename a passkey device label.
 * Ownership check (userId) prevents users renaming other users' devices.
 * @param {string} passkeyId UUID PK
 * @param {string} userId
 * @param {string} deviceName
 */
export async function renamePasskey(passkeyId, userId, deviceName) {
  const result = await query(
    `UPDATE auth_passkeys
     SET device_name = $3
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [passkeyId, userId, deviceName]
  );
  return result.rowCount > 0;
}

/**
 * Delete (revoke) a specific passkey.
 * Ownership check enforced by userId.
 * @param {string} passkeyId UUID PK
 * @param {string} userId
 */
export async function deletePasskey(passkeyId, userId) {
  const result = await query(
    `DELETE FROM auth_passkeys
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [passkeyId, userId]
  );
  return result.rowCount > 0;
}

/** Purge challenges whose expires_at is in the past (maintenance). */
export async function cleanupExpiredChallenges() {
  await query(`DELETE FROM webauthn_challenges WHERE expires_at < CURRENT_TIMESTAMP`);
}
