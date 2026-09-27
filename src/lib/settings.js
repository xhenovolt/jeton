/**
 * System settings — small key/value store backed by the `system_settings`
 * table, for operational policy that an admin should be able to change
 * without a redeploy.
 *
 * Values are stored as text. Use the typed helpers (getBoolSetting) rather
 * than comparing raw strings at call sites.
 */

import { query } from '@/lib/db.js';

/**
 * Settings this app knows about. Anything not listed here is rejected by the
 * settings API, so a typo can't quietly create a setting that nothing reads.
 */
export const SETTING_DEFINITIONS = {
  deals_allow_delete_with_payments: {
    type: 'boolean',
    default: 'false',
    label: 'Allow deleting deals that have payments',
    description:
      'Off (recommended): a deal with recorded payments cannot be deleted, so revenue always traces back to a deal. On: deleting such a deal also permanently removes its payments, ledger entries and invoices, so the books stay balanced — but that money history is gone for good.',
    group: 'deals',
  },
};

// Settings change rarely and are read on hot paths, so cache briefly.
// Short enough that an admin toggling a setting sees it take effect promptly.
const CACHE_TTL_MS = 30_000;
let cache = null;
let cachedAt = 0;

export function invalidateSettingsCache() {
  cache = null;
  cachedAt = 0;
}

/**
 * Every known setting, merged over its default. Unknown rows in the table are
 * ignored; missing rows fall back to the declared default.
 */
export async function getSettings() {
  if (cache && Date.now() - cachedAt < CACHE_TTL_MS) return cache;

  const stored = {};
  try {
    const result = await query(`SELECT key, value FROM system_settings`);
    for (const row of result.rows) stored[row.key] = row.value;
  } catch (err) {
    // A settings read must never take down the caller. Fall back to defaults
    // and say so, rather than failing the request.
    console.error('[settings] read failed, using defaults:', err.message);
  }

  const merged = {};
  for (const [key, def] of Object.entries(SETTING_DEFINITIONS)) {
    merged[key] = stored[key] !== undefined ? stored[key] : def.default;
  }

  cache = merged;
  cachedAt = Date.now();
  return merged;
}

export async function getSetting(key) {
  const all = await getSettings();
  return all[key];
}

/** Reads a setting as a boolean. Only the exact string 'true' is true. */
export async function getBoolSetting(key) {
  return (await getSetting(key)) === 'true';
}

/**
 * Write a setting. Returns the stored value.
 * Throws on an unknown key or a value that does not match the declared type.
 */
export async function setSetting(key, value, userId = null) {
  const def = SETTING_DEFINITIONS[key];
  if (!def) throw new Error(`Unknown setting: ${key}`);

  let stringValue = String(value);
  if (def.type === 'boolean') {
    if (stringValue !== 'true' && stringValue !== 'false') {
      throw new Error(`Setting ${key} must be 'true' or 'false'`);
    }
  }

  await query(
    `INSERT INTO system_settings (key, value, description, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [key, stringValue, def.description || null, userId]
  );

  invalidateSettingsCache();
  return stringValue;
}
