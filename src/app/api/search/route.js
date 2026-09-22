import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { hasPermission } from '@/lib/permissions.js';
import { looksLikePhoneQuery } from '@/lib/phone-normalize.js';

/**
 * GET /api/search?q=<term>&limit=<n>
 *
 * The founder's command bar. Returns categorized result buckets:
 *
 *   { routes, prospects, clients, deals, payments, invoices,
 *     documents, systems, licenses, staff, subscriptions, media }
 *
 * Rules:
 *   - Every category is gated by the SAME permission the module uses.
 *     If the caller can't see /app/finance, `payments` and `invoices`
 *     come back as empty arrays — they never leak.
 *   - Numeric-looking queries also probe prospects.phone_search so the
 *     founder can paste "0700 123 456", "+256 700 123 456", or
 *     "256700123456" and land on the same row.
 *   - Routes are matched from navigation-config via the nav-permissions
 *     filter (same source of truth as the sidebar), so we don't have
 *     to teach the search about every page.
 *   - Everything else is ILIKE '%q%'. Full-text indexing is a follow-up
 *     when the surface justifies it.
 *
 * Limit defaults to 5 per category so the dropdown stays responsive.
 */

const DEFAULT_LIMIT = 5;
const MAX_LIMIT     = 15;

// Small helper: run a query, swallow errors (e.g. table missing on older
// deploys) and always return rows[] so the response shape is stable.
async function safeQuery(sql, params) {
  try { const r = await query(sql, params); return r.rows; }
  catch (err) {
    console.warn('[search] query failed:', err.message);
    return [];
  }
}

export async function GET(request) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q     = (searchParams.get('q') || '').trim();
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || DEFAULT_LIMIT, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  if (q.length < 2) {
    return NextResponse.json({
      success: true,
      query: q,
      results: emptyBuckets(),
      total: 0,
    });
  }

  const ilike = `%${q}%`;
  const phoneDigits = looksLikePhoneQuery(q);

  // Permission gates. hasPermission bypasses for superadmins internally.
  const [canFinance, canDocs, canStaff, canSystems, canLicenses, canSubs, canMedia] = await Promise.all([
    hasPermission(auth.userId, 'finance',       'view', auth.role),
    hasPermission(auth.userId, 'documents',     'view', auth.role),
    hasPermission(auth.userId, 'staff',         'view', auth.role),
    hasPermission(auth.userId, 'systems',       'view', auth.role),
    hasPermission(auth.userId, 'licenses',      'view', auth.role),
    hasPermission(auth.userId, 'subscriptions', 'view', auth.role),
    hasPermission(auth.userId, 'media',         'view', auth.role),
  ]);

  // Sales / CRM permissions are less consistently named across the repo;
  // fall back to `deals.view` / `prospects.view` / `clients.view`.
  const [canProspects, canClients, canDeals] = await Promise.all([
    hasPermission(auth.userId, 'prospects', 'view', auth.role),
    hasPermission(auth.userId, 'clients',   'view', auth.role),
    hasPermission(auth.userId, 'deals',     'view', auth.role),
  ]);

  // Fire everything in parallel. Non-authorised buckets short-circuit
  // to an empty array without hitting the DB.
  const [
    prospects, clients, deals, payments, invoices,
    documents, systems, licenses, staff, subscriptions, media,
  ] = await Promise.all([
    canProspects ? searchProspects(ilike, phoneDigits, limit) : [],
    canClients   ? searchClients(ilike, limit) : [],
    canDeals     ? searchDeals(ilike, limit)   : [],
    canFinance   ? searchPayments(ilike, limit) : [],
    canFinance   ? searchInvoices(ilike, limit) : [],
    canDocs      ? searchDocuments(ilike, limit) : [],
    canSystems   ? searchSystems(ilike, limit) : [],
    canLicenses  ? searchLicenses(ilike, limit) : [],
    canStaff     ? searchStaff(ilike, limit) : [],
    canSubs      ? searchSubscriptions(ilike, limit) : [],
    canMedia     ? searchMedia(ilike, limit) : [],
  ]);

  const results = {
    prospects, clients, deals, payments, invoices,
    documents, systems, licenses, staff, subscriptions, media,
  };

  const total = Object.values(results).reduce((n, arr) => n + arr.length, 0);

  return NextResponse.json({
    success: true,
    query: q,
    results,
    total,
  });
}

