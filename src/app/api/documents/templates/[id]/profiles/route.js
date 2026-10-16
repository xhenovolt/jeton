import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * Restrictiveness profiles for one template.
 *
 * A profile is a NAMED, ORDERED CLAUSE SET — this is what makes
 * "standard / enhanced / strict / custom" a real difference in the issued text
 * rather than a dropdown that changes a title. `tier` only orders them in the
 * UI; it carries no legal meaning, because the effect of a document comes from
 * its clauses, its governing law and its context.
 */
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const r = await query(
      `SELECT p.*,
              (SELECT COUNT(*)::int FROM document_profile_clauses pc WHERE pc.profile_id = p.id) AS clause_count,
              (SELECT COUNT(*)::int FROM document_profile_clauses pc
                WHERE pc.profile_id = p.id AND pc.inclusion = 'required') AS required_count,
              (SELECT COUNT(*)::int FROM generated_documents g WHERE g.profile_id = p.id) AS documents_issued
         FROM document_template_profiles p
        WHERE p.template_id = $1
        ORDER BY p.tier, p.name`, [id]);

    return NextResponse.json({ success: true, data: r.rows });
  } catch (error) {
    console.error('[Documents/Profiles] GET error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'documents.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const {
      code, name, description, tier = 1, is_default = false,
      requires_explicit_authorization = false, applicable_roles = [],
      status = 'draft',
    } = await request.json();

    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: 'code and name are required' }, { status: 400 });
    }
    const slug = String(code).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 40);
    if (!slug) {
      return NextResponse.json({ success: false, error: 'code is not usable' }, { status: 400 });
    }

    const t = await query(`SELECT id FROM document_templates WHERE id = $1`, [id]);
    if (!t.rows[0]) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    const r = await query(
      `INSERT INTO document_template_profiles
         (template_id, code, name, description, tier, is_default,
          requires_explicit_authorization, applicable_roles, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, slug, String(name).trim(), description ?? null, Number(tier) || 1,
       !!is_default, !!requires_explicit_authorization,
       Array.isArray(applicable_roles) ? applicable_roles : [], status, auth.userId]);

    // Only one default per template.
    if (is_default) {
      await query(
        `UPDATE document_template_profiles SET is_default = FALSE
          WHERE template_id = $1 AND id <> $2`, [id, r.rows[0].id]);
    }

    return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'A profile with that code already exists on this template.' },
        { status: 409 });
    }
    console.error('[Documents/Profiles] POST error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to create the profile' }, { status: 500 });
  }
}
