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
 *   GET  /balance, /account        403 IP_WHITELIST_REQUIRED on this account,
 *                                  so balance is read from /transactions
 */

import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { query } from '@/lib/db.js';
import { encryptSecret, decryptSecret, maskCredential } from '@/lib/encryption.js';

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
    // A decryption failure almost always means ENCRYPTION_KEY changed. Say so
    // without echoing anything sensitive.
    throw new Error(
      `MarzPay account "${row.name}" could not be decrypted. ` +
      `ENCRYPTION_KEY may have changed since the credentials were stored.`
    );
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

/** Turn a MarzPay error body into one short, non-sensitive sentence. */
function errorMessage(r) {
  const m = r.json?.message || r.json?.error || `MarzPay returned HTTP ${r.status}`;
  const code = r.json?.error_code;
  return String(code ? `${m} (${code})` : m).slice(0, 240);
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
  if (!phone?.trim()) return { ok: false, error: 'phone is required' };

  const ref = (reference?.trim() || randomUUID()).slice(0, 80);

  let localId;
  try {
    const ins = await query(
      `INSERT INTO marzpay_transactions
         (account_id, reference, direction, amount, currency, phone_number, description, status, initiated_by)
       VALUES ($1,$2,'collection',$3,'UGX',$4,$5,'pending',$6) RETURNING id`,
      [creds.id, ref, amt, phone.trim(), description ?? null, userId]
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
    phone_number: phone.trim(),
    description: String(description ?? 'Jeton collection').slice(0, 255),
    ...(callbackUrl ? { callback_url: String(callbackUrl).slice(0, 255) } : {}),
  };
  const meta = marzMetadata(metadata);

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

export default {
  listAccounts, getAccountPublic, createAccount, rotateCredentials, setDefaultAccount,
  verifyAccount, getCollectionServices, getDisbursementServices, getTransactions,
  collectMoney, getCollectionStatus, verifyWebhookSignature, envCredentials,
};
