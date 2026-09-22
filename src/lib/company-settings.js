import { query } from '@/lib/db.js';

const DEFAULTS = {
  company_name:         'Xhenvolt Technologies',
  company_tagline:      'Intelligent Software Solutions for Africa',
  company_address:      'Bulubandi, Iganga, Uganda',
  company_phone_1:      '0741 341 483',
  company_phone_2:      '0760 700 954',
  company_phone_3:      '0745 726 350',
  company_email:        '',
  company_website:      '',
  company_logo:         '',
  company_tin:          '',
  company_registration: '',
};

/**
 * Fetch all company settings from DB.
 * Falls back to DEFAULTS if the table does not exist yet.
 * @returns {Promise<typeof DEFAULTS>}
 */
export async function getCompanySettings() {
  try {
    const res = await query('SELECT key, value FROM company_settings');
    const s = { ...DEFAULTS };
    for (const row of res.rows) {
      s[row.key] = row.value ?? '';
    }
    return s;
  } catch {
    return { ...DEFAULTS };
  }
}