function emptyBuckets() {
  return {
    prospects: [], clients: [], deals: [], payments: [], invoices: [],
    documents: [], systems: [], licenses: [], staff: [], subscriptions: [], media: [],
  };
}

// ─── per-category queries ────────────────────────────────────────────────
// Each returns { id, title, subtitle, href } so the client renders every
// bucket uniformly.

async function searchProspects(ilike, phoneDigits, limit) {
  // The phone_search column is trigger-maintained by migration 973 and
  // holds normalised digits for phone + alternative_phone + whatsapp.
  // We add a phone digit probe as an OR clause when the query looks
  // phone-shaped.
  const params = [ilike, limit];
  let phoneClause = '';
  if (phoneDigits) {
    params.push(`%${phoneDigits}%`);
    phoneClause = ` OR phone_search ILIKE $${params.length}`;
  }
  const rows = await safeQuery(
    `SELECT id, company_name, contact_name, phone, stage
     FROM prospects
     WHERE (
       company_name  ILIKE $1
       OR contact_name ILIKE $1
       OR email        ILIKE $1
       OR phone        ILIKE $1
       OR notes        ILIKE $1
       OR industry     ILIKE $1
       OR source       ILIKE $1
       OR stage        ILIKE $1
       ${phoneClause}
     )
     ORDER BY updated_at DESC NULLS LAST
     LIMIT $2`,
    params
  );
  return rows.map(r => ({
    id: r.id,
    title: r.company_name || r.contact_name || 'Unnamed prospect',
    subtitle: [r.contact_name, r.phone, r.stage].filter(Boolean).join(' · '),
    href: `/app/prospects/${r.id}`,
  }));
}

async function searchClients(ilike, limit) {
  const rows = await safeQuery(
    `SELECT id, company_name, contact_name, email
     FROM clients
     WHERE company_name ILIKE $1
        OR contact_name ILIKE $1
        OR email        ILIKE $1
        OR phone        ILIKE $1
     ORDER BY updated_at DESC NULLS LAST
     LIMIT $2`,
    [ilike, limit]
  );
  return rows.map(r => ({
    id: r.id,
    title: r.company_name || 'Client',
    subtitle: [r.contact_name, r.email].filter(Boolean).join(' · '),
    href: `/app/clients/${r.id}`,
  }));
}

async function searchDeals(ilike, limit) {
  const rows = await safeQuery(
    `SELECT d.id, d.title, d.total_amount, d.currency, d.status,
            c.company_name AS client_name
     FROM deals d
     LEFT JOIN clients c ON d.client_id = c.id
     WHERE d.title       ILIKE $1
        OR d.description ILIKE $1
        OR c.company_name ILIKE $1
     ORDER BY d.created_at DESC
     LIMIT $2`,
    [ilike, limit]
  );
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    subtitle: [r.client_name, r.status, r.total_amount ? `${r.currency || ''} ${Number(r.total_amount).toLocaleString()}` : null].filter(Boolean).join(' · '),
    href: `/app/deals/${r.id}`,
  }));
}

