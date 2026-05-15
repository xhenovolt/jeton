import { query } from './db.js';

let brandingCache = null;
let brandingCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getActiveBranding(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && brandingCache && (now - brandingCacheTime) < CACHE_TTL) {
    return brandingCache;
  }

  const result = await query(
    `SELECT * FROM company_branding WHERE is_active = TRUE LIMIT 1`
  );

  brandingCache = result.rows[0] || getDefaultBranding();
  brandingCacheTime = now;
  return brandingCache;
}

export function getDefaultBranding() {
  return {
    id: null,
    organization_name: 'JETON',
    organization_slug: 'jeton',
    logo_url: null,
    logo_width: 100,
    logo_height: 100,
    header_text: 'Professional Document Management System',
    footer_text: 'Authenticity Verified',
    signature_url: null,
    signature_name: 'Authorized Officer',
    signature_title: 'Organization Representative',
    address_line1: null,
    address_line2: null,
    city: null,
    postal_code: null,
    country: null,
    phone: null,
    email: null,
    website: null,
    primary_color: '#1F2937',
    secondary_color: '#3B82F6',
    accent_color: '#10B981',
  };
}

export async function updateBranding(data, userId) {
  // Ensure only one active branding record
  await query(
    `UPDATE company_branding SET is_active = FALSE WHERE is_active = TRUE AND id != $1`,
    [data.id || null]
  );

  const result = await query(
    `INSERT INTO company_branding (
      organization_name, organization_slug, logo_url, logo_width, logo_height,
      header_text, footer_text, signature_url, signature_name, signature_title,
      address_line1, address_line2, city, postal_code, country, phone, email, website,
      primary_color, secondary_color, accent_color, is_active, updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
     ON CONFLICT (organization_slug) DO UPDATE SET
      logo_url = $3, logo_width = $4, logo_height = $5,
      header_text = $6, footer_text = $7, signature_url = $8, signature_name = $9, signature_title = $10,
      address_line1 = $11, address_line2 = $12, city = $13, postal_code = $14, country = $15,
      phone = $16, email = $17, website = $18,
      primary_color = $19, secondary_color = $20, accent_color = $21, is_active = $22, updated_by = $23, updated_at = NOW()
     RETURNING *`,
    [
      data.organization_name || 'JETON',
      data.organization_slug || 'jeton',
      data.logo_url || null,
      data.logo_width || 100,
      data.logo_height || 100,
      data.header_text || null,
      data.footer_text || null,
      data.signature_url || null,
      data.signature_name || null,
      data.signature_title || null,
      data.address_line1 || null,
      data.address_line2 || null,
      data.city || null,
      data.postal_code || null,
      data.country || null,
      data.phone || null,
      data.email || null,
      data.website || null,
      data.primary_color || '#1F2937',
      data.secondary_color || '#3B82F6',
      data.accent_color || '#10B981',
      data.is_active !== false,
      userId
    ]
  );

  // Invalidate cache
  brandingCache = null;
  brandingCacheTime = 0;

  return result.rows[0];
}

export async function getBrandingHistory() {
  return query(
    `SELECT * FROM company_branding ORDER BY updated_at DESC LIMIT 20`
  );
}
