/**
 * Ugandan phone number normalisation.
 *
 * MUST mirror migrations/973's normalize_ug_phone() so that a client-side
 * check produces the same string the DB stored for the row. Any drift
 * between these two implementations will silently break the phone search.
 *
 *   normalizeUgPhone('0700 123 456')  === '256700123456'
 *   normalizeUgPhone('+256 700 123456') === '256700123456'
 *   normalizeUgPhone('256700123456')  === '256700123456'
 *   normalizeUgPhone('')              === null
 */
export function normalizeUgPhone(input) {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  const digits = s.replace(/[^0-9]/g, '');
  if (/^0\d{9}$/.test(digits)) return '256' + digits.slice(1);
  return digits;
}

/**
 * Extract phone-shaped digits from a search query. Returns null if the
 * query doesn't look like a phone number at all (fewer than 4 digits
 * survived stripping). Used by /api/search to decide whether to also
 * probe prospects.phone_search.
 */
export function looksLikePhoneQuery(q) {
  if (!q) return null;
  const digits = String(q).replace(/[^0-9]/g, '');
  if (digits.length < 4) return null;
  return normalizeUgPhone(digits);
}