async function searchPayments(ilike, limit) {
  const rows = await safeQuery(
    `SELECT p.id, p.amount, p.currency, p.method, p.reference,
            d.title AS deal_title, c.company_name AS client_name
     FROM payments p
     LEFT JOIN deals   d ON p.deal_id   = d.id
     LEFT JOIN clients c ON d.client_id = c.id
     WHERE p.reference   ILIKE $1
        OR p.notes       ILIKE $1
        OR d.title       ILIKE $1
        OR c.company_name ILIKE $1
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [ilike, limit]
  );
  return rows.map(r => ({
    id: r.id,
    title: `${r.currency || ''} ${Number(r.amount || 0).toLocaleString()}`,
    subtitle: [r.client_name, r.deal_title, r.method].filter(Boolean).join(' · '),
    href: r.deal_title ? `/app/deals` : `/app/payments`,
  }));
}

async function searchInvoices(ilike, limit) {
  const rows = await safeQuery(
    `SELECT i.id, i.invoice_number, i.total, i.currency, i.status,
            c.company_name AS client_name
     FROM invoices i
     LEFT JOIN clients c ON i.client_id = c.id
     WHERE i.invoice_number ILIKE $1
        OR c.company_name    ILIKE $1
     ORDER BY i.created_at DESC
     LIMIT $2`,
    [ilike, limit]
  );
  return rows.map(r => ({
    id: r.id,
    title: r.invoice_number || 'Invoice',
    subtitle: [r.client_name, r.status, r.total ? `${r.currency || ''} ${Number(r.total).toLocaleString()}` : null].filter(Boolean).join(' · '),
    href: `/app/invoices/${r.id}`,
  }));
}

async function searchDocuments(ilike, limit) {
  const rows = await safeQuery(
    `SELECT id, title, category, approval_status
     FROM documents
     WHERE title       ILIKE $1
        OR description ILIKE $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [ilike, limit]
  );
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    subtitle: [r.category, r.approval_status].filter(Boolean).join(' · '),
    href: `/app/documents/${r.id}`,
  }));
}

async function searchSystems(ilike, limit) {
  const rows = await safeQuery(
    `SELECT id, name, description, status
     FROM systems
     WHERE name        ILIKE $1
        OR description ILIKE $1
     ORDER BY name
     LIMIT $2`,
    [ilike, limit]
  );
  return rows.map(r => ({
    id: r.id,
    title: r.name,
    subtitle: [r.status, r.description].filter(Boolean).join(' · ').slice(0, 100),
    href: `/app/systems/${r.id}`,
  }));
}

async function searchLicenses(ilike, limit) {
  const rows = await safeQuery(
    `SELECT l.id, l.license_key, l.client_name, l.status, s.name AS system_name
     FROM licenses l
     LEFT JOIN systems s ON l.system_id = s.id
     WHERE l.license_key ILIKE $1
        OR l.client_name ILIKE $1
        OR s.name        ILIKE $1
     ORDER BY l.created_at DESC
     LIMIT $2`,
    [ilike, limit]
  );
  return rows.map(r => ({
    id: r.id,
    title: r.client_name || r.license_key,
    subtitle: [r.system_name, r.status, r.license_key].filter(Boolean).join(' · '),
    href: `/app/licenses/${r.id}`,
  }));
}

async function searchStaff(ilike, limit) {
  const rows = await safeQuery(
    `SELECT id, name, email, position, department
     FROM staff
     WHERE name       ILIKE $1
        OR email      ILIKE $1
        OR position   ILIKE $1
        OR department ILIKE $1
     ORDER BY name
     LIMIT $2`,
    [ilike, limit]
  );
  return rows.map(r => ({
    id: r.id,
    title: r.name,
    subtitle: [r.position, r.department, r.email].filter(Boolean).join(' · '),
    href: `/app/staff`,
  }));
}

async function searchSubscriptions(ilike, limit) {
  const rows = await safeQuery(
    `SELECT s.id, s.status, s.system, c.company_name AS client_name,
            pp.name AS plan_name
     FROM subscriptions s
     LEFT JOIN clients c        ON s.client_id = c.id
     LEFT JOIN pricing_plans pp ON s.plan_id   = pp.id
     WHERE c.company_name ILIKE $1
        OR pp.name        ILIKE $1
        OR s.system       ILIKE $1
     ORDER BY s.created_at DESC
     LIMIT $2`,
    [ilike, limit]
  );
  return rows.map(r => ({
    id: r.id,
    title: r.client_name || 'Subscription',
    subtitle: [r.plan_name, r.system, r.status].filter(Boolean).join(' · '),
    href: `/app/subscriptions/${r.id}`,
  }));
}

async function searchMedia(ilike, limit) {
  const rows = await safeQuery(
    `SELECT id, filename, original_filename, mime_type, entity_type
     FROM media
     WHERE original_filename ILIKE $1
        OR filename           ILIKE $1
        OR notes              ILIKE $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [ilike, limit]
  );
  return rows.map(r => ({
    id: r.id,
    title: r.original_filename || r.filename,
    subtitle: [r.mime_type, r.entity_type].filter(Boolean).join(' · '),
    href: `/app/media`,
  }));
}
