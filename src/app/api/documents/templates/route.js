import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { render, describeVariables } from '@/lib/document-template-engine.js';

const LIFECYCLE = ['draft', 'review', 'approved', 'published', 'deprecated', 'archived'];
const CONFIDENTIALITY = ['public', 'internal', 'confidential', 'restricted'];

/**
 * GET /api/documents/templates — the template library.
 *
 * The previous version returned `SELECT *` filtered on `is_active = TRUE`,
 * which meant a draft under review was indistinguishable from a template in
 * force, and an archived one simply vanished with no way to find it. Status is
 * now explicit and filterable, and the default excludes archived rather than
 * hiding everything that is not active.
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(request.url);
    const where = [];
    const params = [];

    const status = searchParams.get('status');
    if (status === 'all') {
      // no filter
    } else if (status) {
      if (!LIFECYCLE.includes(status)) {
        return NextResponse.json(
          { success: false, error: `status must be one of: ${LIFECYCLE.join(', ')}, all` },
          { status: 400 });
      }
      params.push(status);
      where.push(`t.status = $${params.length}`);
    } else {
      where.push(`t.status <> 'archived'`);
    }

    // The generate screen only ever wants templates it can actually use.
    if (searchParams.get('usable') === '1') {
      where.push(`t.status = 'published' AND t.published_version_id IS NOT NULL`);
    }

    const category = searchParams.get('category');
    if (category) { params.push(category); where.push(`t.category = $${params.length}`); }

    const docType = searchParams.get('document_type');
    if (docType) { params.push(docType); where.push(`t.document_type = $${params.length}`); }

    const role = searchParams.get('role');
    if (role) {
      params.push(role);
      where.push(`(cardinality(t.applicable_roles) = 0 OR $${params.length} = ANY(t.applicable_roles))`);
    }

    const q = searchParams.get('q');
    if (q) {
      params.push(`%${q}%`);
      where.push(`(t.name ILIKE $${params.length} OR t.description ILIKE $${params.length})`);
    }

    // Templates whose review date has passed — the compliance view.
    if (searchParams.get('review_due') === '1') {
      where.push(`t.next_review_date IS NOT NULL AND t.next_review_date <= CURRENT_DATE`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT t.id, t.name, t.description, t.category, t.document_type,
              t.body_format, t.status, t.version, t.is_active,
              t.confidentiality, t.intended_audience, t.engagement_context,
              t.applicable_roles, t.department_id,
              t.governing_law, t.jurisdiction, t.legal_reviewer, t.legal_reviewed_at,
              t.effective_date, t.next_review_date,
              t.published_version_id, t.approved_at, t.archived_at,
              t.created_at, t.updated_at,
              length(t.body) AS body_length,
              u.full_name AS owner_name,
              d.name AS department_name,
              pv.version AS published_version,
              (SELECT COUNT(*)::int FROM document_template_versions v WHERE v.template_id = t.id) AS version_count,
              (SELECT COUNT(*)::int FROM document_template_profiles p WHERE p.template_id = t.id) AS profile_count,
              (SELECT COUNT(*)::int FROM generated_documents g WHERE g.template_id = t.id) AS generated_count
         FROM document_templates t
         LEFT JOIN users u ON u.id = t.owner_id
         LEFT JOIN departments d ON d.id = t.department_id
         LEFT JOIN document_template_versions pv ON pv.id = t.published_version_id
         ${whereSql}
         ORDER BY t.status = 'published' DESC, t.category NULLS LAST, t.name`,
      params);

    return NextResponse.json({
      success: true,
      data: result.rows.map(t => ({
        ...t,
        // A published template whose working copy has moved on would still
        // generate from the published version; the list says so plainly.
        usable_for_generation: t.status === 'published' && !!t.published_version_id,
        review_overdue: !!t.next_review_date && new Date(t.next_review_date) <= new Date(),
        legally_reviewed: !!t.legal_reviewer && !!t.legal_reviewed_at,
      })),
      lifecycle: LIFECYCLE,
    });
  } catch (error) {
    console.error('[Documents/Templates] GET error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch templates' }, { status: 500 });
  }
}

/**
 * POST — create a template.
 *
 * Created as a draft, always. Publishing is a separate, audited action
 * (`POST /templates/[id]/publish`) because publishing is what documents are
 * generated against.
 *
 * The body is parsed before it is stored: a template with an unbalanced
 * conditional renders silently wrong, and a contract is the wrong place to
 * discover that.
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'documents.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const b = await request.json();

    if (!b.name?.trim() || !b.body?.trim()) {
      return NextResponse.json(
        { success: false, error: 'name and body are required' }, { status: 400 });
    }
    if (b.confidentiality && !CONFIDENTIALITY.includes(b.confidentiality)) {
      return NextResponse.json(
        { success: false, error: `confidentiality must be one of: ${CONFIDENTIALITY.join(', ')}` },
        { status: 400 });
    }

    const probe = render(b.body, {});
    if (probe.errors.length) {
      return NextResponse.json({
        success: false,
        error: 'This template has template-syntax errors.',
        errors: probe.errors,
      }, { status: 422 });
    }

    const detected = describeVariables(b.body);

    const result = await query(
      `INSERT INTO document_templates
        (name, description, category, document_type, body, body_format, variables,
         owner_id, intended_audience, engagement_context, department_id, applicable_roles,
         governing_law, jurisdiction, legal_reviewer, legal_review_notes, confidentiality,
         effective_date, next_review_date,
         status, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
               'draft', FALSE, $20)
       RETURNING *`,
      [
        b.name.trim(), b.description ?? null, b.category ?? null,
        b.document_type ?? b.category ?? null,
        b.body, b.body_format ?? 'html',
        // Stored from the body rather than trusting a client-supplied list,
        // which is how `variables` drifted out of step with the template.
        JSON.stringify(detected.all),
        b.owner_id ?? auth.userId,
        b.intended_audience ?? null, b.engagement_context ?? null,
        b.department_id ?? null,
        Array.isArray(b.applicable_roles) ? b.applicable_roles : [],
        b.governing_law ?? null, b.jurisdiction ?? null,
        b.legal_reviewer ?? null, b.legal_review_notes ?? null,
        b.confidentiality ?? 'internal',
        b.effective_date ?? null, b.next_review_date ?? null,
        auth.userId,
      ]);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'DOCUMENT_TEMPLATE_CREATED','document_template',$2,$3)`,
      [auth.userId, result.rows[0].id,
       JSON.stringify({ name: b.name, category: b.category })]).catch(() => {});

    return NextResponse.json({
      success: true,
      data: { ...result.rows[0], detected_variables: detected },
      message: 'Created as a draft. Publish it when it is ready to be used for documents.',
    }, { status: 201 });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'A template with that name already exists' }, { status: 409 });
    }
    console.error('[Documents/Templates] POST error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to create template' }, { status: 500 });
  }
}
