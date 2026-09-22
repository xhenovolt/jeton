/**
 * DRAIS webhook signature verification.
 *
 * DRAIS signs every delivery with the per-subscription secret (the value Jeton
 * supplied as DRAIS_WEBHOOK_SECRET when registering the webhook):
 *
 *   X-DRAIS-Signature: t=<unixSeconds>,v1=<hex>
 *   v1 = HMAC_SHA256(secret, `${t}.${rawBody}`)
 *
 * We recompute and timing-safe compare, and reject stale timestamps to blunt
 * replay attacks.
 */
import crypto from 'node:crypto';

const DEFAULT_TOLERANCE_SEC = 300; // 5 minutes

export function parseSignatureHeader(header) {
  if (!header || typeof header !== 'string') return null;
  const parts = Object.fromEntries(
    header.split(',').map(kv => kv.split('=').map(s => s.trim())),
  );
  if (!parts.t || !parts.v1) return null;
  return { t: Number(parts.t), v1: parts.v1 };
}

/**
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function verifyWebhookSignature(rawBody, signatureHeader, secret, toleranceSec = DEFAULT_TOLERANCE_SEC) {
  if (!secret) return { ok: false, reason: 'no_secret_configured' };
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return { ok: false, reason: 'malformed_signature' };
  if (!Number.isFinite(parsed.t)) return { ok: false, reason: 'bad_timestamp' };

  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - parsed.t);
  if (ageSec > toleranceSec) return { ok: false, reason: 'stale_timestamp' };

  const expected = crypto.createHmac('sha256', secret).update(`${parsed.t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(parsed.v1, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'signature_mismatch' };
  }
  return { ok: true };
}
