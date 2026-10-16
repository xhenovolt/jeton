import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { render, describeVariables } from '@/lib/document-template-engine.js';

/**
 * The clause library.
 *
 * Clauses are the reusable, versioned building blocks a document is composed
 * from. Before this existed, each document type's full text lived in one
 * template body, so there was no way to express "a developer NDA covers source
 * code and credentials, a contractor NDA covers only project materials"
 * without maintaining a second entire template — and no record of which terms
 * a given contract actually contained.
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { searchParams } = new URL(request.url);
    const where = [];
    const params = [];

    const category = searchParams.get('category');
    if (category) { params.push(category); where.push(`c.category = $${params.length}`); }

    const status = searchParams.get('status');
    if (status) { params.push(status); where.push(`c.status = $${params.length}`); }

    const docType = searchParams.get('document_type');
    if (docType) {
      params.push(docType);
      // An empty applicable_document_types means "any document type".
      where.push(`(cardinality(c.applicable_document_types) = 0
                   OR $${params.length} = ANY(c.applicable_document_types))`);
    }

    const q = searchParams.get('q');
    if (q) {
      params.push(`%${q}%`);
      where.push(`(c.name ILIKE $${params.length} OR c.code ILIKE $${params.length}
                   OR c.description ILIKE $${params.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const r = await query(
      `SELECT c.id, c.code, c.name, c.category, c.description, c.status, c.version,
              c.body_format, c.applicable_document_types, c.incompatible_with,
              c.is_required_default, c.governing_law, c.jurisdiction,
              c.legal_reviewer, c.legal_reviewed_at, c.legal_source,
              c.effective_date, c.next_review_date, c.created_at, c.updated_at,
              length(c.body) AS body_length,
              u.name AS created_by_name,
              (SELECT COUNT(*)::int FROM document_clause_versions v WHERE v.clause_id = c.id) AS version_count,
              (SELECT MAX(v.version) FROM document_clause_versions v WHERE v.clause_id = c.id) AS published_version,
              (SELECT COUNT(*)::int FROM document_profile_clauses pc WHERE pc.clause_id = c.id) AS used_in_profiles,
              (SELECT COUNT(*)::int FROM generated_document_clauses gc WHERE gc.clause_id = c.id) AS used_in_documents
         FROM document_clauses c
         LEFT JOIN users u ON u.id = c.created_by
         ${whereSql}
         ORDER BY c.category, c.name`, params);

    const categories = await query(
      `SELECT category, COUNT(*)::int AS n FROM document_clauses GROUP BY category ORDER BY category`);

    return NextResponse.json({
      success: true,
      data: r.rows.map(c => ({
        ...c,
        // A clause whose text has changed since its last publish would compose
        // from the OLD version, so the editor must say so.
        has_unpublished_changes: c.published_version != null && c.version !== c.published_version,
        usable: c.published_version != null && ['published', 'approved'].includes(c.status),
      })),
      categories: categories.rows,
    });
  } catch (error) {
    console.error('[Documents/Clauses] GET error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch clauses' }, { status: 500 });
  }
}

export async function POST(request) {
  const perm = await requirePermission(request, 'documents.manage_clauses');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const b = await request.json();

    if (!b.code || !b.name || !b.body) {
      return NextResponse.json(
        { success: false, error: 'code, name and body are required' }, { status: 400 });
    }
    if (!b.category) {
      return NextResponse.json({ success: false, error: 'category is required' }, { status: 400 });
    }

    const code = String(b.code).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '.').slice(0, 80);
    if (!code) {
      return NextResponse.json({ success: false, error: 'code is not usable' }, { status: 400 });
    }

    // A clause whose template syntax is broken renders silently wrong, so it
    // must not get into the library in the first place.
    const probe = render(b.body, {});
    if (probe.errors.length) {
      return NextResponse.json({
        success: false,
        error: 'This clause has template-syntax errors.',
        errors: probe.errors,
      }, { status: 422 });
    }

    const r = await query(
      `INSERT INTO document_clauses
         (code, name, category, description, body, body_format,
          applicable_document_types, incompatible_with, is_required_default,
          status, governing_law, jurisdiction, legal_reviewer, legal_source,
          effective_date, next_review_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [code, String(b.name).trim(), String(b.category).trim(), b.description ?? null,
       b.body, b.body_format ?? 'html',
       Array.isArray(b.applicable_document_types) ? b.applicable_document_types : [],
       Array.isArray(b.incompatible_with) ? b.incompatible_with : [],
       !!b.is_required_default, b.status ?? 'draft',
       b.governing_law ?? null, b.jurisdiction ?? null,
       b.legal_reviewer ?? null, b.legal_source ?? null,
       b.effective_date ?? null, b.next_review_date ?? null,
       auth.userId]);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'DOCUMENT_CLAUSE_CREATED','document_clause',$2,$3)`,
      [auth.userId, r.rows[0].id, JSON.stringify({ code, category: b.category })]).catch(() => {});

    return NextResponse.json({
      success: true,
      data: { ...r.rows[0], detected_variables: describeVariables(b.body) },
    }, { status: 201 });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'A clause with that code already exists.' }, { status: 409 });
    }
    console.error('[Documents/Clauses] POST error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to create the clause' }, { status: 500 });
  }
}
