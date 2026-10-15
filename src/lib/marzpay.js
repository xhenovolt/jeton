/**
 * MarzPay (https://wallet.wearemarz.com) — server-side only.
 *
 * Modelled on ../drais-main/src/lib/payments/marzpay.ts, with one deliberate
 * difference: DRAIS reads credentials from the environment, which binds a
 * deployment to a single MarzPay account. Here the `marzpay_accounts` table is
 * the canonical store and the environment is only a bootstrap fallback, so
 * extra accounts are added through the UI with no redeploy.
 *
 * CREDENTIAL RULES
 *   - Secrets are decrypted into local variables for the duration of one call.
 *   - Nothing in this module returns or logs credential material.
 *   - Callers receive account metadata plus `api_key_masked`, never a secret.
 *
 * CAPABILITIES, as verified against the live API rather than assumed:
 *   GET  /collect-money/services   providers available for collection
 *   POST /collect-money            start a collection (customer is prompted)
 *   GET  /collect-money/{uuid}     authoritative status of a collection
 *   GET  /transactions             transaction list + account.current_balance
 *   GET  /send-money/services      disbursement providers
 *   GET  /balance, /account        403 IP_WHITELIST_REQUIRED
 *
 * DO NOT enable MarzPay's IP whitelist for this deployment. Jeton runs on
 * Vercel, whose serverless functions egress from a rotating pool of IPs with
 * no stable address outside Enterprise static-IP. Whitelisting would let
 * requests succeed from whichever IP was registered and then start failing
 * with 403 the moment Vercel moved the function — intermittently breaking
 * live collections, which is far worse than not having /balance.
 *
 * Balance is therefore read from GET /transactions, which returns
 * data.account.current_balance and is NOT IP-restricted. That endpoint covers
 * everything /balance would have given us, so nothing is lost.
 */

import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { query, withTransaction } from '@/lib/db.js';
import { encryptSecret, decryptSecret, maskCredential } from '@/lib/encryption.js';
import { toE164Ug, COLLECTION_MIN_UGX, UG_PHONE_HINT } from '@/lib/phone-ug.js';

const DEFAULT_BASE = 'https://wallet.wearemarz.com/api/v1';
const TIMEOUT_MS = 25_000;

/** Columns that are safe to hand to a browser. Never includes ciphertext. */
export const PUBLIC_ACCOUNT_COLUMNS = `
  id, name, description, provider_account_uuid, environment, base_url,
  api_key_masked, is_active, is_default, verification_status,
  last_verified_at, last_error, last_synced_at,
  last_known_balance, last_known_currency, created_by, created_at, updated_at
`;

// ───────────────────────────────── accounts ─────────────────────────────────

export async function listAccounts() {
  const r = await query(
    `SELECT ${PUBLIC_ACCOUNT_COLUMNS} FROM marzpay_accounts
      ORDER BY is_default DESC, is_active DESC, name ASC`
  );
  return r.rows;
}

/**
 * The accounts, each with its balance read LIVE from MarzPay.
 *
 * last_known_balance exists on the row, but it is a cache: it is whatever the
 * balance was the last time something happened to call this. Showing it as
 * "balance" meant the screen reported USh 995 while the wallet actually held
 * USh 5 — Jeton stating a provider figure it had not checked. For anything
 * MarzPay owns, MarzPay is the only source of truth.
 *
 * Each account is queried concurrently. A failure degrades to the cached value
 * and is flagged `balance_is_live: false` with the time it was last read, so
 * the UI can say "cached" rather than present a stale number as current.
 */
export async function listAccountsLive({ concurrency = 4 } = {}) {
  const accounts = await listAccounts();

  const results = [];
  for (let i = 0; i < accounts.length; i += concurrency) {
    const slice = accounts.slice(i, i + concurrency);
    const settled = await Promise.all(slice.map(async (a) => {
      if (!a.is_active) {
        return { ...a, balance_is_live: false, balance_error: 'Account is inactive — not queried.' };
      }
      try {
        // Goes through the shared snapshot cache, so listing accounts costs no
        // provider call when the page has already read one in the last 20s.
        // Previously this made its own request per account, on every load and
        // every 60s tick, which is part of what MarzPay throttled.
        const t = await getProviderSnapshot(a.id);
        if (!t.ok) {
          return {
            ...a, balance_is_live: false, balance_error: t.error,
            rate_limited: !!t.rate_limited,
          };
        }
        return {
          ...a,
          balance_is_live: !t.cached,
          live_balance: t.balance ? Number(t.balance.raw) : null,
          live_balance_formatted: t.balance?.formatted ?? null,
          live_currency: t.balance?.currency ?? null,
          live_read_at: t.read_at,
          rate_limited: !!t.rate_limited,
          provider_account_uuid: t.account_uuid ?? a.provider_account_uuid,
        };
      } catch (err) {
        return {
          ...a,
          balance_is_live: false,
          balance_error: err.code === 'MARZPAY_UNDECRYPTABLE' ? err.message : 'Could not reach MarzPay.',
          balance_error_code: err.code ?? null,
        };
      }
    }));
    results.push(...settled);
  }
  return results;
}

