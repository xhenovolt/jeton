import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission, hasPermission } from '@/lib/permissions.js';
import { dispatch } from '@/lib/system-events.js';
import { generateDocument, DocumentValidationError } from '@/lib/document-service.js';
import { hasVerificationSecret, verificationUrl } from '@/lib/document-generation.js';

/**
 * POST /api/documents/generate — produce a document from a template.
 *
 * What changed, and why it matters:
 *
 *   - All composition moved to `document-service.js` and runs in ONE
 *     transaction. The route used to compute the document HTML and then not
 *     store it, so content was re-derived from the live template on every read
 *     and editing a template silently rewrote contracts already issued.
 *   - Puppeteer is no longer launched here. The old handler produced a PDF
 *     buffer, discarded it, and saved a URL pointing back at a route that
 *     regenerated the file — paying for a browser launch and keeping nothing.
 *     PDFs are now rendered on demand from the frozen snapshot.
 *   - `expires_in_days` no longer defaults to 365. Silently expiring every
 *     employment contract after a year is a policy decision, not a default;
 *     it comes from `document_policy_settings.default_expiry_days`.
 *   - The response no longer returns `verification_hash`, and returns the
 *     token only to a caller who may issue the document.
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'documents.generate');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  // Verification hashes used to fall back to a secret committed to this
  // repository, which made every one of them forgeable. Refuse rather than
  // issue a document whose verification means nothing.
  if (!hasVerificationSecret()) {
    return NextResponse.json({
      success: false,
      code: 'VERIFICATION_SECRET_MISSING',
      error: 'VERIFICATION_SECRET is not configured on the server, so documents cannot be ' +
             'issued with trustworthy verification. Set it (16+ characters) and redeploy.',
    }, { status: 503 });
  }

  try {
    const body = await request.json();

    const isSuperadmin = auth.role === 'superadmin';
    const canIssueExceptional = isSuperadmin
      || await hasPermission(auth.userId, 'documents', 'issue_exceptional', auth.role).catch(() => false);

    const { document, html, warnings } = await generateDocument({
      templateId: body.template_id,
      profileId: body.profile_id ?? null,
      selectedClauseIds: body.clause_ids ?? null,
      documentType: body.document_type ?? null,
      recipientName: body.recipient_name,
      recipientEmail: body.recipient_email ?? null,
      recipientPhone: body.recipient_phone ?? null,
      subjectStaffId: body.subject_staff_id ?? null,
      subjectType: body.subject_type ?? null,
      subjectId: body.subject_id ?? null,
      placeholderData: body.placeholder_data ?? {},
      // undefined means "use the policy default"; an explicit null means never.
      expiresInDays: 'expires_in_days' in body ? body.expires_in_days : undefined,
      categoryId: body.category_id ?? null,
      amendsDocumentId: body.amends_document_id ?? null,
      renewsDocumentId: body.renews_document_id ?? null,
      userId: auth.userId,
      isSuperadmin,
      canIssueExceptional,
      allowMissing: body.allow_missing === true,
    });

    dispatch('document_generated', {
      entityType: 'generated_document',
      entityId: document.id,
      description: `Generated ${document.document_type} for ${document.recipient_name}`,
      actorId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      warnings,
      data: {
        id: document.id,
        unique_id: document.unique_id,
        title: document.title,
        document_type: document.document_type,
        recipient_name: document.recipient_name,
        recipient_email: document.recipient_email,
        subject_staff_id: document.subject_staff_id,
        lifecycle_status: document.lifecycle_status,
        signature_status: document.signature_status,
        template_version_id: document.template_version_id,
        clause_count: Array.isArray(document.clause_manifest) ? document.clause_manifest.length : 0,
        content_hash: document.content_hash,
        generated_at: document.generated_at,
        expires_at: document.expires_at,
        // The token is the access credential for the public page. It is
        // returned to the generator so they can share the link, and never
        // included in any listing.
        verification_url: verificationUrl(document.unique_id, document.verification_token),
        preview_html: body.return_html === true ? html : undefined,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return NextResponse.json(
        { success: false, error: error.message, ...error.details },
        { status: 422 }
      );
    }
    if (error.code === 'VERIFICATION_SECRET_MISSING') {
      return NextResponse.json(
        { success: false, code: error.code, error: error.message }, { status: 503 });
    }
    console.error('[Documents/Generate] POST error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to generate the document' }, { status: 500 });
  }
}

/**
 * GET /api/documents/generate — list generated documents.
 *
 * Gains the filters, search and sorting the previous version lacked, and never
 * selects `verification_token` or `verification_hash` into a list payload.
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'documents.view_generated');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

    // Filters are built once, already qualified with the `g.` alias, and the
    // same string is used for the count and the page. An earlier draft of this
    // route rewrote column names into the WHERE clause with a regex, which was
    // clever and fragile; this is neither.
    const where = [];
    const params = [];
    const add = (sql, value) => { params.push(value); where.push(sql.replace('$?', `$${params.length}`)); };

    const docType = searchParams.get('document_type');
    if (docType) add('g.document_type = $?', docType);

    const lifecycle = searchParams.get('lifecycle_status');
    if (lifecycle) add('g.lifecycle_status = $?', lifecycle);

    const signature = searchParams.get('signature_status');
    if (signature) add('g.signature_status = $?', signature);

    const templateId = searchParams.get('template_id');
    if (templateId) add('g.template_id = $?::uuid', templateId);

    const staffId = searchParams.get('subject_staff_id');
    if (staffId) add('g.subject_staff_id = $?::uuid', staffId);

    const categoryId = searchParams.get('category_id');
    if (categoryId) add('g.category_id = $?::uuid', categoryId);

    const email = searchParams.get('recipient_email');
    if (email) add('g.recipient_email ILIKE $?', `%${email}%`);

    const q = searchParams.get('q');
    if (q) {
      params.push(`%${q}%`);
      where.push(`(g.recipient_name ILIKE $${params.length} ` +
                 `OR g.unique_id ILIKE $${params.length} ` +
                 `OR g.title ILIKE $${params.length})`);
    }

    const from = searchParams.get('from');
    if (from) add('g.generated_at >= $?::timestamptz', from);
    const to = searchParams.get('to');
    if (to) add('g.generated_at <= $?::timestamptz', to);

    // Documents whose expiry is approaching — the "expiring soon" view.
    const expiringDays = searchParams.get('expiring_within_days');
    if (expiringDays) {
      params.push(Math.min(3650, Math.max(1, parseInt(expiringDays, 10) || 30)));
      where.push(`g.expires_at IS NOT NULL AND g.expires_at > NOW() ` +
                 `AND g.expires_at <= NOW() + ($${params.length} || ' days')::interval`);
    }

    // Missing required documentation is asked for as a negative: show staff
    // documents that were never issued.
    if (searchParams.get('unissued') === '1') {
      where.push(`g.lifecycle_status IN ('draft','pending_approval','rejected')`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Whitelisted sort: never interpolate a user string into ORDER BY.
    const SORTS = {
      generated_at: 'generated_at',
      recipient_name: 'recipient_name',
      expires_at: 'expires_at',
      lifecycle_status: 'lifecycle_status',
      unique_id: 'unique_id',
    };
    const sortCol = SORTS[searchParams.get('sort')] ?? 'generated_at';
    const dir = searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC';

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM generated_documents g ${whereSql}`, params);

    const dataRes = await query(
      `SELECT g.id, g.unique_id, g.title, g.document_type,
              g.recipient_name, g.recipient_email,
              g.subject_staff_id, s.name AS subject_staff_name,
              g.lifecycle_status, g.signature_status, g.status, g.is_revoked,
              g.generated_at, g.issued_at, g.executed_at, g.expires_at,
              g.viewed_count, g.last_viewed_at, g.revision,
              g.template_id, t.name AS template_name,
              g.template_version_id, tv.version AS template_version,
              g.profile_id, p.code AS profile_code, p.name AS profile_name,
              jsonb_array_length(g.clause_manifest) AS clause_count,
              (g.html_content IS NOT NULL) AS has_content_snapshot
         FROM generated_documents g
         LEFT JOIN staff s ON s.id = g.subject_staff_id
         LEFT JOIN document_templates t ON t.id = g.template_id
         LEFT JOIN document_template_versions tv ON tv.id = g.template_version_id
         LEFT JOIN document_template_profiles p ON p.id = g.profile_id
         ${whereSql}
         ORDER BY g.${sortCol} ${dir}, g.unique_id DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]);

    return NextResponse.json({
      success: true,
      data: dataRes.rows,
      total: countRes.rows[0].total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Documents/Generate] GET error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch documents' }, { status: 500 });
  }
}
