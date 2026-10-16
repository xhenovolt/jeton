import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { getProfileClauses } from '@/lib/document-clauses.js';

/** One profile, with the clause set it offers and each clause's usability. */
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const p = await query(
      `SELECT p.*, t.name AS template_name, t.document_type
         FROM document_template_profiles p
         JOIN document_templates t ON t.id = p.template_id
        WHERE p.id = $1`, [id]);
    if (!p.rows[0]) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    const clauses = await getProfileClauses(id);

    return NextResponse.json({
      success: true,
      data: {
        ...p.rows[0],
        clauses: clauses.map(c => ({
          clause_id: c.clause_id,
          code: c.code,
          name: c.name,
          category: c.category,
          status: c.status,
          inclusion: c.inclusion,
          sort_order: c.sort_order,
          version: c.version,
          clause_version_id: c.version_id,
          // The editor must show WHY a clause cannot be used, rather than
          // letting generation fail later with the same information.
          usable: !!c.version_id && ['published', 'approved'].includes(c.status),
          blocked_reason: !c.version_id
            ? 'No published version — publish the clause first.'
            : ['published', 'approved'].includes(c.status) ? null
            : `Clause status is "${c.status}".`,
        })),
      },
    });
  } catch (error) {
    console.error('[Documents/Profiles/[id]] GET error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch the profile' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const perm = await requirePermission(request, 'documents.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const body = await request.json();

    const FIELDS = ['name', 'description', 'tier', 'is_default',
      'requires_explicit_authorization', 'applicable_roles', 'status'];
    const sets = [];
    const values = [];
    for (const f of FIELDS) {
      if (!(f in body)) continue;
      values.push(body[f]);
      sets.push(`${f} = $${values.length}`);
    }
    if (!sets.length) {
      return NextResponse.json({ success: false, error: 'Nothing to update.' }, { status: 400 });
    }
    sets.push('updated_at = NOW()');
    values.push(id);

    const r = await query(
      `UPDATE document_template_profiles SET ${sets.join(', ')}
        WHERE id = $${values.length} RETURNING *`, values);
    if (!r.rows[0]) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    if (body.is_default === true) {
      await query(
        `UPDATE document_template_profiles SET is_default = FALSE
          WHERE template_id = $1 AND id <> $2`, [r.rows[0].template_id, id]);
    }

    return NextResponse.json({ success: true, data: r.rows[0] });
  } catch (error) {
    console.error('[Documents/Profiles/[id]] PUT error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to update the profile' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'documents.manage');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const used = await query(
      `SELECT COUNT(*)::int AS n FROM generated_documents WHERE profile_id = $1`, [id]);

    if (used.rows[0].n > 0) {
      // Documents were issued under this profile, so the record must survive.
      const r = await query(
        `UPDATE document_template_profiles SET status = 'archived', updated_at = NOW()
          WHERE id = $1 RETURNING name`, [id]);
      if (!r.rows[0]) {
        return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: `"${r.rows[0].name}" was archived rather than deleted: ` +
                 `${used.rows[0].n} issued document(s) were produced under it.`,
      });
    }

    const r = await query(
      `DELETE FROM document_template_profiles WHERE id = $1 RETURNING name`, [id]);
    if (!r.rows[0]) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: `"${r.rows[0].name}" deleted.` });
  } catch (error) {
    console.error('[Documents/Profiles/[id]] DELETE error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to remove the profile' }, { status: 500 });
  }
}
