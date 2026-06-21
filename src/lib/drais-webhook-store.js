/**
 * Stored DRAIS webhook registration (table drais_webhook_config).
 * DRAIS mints the signing secret at registration; we persist it encrypted so
 * the receiver can verify inbound signatures without manual env editing.
 */
import { query } from '@/lib/db.js';
import { encryptSecret, decryptSecret } from '@/lib/encryption.js';

export async function saveWebhookConfig({ subscriptionId, url, eventTypes, secret }) {
  const enc = encryptSecret(secret);
  await query(
    `INSERT INTO drais_webhook_config (subscription_id, url, event_types, secret_encrypted)
     VALUES ($1, $2, $3, $4)`,
    [subscriptionId || null, url, JSON.stringify(eventTypes || ['*']), enc],
  );
}

/** Latest stored secret (decrypted), or null. Receiver falls back to env. */
export async function getActiveWebhookSecret() {
  try {
    const r = await query(
      `SELECT secret_encrypted FROM drais_webhook_config ORDER BY id DESC LIMIT 1`,
    );
    if (!r.rows.length) return null;
    return decryptSecret(r.rows[0].secret_encrypted);
  } catch {
    return null;
  }
}

export async function getWebhookConfigStatus() {
  const r = await query(
    `SELECT subscription_id, url, event_types, created_at FROM drais_webhook_config ORDER BY id DESC LIMIT 1`,
  );
  return r.rows[0] || null;
}
