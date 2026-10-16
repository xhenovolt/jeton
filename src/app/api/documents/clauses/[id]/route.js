import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { render, describeVariables } from '@/lib/document-template-engine.js';

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const r = await query(
      `SELECT c.*, u.name AS created_by_name
         FROM document_clauses c
         LEFT JOIN users u ON u.id = c.created_by
        WHERE c.id = $1`, [id]);
    if (!r.rows[0]) {
      return NextResponse.json({ success: false, error: 'Clause not found' }, { status: 404 });
    }

    const versions = await query(
      `SELECT v.id, v.version, v.name, v.body_format, v.changelog, v.published_at,
              v.governing_law, v.jurisdiction, v.legal_reviewer,
              u.name AS published_by_name,
              (SELECT COUNT(*)::int FROM generated_document_clauses gc
                WHERE gc.clause_version_id = v.id) AS documents_using
         FROM document_clause_versions v
         LEFT JOIN users u ON u.id = v.published_by
        WHERE v.clause_id = $1
        ORDER BY v.version DESC`, [id]);

    // Which issued documents contain this clause — the question a legal
    // reviewer asks, and the reason the relational record exists alongside the
    // frozen manifest.
    const documents = await query(
      `SELECT g.id, g.unique_id, g.title, g.recipient_name, g.lifecycle_status,
              g.issued_at, gc.clause_version_id, v.version
         FROM generated_document_clauses gc
         JOIN generated_documents g ON g.id = gc.generated_document_id
         LEFT JOIN document_clause_versions v ON v.id = gc.clause_version_id
        WHERE gc.clause_id = $1
        ORDER BY g.generated_at DESC
        LIMIT 100`, [id]);

    const profiles = await query(
      `SELECT pc.profile_id, pc.inclusion, p.code, p.name, t.name AS template_name
         FROM document_profile_clauses pc
         JOIN document_template_profiles p ON p.id = pc.profile_id
         JOIN document_templates t ON t.id = p.template_id
        WHERE pc.clause_id = $1
        ORDER BY t.name, p.tier`, [id]);

    const latest = versions.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        ...r.rows[0],
        detected_variables: describeVariables(r.rows[0].body ?? ''),
        versions: versions.rows,
        used_in_profiles: profiles.rows,
        used_in_documents: documents.rows,
        published_version: latest?.version ?? null,
        has_unpublished_changes: !!latest && latest.version !== r.rows[0].version,
      },
    });
  } catch (error) {
    console.error('[Documents/Clauses/[id]] GET error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch the clause' }, { status: 500 });
  }
}

/**
 * PUT — edit the working text of a clause.
 *
 * Editing never changes an issued document: generated documents reference a
 * `document_clause_versions` row, and that row is immutable. A clause whose
 * text has changed since its last publish is reported as having unpublished
 * changes, and composition keeps using the published version until someone
 * publishes a new one.
 */
export async function PUT(request, { params }) {
  const perm = await requirePermission(request, 'documents.manage_clauses');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const b = await request.json();

    const cur = await query(`SELECT * FROM document_clauses WHERE id = $1`, [id]);
    if (!cur.rows[0]) {
      return NextResponse.json({ success: false, error: 'Clause not found' }, { status: 404 });
    }

    if ('body' in b && b.body) {
      const probe = render(b.body, {});
      if (probe.errors.length) {
        return NextResponse.json({
          success: false,
          error: 'This clause has template-syntax errors.',
          errors: probe.errors,
        }, { status: 422 });
      }
    }

    // A clause cannot declare itself incompatible with itself.
    if (Array.isArray(b.incompatible_with) && b.incompatible_with.includes(id)) {
      return NextResponse.json(
        { success: false, error: 'A clause cannot be incompatible with itself.' }, { status: 400 });
    }

    const FIELDS = ['name', 'category', 'description', 'body', 'body_format',
      'applicable_document_types', 'incompatible_with', 'is_required_default',
      'status', 'governing_law', 'jurisdiction', 'legal_reviewer', 'legal_source',
      'effective_date', 'next_review_date'];

    const sets = [];
    const values = [];
    for (const f of FIELDS) {
      if (!(f in b)) continue;
      values.push(b[f]);
      sets.push(`${f} = $${values.length}`);
    }
    if ('legal_reviewer' in b && b.legal_reviewer) sets.push('legal_reviewed_at = NOW()');

    if (!sets.length) {
      return NextResponse.json({ success: false, error: 'Nothing to update.' }, { status: 400 });
    }
    sets.push('updated_at = NOW()');
    values.push(id);

    const r = await query(
      `UPDATE document_clauses SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values);

    const bodyChanged = 'body' in b && b.body !== cur.rows[0].body;

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'DOCUMENT_CLAUSE_UPDATED','document_clause',$2,$3)`,
      [auth.userId, id, JSON.stringify({
        fields: Object.keys(b).filter(k => FIELDS.includes(k)),
        body_changed: bodyChanged,
      })]).catch(() => {});

    return NextResponse.json({
      success: true,
      data: r.rows[0],
      notice: bodyChanged
        ? 'Saved as a draft change. Documents already issued keep the clause version they ' +
          'were produced with, and new documents keep using the published version until you ' +
          'publish this one.'
        : undefined,
    });
  } catch (error) {
    console.error('[Documents/Clauses/[id]] PUT error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to update the clause' }, { status: 500 });
  }
}

/** DELETE — archive when in use; hard-delete only an unused clause. */
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'documents.manage_clauses');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;

    const usage = await query(
      `SELECT (SELECT COUNT(*)::int FROM generated_document_clauses WHERE clause_id = $1) AS documents,
              (SELECT COUNT(*)::int FROM document_profile_clauses WHERE clause_id = $1) AS profiles,
              (SELECT COUNT(*)::int FROM document_clause_versions WHERE clause_id = $1) AS versions`,
      [id]);
    const u = usage.rows[0];

    if (u.documents > 0 || u.versions > 0) {
      // Issued documents reference the versions; the clause record must stay.
      const r = await query(
        `UPDATE document_clauses SET status = 'archived', updated_at = NOW()
          WHERE id = $1 RETURNING name`, [id]);
      if (!r.rows[0]) {
        return NextResponse.json({ success: false, error: 'Clause not found' }, { status: 404 });
      }
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1,'DOCUMENT_CLAUSE_ARCHIVED','document_clause',$2,$3)`,
        [auth.userId, id, JSON.stringify(u)]).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `"${r.rows[0].name}" was archived rather than deleted: it appears in ` +
                 `${u.documents} issued document(s). Archived clauses cannot be added to ` +
                 `new documents.`,
        usage: u,
      });
    }

    if (u.profiles > 0) {
      await query(`DELETE FROM document_profile_clauses WHERE clause_id = $1`, [id]);
    }
    const r = await query(`DELETE FROM document_clauses WHERE id = $1 RETURNING name`, [id]);
    if (!r.rows[0]) {
      return NextResponse.json({ success: false, error: 'Clause not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: `"${r.rows[0].name}" deleted.` });
  } catch (error) {
    console.error('[Documents/Clauses/[id]] DELETE error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to remove the clause' }, { status: 500 });
  }
}
