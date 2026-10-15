/**
 * Ugandan mobile number rules, shared by the browser and the server.
 *
 * This lives in its own module so a client component can import it without
 * pulling in `marzpay.js` (which reaches for the database and the encryption
 * key). One rule, one place: the form and the API agree by construction.
 */

/** MarzPay refuses collections below this. */
export const COLLECTION_MIN_UGX = 500;

/**
 * Normalise a Ugandan mobile number to the E.164 form MarzPay requires.
 *
 * Accepts what people actually type — 0741341483, 741341483, 256741341483,
 * +256 741 341 483 — and returns +256741341483, or null if it cannot be read
 * as a Ugandan mobile. Jeton used to validate the local shape and then send it
 * unchanged, so a number the form accepted was rejected by the provider with
 * nothing more useful than "Please check your input and try again".
 */
export function toE164Ug(input) {
  const digits = String(input ?? '').replace(/[^\d+]/g, '');
  if (!digits) return null;

  let local = digits.replace(/^\+/, '');
  if (local.startsWith('256')) local = local.slice(3);
  else if (local.startsWith('0')) local = local.slice(1);

  // Ugandan mobile numbers are 9 digits beginning 7 (MTN/Airtel ranges).
  if (!/^7\d{8}$/.test(local)) return null;
  return `+256${local}`;
}

/** The message to show when `toE164Ug` returns null. */
export const UG_PHONE_HINT = 'Enter a Ugandan mobile number, e.g. 0741341483 or +256741341483.';