export async function getAccountPublic(id) {
  const r = await query(
    `SELECT ${PUBLIC_ACCOUNT_COLUMNS} FROM marzpay_accounts WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

/**
 * Load an account WITH decrypted credentials. Internal use only — never return
 * the result of this from a route handler.
 *
 * Passing no id resolves the default account, then any single active account.
 */
async function loadCredentials(accountId = null) {
  const r = accountId
    ? await query(`SELECT * FROM marzpay_accounts WHERE id = $1 AND is_active = TRUE`, [accountId])
    : await query(
        `SELECT * FROM marzpay_accounts WHERE is_active = TRUE
          ORDER BY is_default DESC, created_at ASC LIMIT 1`);

  const row = r.rows[0];
  if (!row) return null;

  try {
    return {
      id: row.id,
      name: row.name,
      key: decryptSecret(row.api_key_encrypted),
      secret: decryptSecret(row.api_secret_encrypted),
      base: (row.base_url || DEFAULT_BASE).replace(/\/+$/, ''),
      webhookSecret: row.webhook_secret_encrypted
        ? decryptSecret(row.webhook_secret_encrypted)
        : null,
    };
  } catch (err) {
    // Decryption failed, which in practice means this deployment does not hold
    // the ENCRYPTION_KEY the ciphertext was written with. The credentials were
    // encrypted wherever the account was first created and the ciphertext
    // lives in the shared database, so any environment missing that exact key
    // cannot read it.
    //
    // Rather than leave MarzPay dead until an environment variable is copied
    // across and the app redeployed, fall back to the MARZPAY_* environment
    // credentials when they are present, and RE-ENCRYPT the row with the key
    // this deployment actually has. The next request then reads it from the
    // database normally — the problem repairs itself once rather than
    // recurring on every call.
    const fallback = envCredentials();
    if (fallback) {
      console.warn(
        `[marzpay] account "${row.name}" could not be decrypted with this ` +
        `deployment's ENCRYPTION_KEY; using MARZPAY_* environment credentials ` +
        `and re-encrypting the stored row so later requests do not need them.`
      );
      // Best effort: if this write fails the request still succeeds on the
      // fallback, it simply repeats the warning next time.
      try {
        await query(
          `UPDATE marzpay_accounts
              SET api_key_encrypted = $2, api_secret_encrypted = $3,
                  webhook_secret_encrypted = $4, api_key_masked = $5,
                  last_error = NULL, updated_at = NOW()
            WHERE id = $1`,
          [
            row.id,
            encryptSecret(fallback.key),
            encryptSecret(fallback.secret),
            fallback.webhookSecret ? encryptSecret(fallback.webhookSecret) : null,
            maskCredential(fallback.key),
          ]
        );
      } catch (healErr) {
        console.error('[marzpay] re-encryption failed:', healErr.message);
      }

      return {
        id: row.id,
        name: row.name,
        key: fallback.key,
        secret: fallback.secret,
        base: (row.base_url || fallback.base || DEFAULT_BASE).replace(/\/+$/, ''),
        webhookSecret: fallback.webhookSecret,
      };
    }

    // No fallback available. Record it on the row so the UI can show an
    // actionable state instead of only a transient toast, and raise an error
    // that says what to do.
    await query(
      `UPDATE marzpay_accounts SET last_error = $2, updated_at = NOW() WHERE id = $1`,
      [row.id, 'Stored credentials cannot be decrypted by this deployment.']
    ).catch(() => {});

    const e = new Error(
      `MarzPay account "${row.name}" cannot be decrypted by this deployment. ` +
      `Either set ENCRYPTION_KEY to the value used when the credentials were ` +
      `saved (and redeploy, since Vercel only picks up environment changes on ` +
      `a new deployment), or re-enter the API key and secret on this account — ` +
      `that re-encrypts them with the key this deployment has.`
    );
    e.code = 'MARZPAY_UNDECRYPTABLE';
    throw e;
  }
}

/**
 * Environment fallback, used only to seed the first account. Returns null once
 * the env vars are absent, which is the desired end state.
 */
export function envCredentials() {
  const key = process.env.MARZPAY_API_KEY?.trim();
  const secret = process.env.MARZPAY_API_SECRET?.trim();
  if (!key || !secret) return null;
  return {
    key, secret,
    base: (process.env.MARZPAY_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/+$/, ''),
    webhookSecret: process.env.MARZPAY_WEBHOOK_SECRET?.trim() || null,
  };
}

/** Insert an account, encrypting every credential on the way in. */
export async function createAccount({
  name, description = null, environment = 'live', base_url = DEFAULT_BASE,
  api_key, api_secret, webhook_secret = null, is_default = false, userId = null,
}) {
  if (!name?.trim()) throw new Error('name is required');
  if (!api_key?.trim() || !api_secret?.trim()) {
    throw new Error('api_key and api_secret are required');
  }

  const r = await query(
    `INSERT INTO marzpay_accounts
       (name, description, environment, base_url,
        api_key_encrypted, api_secret_encrypted, webhook_secret_encrypted,
        api_key_masked, is_default, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING ${PUBLIC_ACCOUNT_COLUMNS}`,
    [
      name.trim(), description, environment, (base_url || DEFAULT_BASE).replace(/\/+$/, ''),
      encryptSecret(api_key.trim()),
      encryptSecret(api_secret.trim()),
      webhook_secret?.trim() ? encryptSecret(webhook_secret.trim()) : null,
      maskCredential(api_key.trim()),
      !!is_default, userId,
    ]
  );
  return r.rows[0];
}

/**
 * Replace an account's credentials. This is what makes rotation a UI action
 * rather than a redeploy.
 */
export async function rotateCredentials(id, { api_key, api_secret, webhook_secret }) {
  const sets = [];
  const vals = [];
  if (api_key?.trim()) {
    vals.push(encryptSecret(api_key.trim())); sets.push(`api_key_encrypted = $${vals.length}`);
    vals.push(maskCredential(api_key.trim())); sets.push(`api_key_masked = $${vals.length}`);
  }
  if (api_secret?.trim()) {
    vals.push(encryptSecret(api_secret.trim())); sets.push(`api_secret_encrypted = $${vals.length}`);
  }
  if (webhook_secret !== undefined) {
    vals.push(webhook_secret?.trim() ? encryptSecret(webhook_secret.trim()) : null);
    sets.push(`webhook_secret_encrypted = $${vals.length}`);
  }
  if (!sets.length) throw new Error('No credentials supplied');

  // Changing credentials invalidates the previous verification.
  sets.push(`verification_status = 'unverified'`, `last_verified_at = NULL`, `last_error = NULL`,
            `updated_at = NOW()`);
  vals.push(id);
  const r = await query(
    `UPDATE marzpay_accounts SET ${sets.join(', ')} WHERE id = $${vals.length}
     RETURNING ${PUBLIC_ACCOUNT_COLUMNS}`, vals);
  return r.rows[0] || null;
}

/** Make one account the default, clearing the flag elsewhere first. */
export async function setDefaultAccount(id) {
  await query(`UPDATE marzpay_accounts SET is_default = FALSE WHERE id <> $1`, [id]);
  const r = await query(
    `UPDATE marzpay_accounts SET is_default = TRUE, updated_at = NOW() WHERE id = $1
     RETURNING ${PUBLIC_ACCOUNT_COLUMNS}`, [id]);
  return r.rows[0] || null;
}

// ────────────────────────────────── transport ───────────────────────────────

const authHeader = (c) => `Basic ${Buffer.from(`${c.key}:${c.secret}`).toString('base64')}`;

async function call(creds, method, path, body) {
  try {
    const res = await fetch(`${creds.base}${path}`, {
      method,
      headers: {
        Authorization: authHeader(creds),
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      json: { message: e?.name === 'TimeoutError' ? 'MarzPay did not answer in time' : (e?.message || 'Network error') },
    };
  }
}

/**
 * MarzPay's documented collection rules, learned by probing the live API
 * rather than assumed:
 *
 *   phone_number  must be E.164 WITH the country code, e.g. +256712345678.
 *                 A local "0741341483" is rejected outright — this is what
 *                 produced "Please check your input and try again."
 *   reference     must be a valid UUID. Any other string is rejected.
 *   country       required, e.g. UG.
 *   amount        minimum 500 UGX for a collection.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The phone and amount rules are shared with the browser, so they live in a
// client-safe module. Re-exported here so server callers that already import
// them from this module keep working.
export { toE164Ug, COLLECTION_MIN_UGX, UG_PHONE_HINT };

/** Turn a MarzPay error body into one short, non-sensitive sentence. */
function errorMessage(r) {
  // Rate limiting deserves its own wording: "Too Many Attempts. (REQUEST_ERROR)"
  // tells the reader nothing about what to do.
  if (isRateLimited(r)) {
    return 'MarzPay is rate limiting this account. Jeton has stopped calling it for a moment — ' +
           'the figures below are the last ones it returned.';
  }
  const m = r.json?.message || r.json?.error || `MarzPay returned HTTP ${r.status}`;

  // MarzPay returns a per-field `errors` object on a 422, and it is the only
  // part that says what is actually wrong. Without it the user saw
  // "Please check your input and try again. (VALIDATION_ERROR)", which names
  // no field and gives no remedy.
  const fields = r.json?.errors;
  if (fields && typeof fields === 'object') {
    const detail = Object.entries(fields)
      .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs[0] : msgs}`)
      .join(' · ');
    if (detail) return String(detail).slice(0, 400);
  }

  const code = r.json?.error_code;
  return String(code ? `${m} (${code})` : m).slice(0, 400);
}

/** MarzPay throttles with HTTP 429 and/or "Too Many Attempts." */
function isRateLimited(r) {
  return r.status === 429 || /too many attempts/i.test(String(r.json?.message ?? ''));
}

// ─────────────────────────── provider read cache ────────────────────────────
//
// WHY THIS EXISTS
//
// Reading provider state live is right, but the page was doing it per
// component: listAccountsLive (1 call), the transactions loader with
// include=services (3), and the accounting summary paginating up to 20 — five
// to twenty-four calls per load, repeated on a 60s timer and on every tab
// focus. MarzPay throttled it, which showed up as "Too Many Attempts." and
// blocked the thing the page is for: starting a collection.
//
// One short-lived cache fixes it without going back to lying. A figure a few
// seconds old, stamped with the time it was read, is honest; a cached figure
// presented as current is not. Everything served from here carries read_at.
const providerCache = new Map();
const CACHE_TTL_MS = 20_000;
// After a throttle, stop calling for long enough for the window to clear.
const RATE_LIMIT_BACKOFF_MS = 60_000;
const rateLimitedUntil = new Map();

function cacheGet(key) {
  const hit = providerCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { providerCache.delete(key); return null; }
  return hit.value;
}

function cacheSet(key, value) {
  providerCache.set(key, { at: Date.now(), value });
  return value;
}

/** Drop cached reads for an account, e.g. right after moving money. */
export function invalidateProviderCache(accountId = null) {
  if (!accountId) { providerCache.clear(); return; }
  for (const k of providerCache.keys()) {
    if (k.startsWith(`${accountId}:`)) providerCache.delete(k);
  }
}

function throttledFor(accountId) {
  const until = rateLimitedUntil.get(accountId);
  if (!until) return 0;
  const left = until - Date.now();
  if (left <= 0) { rateLimitedUntil.delete(accountId); return 0; }
  return left;
}

// ───────────────────────────────── operations ───────────────────────────────

/**
 * Credential check. Uses /collect-money/services, which moves no money, and
 * records the outcome against the account.
 */
export async function verifyAccount(accountId) {
  const creds = await loadCredentials(accountId);
  if (!creds) return { ok: false, error: 'No active MarzPay account' };

  const r = await call(creds, 'GET', '/collect-money/services');
  const providerUuid = r.json?.data?.account?.uuid ?? null;

  if (r.ok) {
    await query(
      `UPDATE marzpay_accounts
          SET verification_status = 'verified', last_verified_at = NOW(),
              last_error = NULL, provider_account_uuid = COALESCE($2, provider_account_uuid),
              updated_at = NOW()
        WHERE id = $1`, [creds.id, providerUuid]);
    return { ok: true, message: 'MarzPay accepted the credentials', providers: readServices(r.json) };
  }

  const rejected = r.status === 401 || r.status === 403;
  await query(
    `UPDATE marzpay_accounts
        SET verification_status = $2, last_error = $3, updated_at = NOW()
      WHERE id = $1`,
    [creds.id, rejected ? 'rejected' : 'error', errorMessage(r)]);
  return { ok: false, error: errorMessage(r) };
}

/** Flatten the services payload into a simple provider list. */
function readServices(json) {
  const countries = json?.data?.countries ?? {};
  const out = [];
  for (const [code, c] of Object.entries(countries)) {
    for (const p of c?.providers ?? []) {
      out.push({
        country: code,
        provider: p.provider ?? null,
        name: p.name ?? null,
        currency: p.currency ?? null,
        mode: p.mode ?? null,
      });
    }
  }
  return out;
}

export async function getCollectionServices(accountId) {
  const creds = await loadCredentials(accountId);
  if (!creds) return { ok: false, error: 'No active MarzPay account' };
  const r = await call(creds, 'GET', '/collect-money/services');
  return r.ok
    ? { ok: true, providers: readServices(r.json) }
    : { ok: false, error: errorMessage(r) };
}

export async function getDisbursementServices(accountId) {
  const creds = await loadCredentials(accountId);
  if (!creds) return { ok: false, error: 'No active MarzPay account' };
  const r = await call(creds, 'GET', '/send-money/services');
  return r.ok
    ? { ok: true, providers: readServices(r.json) }
    : { ok: false, error: errorMessage(r) };
}

/**
 * Transactions, plus the account balance that /transactions embeds.
 *
 * /balance answers 403 IP_WHITELIST_REQUIRED unless the server IP is
 * whitelisted in the MarzPay dashboard, so balance is taken from here instead.
 */
export async function getTransactions(accountId, { perPage = 25, page = 1 } = {}) {
  const creds = await loadCredentials(accountId);
  if (!creds) return { ok: false, error: 'No active MarzPay account' };

  const r = await call(creds, 'GET', `/transactions?per_page=${perPage}&page=${page}`);
  if (!r.ok) return { ok: false, error: errorMessage(r) };

  const bal = r.json?.data?.account?.current_balance ?? null;
  const balance = bal ? { raw: Number(bal.raw), formatted: bal.formatted, currency: bal.currency } : null;

  if (balance) {
    await query(
      `UPDATE marzpay_accounts
          SET last_known_balance = $2, last_known_currency = $3,
              last_synced_at = NOW(), updated_at = NOW()
        WHERE id = $1`, [creds.id, balance.raw, balance.currency]);
  }

  const transactions = (r.json?.data?.transactions ?? []).map(t => ({
    uuid: t.uuid ?? null,
    reference: t.reference ?? null,
    provider_reference: t.provider_reference ?? null,
    amount: t.amount?.raw == null ? null : Number(t.amount.raw),
    amount_formatted: t.amount?.formatted ?? null,
    currency: t.amount?.currency ?? null,
    type: t.type ?? null,            // 'credit' | 'debit'
    status: t.status ?? null,
    description: t.description ?? null,
    provider: t.provider ?? null,
    phone_number: t.phone_number ?? null,
    created_at: t.timeline?.created_at ?? null,
    updated_at: t.timeline?.updated_at ?? null,
  }));

  return { ok: true, balance, transactions, account_uuid: r.json?.data?.account?.uuid ?? null };
}

/** MarzPay accepts each metadata entry as exactly one field name. */
export function marzMetadata(entries) {
  const out = [];
  for (const e of entries ?? []) {
    for (const [k, v] of Object.entries(e)) {
      if (k && k !== 'isPII') out.push({ [k]: String(v) });
    }
  }
  return out.slice(0, 10);
}

function readTransaction(body) {
  const root = body?.data ?? body ?? {};
  const t = root.transaction ?? {};
  const c = root.collection ?? {};
  const amount = c.amount ?? t.amount ?? {};
  const raw = amount?.raw ?? amount?.value ?? null;
  return {
    uuid: t.uuid ?? null,
    reference: t.reference ?? null,
    status: t.status ?? c.status ?? null,
    mode: c.mode ?? t.mode ?? null,
    currency: amount?.currency ?? null,
    amount: raw == null ? null : Number(raw),
    provider: c.provider ?? t.provider ?? null,
  };
}

/**
 * Start a mobile-money collection.
 *
 * Idempotency: the row is written to marzpay_transactions BEFORE MarzPay is
 * called, and `reference` is UNIQUE. A resubmission of the same reference
 * therefore collides on insert and returns the original attempt rather than
 * prompting the customer to pay twice.
 */
export async function collectMoney({
  accountId = null, amount, phone, description, reference = null,
  callbackUrl = null, metadata = [], userId = null,
}) {
  const creds = await loadCredentials(accountId);
  if (!creds) return { ok: false, error: 'No active MarzPay account' };

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: 'amount must be a positive number' };

  // MarzPay refuses collections below 500 UGX. Say so here rather than letting
  // the provider answer with a generic validation error.
  if (amt < COLLECTION_MIN_UGX) {
    return { ok: false, error: `MarzPay's minimum collection is ${COLLECTION_MIN_UGX} UGX.` };
  }

  // E.164 with the country code, which is what MarzPay requires. Jeton used to
  // validate a local 07… number and then send it as typed, so the provider
  // rejected it: "Please enter a valid phone number with country code".
  const e164 = toE164Ug(phone);
  if (!e164) {
    return { ok: false, error: UG_PHONE_HINT };
  }

  // The reference MarzPay accepts must be a UUID. A caller-supplied key is
  // honoured only when it already is one; otherwise a UUID is generated and
  // the caller's key is carried in metadata so it stays traceable.
  const callerRef = reference?.trim() || null;
  const ref = callerRef && UUID_RE.test(callerRef) ? callerRef : randomUUID();
  const extraMetadata = callerRef && ref !== callerRef ? [{ caller_reference: callerRef }] : [];

  let localId;
  try {
    const ins = await query(
      `INSERT INTO marzpay_transactions
         (account_id, reference, direction, amount, currency, phone_number, description, status, initiated_by)
       VALUES ($1,$2,'collection',$3,'UGX',$4,$5,'pending',$6) RETURNING id`,
      [creds.id, ref, amt, e164, description ?? null, userId]
    );
    localId = ins.rows[0].id;
  } catch (e) {
    if (e.code === '23505' || e.code === '23P01' || /duplicate key/i.test(e.message)) {
      const existing = await query(
        `SELECT id, status, provider_uuid, amount FROM marzpay_transactions WHERE reference = $1`, [ref]);
      return {
        ok: false, duplicate: true,
        error: `A collection with reference "${ref}" already exists. Not sending a second prompt.`,
        existing: existing.rows[0] ?? null,
      };
    }
    throw e;
  }

  const base = {
    amount: amt,
    country: 'UG',
    reference: ref,
    phone_number: e164,
    description: String(description ?? 'Jeton collection').slice(0, 255),
    ...(callbackUrl ? { callback_url: String(callbackUrl).slice(0, 255) } : {}),
  };
  const meta = marzMetadata([...(metadata ?? []), ...extraMetadata]);

  let r = await call(creds, 'POST', '/collect-money', meta.length ? { ...base, metadata: meta } : base);
  // Metadata is only a label; payments are matched by reference. If MarzPay
  // refuses it with a 4xx validation error no prompt was sent, so retrying
  // once without it is safe.
  if (!r.ok && meta.length && r.status >= 400 && r.status < 500 && /metadata/i.test(JSON.stringify(r.json ?? {}))) {
    r = await call(creds, 'POST', '/collect-money', base);
  }

  if (!r.ok || String(r.json?.status ?? '').toLowerCase() === 'error') {
    const msg = errorMessage(r);
    await query(
      `UPDATE marzpay_transactions
          SET status = 'failed', last_status_payload = $2, updated_at = NOW() WHERE id = $1`,
      [localId, JSON.stringify({ error: msg })]);
    return { ok: false, error: msg, reference: ref };
  }

  const tx = readTransaction(r.json);
  await query(
    `UPDATE marzpay_transactions
        SET provider_uuid = $2, provider = $3, status = COALESCE($4, 'pending'),
            last_status_payload = $5, updated_at = NOW()
      WHERE id = $1`,
    [localId, tx.uuid, tx.provider, tx.status, JSON.stringify(r.json ?? {})]);

  return { ok: true, reference: ref, transaction: tx, local_id: localId };
}

/** Authoritative status of a collection, refreshed into our own row. */
export async function getCollectionStatus(accountId, uuid) {
  if (!/^[0-9a-fA-F-]{20,64}$/.test(String(uuid || ''))) {
    return { ok: false, error: 'Invalid transaction id' };
  }
  const creds = await loadCredentials(accountId);
  if (!creds) return { ok: false, error: 'No active MarzPay account' };

  const r = await call(creds, 'GET', `/collect-money/${encodeURIComponent(uuid)}`);
  if (!r.ok) return { ok: false, error: errorMessage(r) };

  const tx = readTransaction(r.json);
  await query(
    `UPDATE marzpay_transactions
        SET status = COALESCE($2, status), last_status_payload = $3, updated_at = NOW()
      WHERE provider_uuid = $1`,
    [uuid, tx.status, JSON.stringify(r.json ?? {})]);

  return { ok: true, transaction: tx };
}

/**
 * Verify X-MarzPay-Signature: `t=<ts>,v1=<hex>` where the signature is
 * HMAC-SHA256(secret, `${ts}.${rawBody}`). Five-minute window, constant-time
 * comparison. Returns 'unsigned' when the header is absent so the caller can
 * decide its own policy.
 */
export function parseSignatureHeader(header) {
  const m = /t=(\d+)\s*,\s*v1=([0-9a-fA-F]+)/.exec(String(header ?? ''));
  return m ? { t: m[1], v1: m[2].toLowerCase() } : null;
}

export function verifyWebhookSignature(rawBody, header, secret, nowMs = Date.now()) {
  if (!header) return 'unsigned';
  const sig = parseSignatureHeader(header);
  if (!sig) return 'invalid';
  if (Math.abs(nowMs / 1000 - Number(sig.t)) > 300) return 'invalid';
  const expected = createHmac('sha256', secret).update(`${sig.t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig.v1);
  return a.length === b.length && timingSafeEqual(a, b) ? 'valid' : 'invalid';
}

// ──────────────────────────────── reconciliation ────────────────────────────

/**
 * Accounting summary for one MarzPay account, in the same shape the rest of
 * finance uses (credits / debits / net), plus how much is still unposted.
 *
 * Figures come from marzpay_transactions — what Jeton initiated and confirmed
 * — not from the provider's own list, so they are reproducible and auditable.
 */
export async function getAccountingSummary(accountId) {
  const r = await query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE direction = 'collection' AND status = 'completed'), 0) AS total_credits,
       COALESCE(SUM(amount) FILTER (WHERE direction = 'disbursement' AND status = 'completed'), 0) AS total_debits,
       COUNT(*) FILTER (WHERE status = 'completed')                      AS completed_count,
       COUNT(*) FILTER (WHERE status = 'pending')                        AS pending_count,
       COUNT(*) FILTER (WHERE status = 'failed')                         AS failed_count,
       COUNT(*)                                                          AS total_count,
       COALESCE(SUM(amount) FILTER (
         WHERE status = 'completed' AND direction = 'collection' AND ledger_entry_id IS NULL), 0) AS unreconciled_amount,
       COUNT(*) FILTER (
         WHERE status = 'completed' AND direction = 'collection' AND ledger_entry_id IS NULL)     AS unreconciled_count,
       COALESCE(SUM(amount) FILTER (WHERE ledger_entry_id IS NOT NULL), 0) AS reconciled_amount,
       COUNT(*) FILTER (WHERE ledger_entry_id IS NOT NULL)                AS reconciled_count
     FROM marzpay_transactions
     WHERE ($1::uuid IS NULL OR account_id = $1::uuid)`,
    [accountId || null]
  );
  const s = r.rows[0];
  const credits = Number(s.total_credits);
  const debits = Number(s.total_debits);
  return {
    total_credits: credits,
    total_debits: debits,
    net: credits - debits,
    completed_count: Number(s.completed_count),
    pending_count: Number(s.pending_count),
    failed_count: Number(s.failed_count),
    total_count: Number(s.total_count),
    unreconciled_amount: Number(s.unreconciled_amount),
    unreconciled_count: Number(s.unreconciled_count),
    reconciled_amount: Number(s.reconciled_amount),
    reconciled_count: Number(s.reconciled_count),
  };
}

/** Completed collections not yet posted to the internal ledger. */
export async function getUnreconciled(accountId = null) {
  const r = await query(
    `SELECT t.id, t.reference, t.provider_uuid, t.amount, t.currency,
            t.phone_number, t.provider, t.description, t.created_at,
            a.name AS marzpay_account, a.ledger_account_id
       FROM marzpay_transactions t
       JOIN marzpay_accounts a ON a.id = t.account_id
      WHERE t.status = 'completed'
        AND t.direction = 'collection'
        AND t.ledger_entry_id IS NULL
        AND ($1::uuid IS NULL OR t.account_id = $1::uuid)
      ORDER BY t.created_at ASC`,
    [accountId || null]
  );
  return r.rows;
}

/**
 * Post completed MarzPay collections into the internal ledger.
 *
 * Each transaction is handled in its own database transaction: the ledger row
 * is inserted and marzpay_transactions.ledger_entry_id is set together, so a
 * crash between the two is impossible. ledger_entry_id is checked inside that
 * transaction and is covered by a partial unique index, so running this twice
 * posts nothing twice — no double-counted revenue.
 *
 * Returns a per-transaction result rather than a single boolean, because one
 * unmapped account should not stop the rest from reconciling.
 */
export async function reconcile({ accountId = null, userId = null } = {}) {
  const pending = await getUnreconciled(accountId);
  const results = [];

  for (const t of pending) {
    if (!t.ledger_account_id) {
      results.push({
        id: t.id, reference: t.reference, posted: false,
        error: `"${t.marzpay_account}" has no internal account mapped, so there is nowhere to post this. Set one on the account first.`,
      });
      continue;
    }

    try {
      const entryId = await withTransaction(async (tx) => {
        // Re-check inside the transaction: another request may have posted it
        // between getUnreconciled() and here.
        const still = await tx(
          `SELECT ledger_entry_id FROM marzpay_transactions WHERE id = $1 FOR UPDATE`, [t.id]);
        if (still.rows[0]?.ledger_entry_id) return null;

        const led = await tx(
          `INSERT INTO ledger
             (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
           VALUES ($1,$2,$3,'payment',$4,$5,'revenue',$6,$7)
           RETURNING id`,
          [
            t.ledger_account_id,
            t.amount,                       // positive: money in
            t.currency || 'UGX',
            t.id,
            `MarzPay collection ${t.reference}${t.phone_number ? ` from ${t.phone_number}` : ''}` +
              `${t.description ? ` — ${t.description}` : ''}`,
            (t.created_at instanceof Date ? t.created_at : new Date(t.created_at))
              .toISOString().split('T')[0],
            userId,
          ]
        );

        await tx(
          `UPDATE marzpay_transactions
              SET ledger_entry_id = $2, reconciled_at = NOW(), updated_at = NOW()
            WHERE id = $1`,
          [t.id, led.rows[0].id]
        );
        return led.rows[0].id;
      });

      results.push(
        entryId
          ? { id: t.id, reference: t.reference, posted: true, ledger_entry_id: entryId, amount: Number(t.amount) }
          : { id: t.id, reference: t.reference, posted: false, error: 'Already reconciled' }
      );
    } catch (err) {
      results.push({ id: t.id, reference: t.reference, posted: false, error: err.message });
    }
  }

  const posted = results.filter(r => r.posted);
  return {
    considered: pending.length,
    posted: posted.length,
    amount_posted: posted.reduce((s, r) => s + r.amount, 0),
    results,
  };
}

/**
 * Totals taken from the PROVIDER's own transaction list.
 *
 * getAccountingSummary() above reports only what Jeton itself initiated, which
 * is the right basis for reconciliation but reads as a page of zeros on an
 * account that has been used outside Jeton — this wallet has real history
 * (Airtel, airtime, bills) that predates the integration and was never
 * imported. Showing provider-side figures beside the Jeton-side ones makes the
 * difference legible instead of looking like a broken page.
 */
/**
 * Provider-side totals, taken from the shared snapshot.
 *
 * This used to walk up to 20 pages on every page load. Combined with the other
 * loaders that was five to twenty-four provider calls per render, which is what
 * MarzPay throttled with "Too Many Attempts." — and the throttle then blocked
 * starting a collection, the one thing the page exists to do.
 *
 * One /transactions call at per_page=100 already carries the balance and, for
 * any account under 100 transactions, the whole history. `complete` says
 * whether that held. Use getProviderSummaryPaged() when a full walk is
 * genuinely wanted.
 */
export async function getProviderSummary(accountId, { force = false } = {}) {
  const snap = await getProviderSnapshot(accountId, { force });
  if (!snap.ok) return { ok: false, error: snap.error, rate_limited: !!snap.rate_limited };
  return {
    ok: true,
    balance: snap.balance,
    account_uuid: snap.account_uuid,
    ...snap.summary,
    pages_read: 1,
    read_at: snap.read_at,
    cached: !!snap.cached,
    rate_limited: !!snap.rate_limited,
  };
}

/** Full multi-page walk. Only for an explicit request — it costs one call per page. */
export async function getProviderSummaryPaged(accountId, { perPage = 100, maxPages = 20 } = {}) {
  // Walk the provider's pages so the totals cover its whole history rather
  // than one window. A single window produced totals that silently excluded
  // older activity, which is its own form of wrong number.
  //
  // maxPages caps the walk so one enormous account cannot hang the request;
  // `complete` says whether the end was actually reached, and the UI must not
  // present a truncated total as a lifetime figure.
  let credits = 0, debits = 0, pending = 0, counted = 0;
  let balance = null;
  let accountUuid = null;
  let complete = false;
  let page = 1;
  const seen = new Set();

  for (; page <= maxPages; page++) {
    const t = await getTransactions(accountId, { perPage, page });
    if (!t.ok) {
      // Page 1 failing is a real failure; later pages mean partial totals.
      if (page === 1) return { ok: false, error: t.error };
      break;
    }
    if (page === 1) { balance = t.balance; accountUuid = t.account_uuid; }

    const rows = t.transactions ?? [];
    let fresh = 0;
    for (const tx of rows) {
      // MarzPay has returned repeats across pages; dedupe on uuid so a
      // transaction cannot be counted twice.
      const key = tx.uuid || `${tx.reference}:${tx.created_at}:${tx.amount}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fresh++;
      counted++;

      const amt = Number(tx.amount) || 0;
      if (tx.status !== 'completed') { pending++; continue; }
      if (tx.type === 'credit') credits += amt;
      else if (tx.type === 'debit') debits += amt;
    }

    // Short page, or nothing new, means the end.
    if (rows.length < perPage || fresh === 0) { complete = true; break; }
  }

  return {
    ok: true,
    balance,
    account_uuid: accountUuid,
    total_credits: credits,
    total_debits: debits,
    net: credits - debits,
    transaction_count: counted,
    pending_count: pending,
    pages_read: Math.min(page, maxPages),
    complete,
    read_at: new Date().toISOString(),
  };
}

/**
 * Everything the MarzPay page needs about an account, from ONE provider call.
 *
 * /transactions returns the balance alongside the rows, so a single request at
 * per_page=100 yields the live balance, the transaction list, and totals over
 * the full history for any account with fewer than 100 transactions — which is
 * this one (43). That replaces the five-to-twenty-four calls the page used to
 * make, which is what MarzPay was throttling.
 *
 * `complete` is true when the page came back short, meaning the end of the
 * history was reached; the UI must not call a truncated total a lifetime one.
 *
 * Served from a 20s cache and stamped with read_at. If MarzPay has throttled
 * us, the last good snapshot is returned with rate_limited set rather than
 * hammering a closed door.
 */
export async function getProviderSnapshot(accountId, { perPage = 100, force = false } = {}) {
  const key = `${accountId}:snapshot:${perPage}`;

  if (!force) {
    const hit = cacheGet(key);
    if (hit) return { ...hit, cached: true };
  }

  const backoff = throttledFor(accountId);
  if (backoff > 0) {
    const stale = providerCache.get(key)?.value;
    return stale
      ? { ...stale, cached: true, rate_limited: true, retry_in_ms: backoff }
      : {
          ok: false, rate_limited: true, retry_in_ms: backoff,
          error: 'MarzPay is rate limiting this account. Waiting before trying again.',
        };
  }

  const creds = await loadCredentials(accountId);
  if (!creds) return { ok: false, error: 'No active MarzPay account' };

  const r = await call(creds, 'GET', `/transactions?per_page=${perPage}&page=1`);

  if (isRateLimited(r)) {
    rateLimitedUntil.set(accountId, Date.now() + RATE_LIMIT_BACKOFF_MS);
    const stale = providerCache.get(key)?.value;
    return stale
      ? { ...stale, cached: true, rate_limited: true, retry_in_ms: RATE_LIMIT_BACKOFF_MS }
      : { ok: false, rate_limited: true, retry_in_ms: RATE_LIMIT_BACKOFF_MS, error: errorMessage(r) };
  }
  if (!r.ok) return { ok: false, error: errorMessage(r) };

  const bal = r.json?.data?.account?.current_balance ?? null;
  const rows = r.json?.data?.transactions ?? [];

  const transactions = rows.map(t => ({
    uuid: t.uuid ?? null,
    reference: t.reference ?? null,
    provider_reference: t.provider_reference ?? null,
    amount: t.amount?.raw == null ? null : Number(t.amount.raw),
    amount_formatted: t.amount?.formatted ?? null,
    currency: t.amount?.currency ?? null,
    type: t.type ?? null,
    status: t.status ?? null,
    description: t.description ?? null,
    provider: t.provider ?? null,
    phone_number: t.phone_number ?? null,
    created_at: t.timeline?.created_at ?? null,
    updated_at: t.timeline?.updated_at ?? null,
  }));

  let credits = 0, debits = 0, pending = 0;
  for (const t of transactions) {
    const amt = Number(t.amount) || 0;
    if (t.status !== 'completed') { pending++; continue; }
    if (t.type === 'credit') credits += amt;
    else if (t.type === 'debit') debits += amt;
  }

  const balance = bal
    ? { raw: Number(bal.raw), formatted: bal.formatted, currency: bal.currency }
    : null;

  // Keep the row's cached copy fresh for the places that cannot make a live
  // call, but never let it be the thing the UI presents as current.
  if (balance) {
    await query(
      `UPDATE marzpay_accounts
          SET last_known_balance = $2, last_known_currency = $3,
              last_synced_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [accountId, balance.raw, balance.currency]
    ).catch(() => {});
  }

  return cacheSet(key, {
    ok: true,
    balance,
    account_uuid: r.json?.data?.account?.uuid ?? null,
    transactions,
    summary: {
      total_credits: credits,
      total_debits: debits,
      net: credits - debits,
      transaction_count: transactions.length,
      pending_count: pending,
      complete: rows.length < perPage,
    },
    read_at: new Date().toISOString(),
    cached: false,
    rate_limited: false,
  });
}

/**
 * Collection and disbursement providers. Cached far longer than balances —
 * MarzPay's service catalogue changes rarely, and fetching it on every page
 * load was two of the calls that triggered the throttle.
 */
export async function getServicesCached(accountId) {
  const key = `${accountId}:services`;
  const hit = providerCache.get(key);
  // 10 minutes: a service list is effectively static within a session.
  if (hit && Date.now() - hit.at < 600_000) return { ...hit.value, cached: true };

  if (throttledFor(accountId) > 0) {
    return hit ? { ...hit.value, cached: true } : { ok: false, error: 'Rate limited' };
  }

  const [collect, send] = await Promise.all([
    getCollectionServices(accountId),
    getDisbursementServices(accountId),
  ]);
  return cacheSet(key, {
    ok: collect.ok || send.ok,
    collection: collect.ok ? collect.providers : [],
    disbursement: send.ok ? send.providers : [],
    errors: [
      ...(collect.ok ? [] : [`collection: ${collect.error}`]),
      ...(send.ok ? [] : [`disbursement: ${send.error}`]),
    ],
    cached: false,
  });
}

/**
 * The provider's transaction list, straight through, for display.
 *
 * Nothing is read from marzpay_transactions here: that table records what
 * Jeton initiated, which is a different and much smaller set. Showing it as
 * "MarzPay transactions" would misreport the account.
 */
export async function getProviderTransactions(accountId, { perPage = 50, page = 1 } = {}) {
  const t = await getTransactions(accountId, { perPage, page });
  if (!t.ok) return { ok: false, error: t.error };
  return {
    ok: true,
    balance: t.balance,
    transactions: t.transactions,
    account_uuid: t.account_uuid,
    page,
    per_page: perPage,
    read_at: new Date().toISOString(),
  };
}

/**
 * Bring the internal account into line with the provider's balance.
 *
 * `accounts` has no balance column — a balance is the sum of that account's
 * ledger rows. The MarzPay wallet therefore read zero while the provider held
 * real money, because no entry had ever been posted for it.
 *
 * This posts the DIFFERENCE as a single adjustment, which is the honest
 * correction: the provider's historical transactions are not Jeton's records
 * and inventing ledger rows for them would fabricate history. One adjustment
 * says "the books were out by this much, and here is when we noticed".
 *
 * Naturally idempotent: it posts the gap, so a second run computes a gap of
 * zero and writes nothing.
 */
export async function syncBalanceToLedger({ accountId = null, userId = null } = {}) {
  const acct = accountId
    ? (await query(`SELECT * FROM marzpay_accounts WHERE id = $1`, [accountId])).rows[0]
    : (await query(
        `SELECT * FROM marzpay_accounts WHERE is_active = TRUE
          ORDER BY is_default DESC, created_at ASC LIMIT 1`)).rows[0];

  if (!acct) return { ok: false, error: 'No MarzPay account' };
  if (!acct.ledger_account_id) {
    return {
      ok: false,
      error: `"${acct.name}" has no internal account mapped, so there is nowhere to post the balance.`,
    };
  }

  // Authoritative figure from the provider.
  const t = await getTransactions(acct.id, { perPage: 1 });
  if (!t.ok) return { ok: false, error: t.error };
  if (!t.balance) return { ok: false, error: 'MarzPay did not return a balance.' };

  const providerBalance = Number(t.balance.raw);
  const currency = t.balance.currency || 'UGX';

  const booked = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger WHERE account_id = $1`,
    [acct.ledger_account_id]
  );
  const bookBalance = Number(booked.rows[0].total);
  const difference = providerBalance - bookBalance;

  if (Math.abs(difference) < 0.005) {
    return {
      ok: true, posted: false, provider_balance: providerBalance,
      book_balance: bookBalance, difference: 0, currency,
      message: 'The books already match the provider balance.',
    };
  }

  const entryId = await withTransaction(async (tx) => {
    const led = await tx(
      `INSERT INTO ledger
         (account_id, amount, currency, source_type, source_id, description, category, entry_date, created_by)
       VALUES ($1,$2,$3,'adjustment',$4,$5,'adjustment',CURRENT_DATE,$6)
       RETURNING id`,
      [
        acct.ledger_account_id,
        difference,                       // signed: may correct either way
        currency,
        acct.id,
        `MarzPay balance reconciliation — provider held ${currency} ${providerBalance.toLocaleString()}, ` +
          `books showed ${currency} ${bookBalance.toLocaleString()}. ` +
          `Adjustment covers activity on the wallet that was not recorded through Jeton.`,
        userId,
      ]
    );
    await tx(
      `UPDATE marzpay_accounts
          SET last_known_balance = $2, last_known_currency = $3,
              last_synced_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [acct.id, providerBalance, currency]
    );
    return led.rows[0].id;
  });

  return {
    ok: true, posted: true, ledger_entry_id: entryId,
    provider_balance: providerBalance, book_balance: bookBalance,
    difference, currency,
    message: `Posted an adjustment of ${currency} ${difference.toLocaleString()} so the ` +
             `MarzPay wallet reads ${currency} ${providerBalance.toLocaleString()} in the books.`,
  };
}

export default {
  listAccounts, listAccountsLive, getProviderTransactions,
  getAccountPublic, createAccount, rotateCredentials, setDefaultAccount,
  verifyAccount, getCollectionServices, getDisbursementServices, getTransactions,
  collectMoney, getCollectionStatus, verifyWebhookSignature, envCredentials,
  getAccountingSummary, getUnreconciled, reconcile,
  getProviderSummary, getProviderSummaryPaged, getProviderSnapshot,
  getServicesCached, invalidateProviderCache, syncBalanceToLedger,
};
