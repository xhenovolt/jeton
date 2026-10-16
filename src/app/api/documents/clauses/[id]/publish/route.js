import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { publishClauseVersion } from '@/lib/document-clauses.js';
import { render } from '@/lib/document-template-engine.js';

/**
 * POST /api/documents/clauses/[id]/publish
 *
 * Freeze the clause's current text as an immutable version and mark it usable.
 * Composition always reads the published version, so this is the moment a
 * clause change begins to affect new documents — and it never affects
 * documents already issued.
 */
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'documents.manage_clauses');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const { changelog = null, require_legal_review = false } = await request.json().catch(() => ({}));

    const c = await query(`SELECT * FROM document_clauses WHERE id = $1`, [id]);
    const clause = c.rows[0];
    if (!clause) {
      return NextResponse.json({ success: false, error: 'Clause not found' }, { status: 404 });
    }
    if (!clause.body?.trim()) {
      return NextResponse.json(
        { success: false, error: 'This clause has no text to publish.' }, { status: 422 });
    }

    const probe = render(clause.body, {});
    if (probe.errors.length) {
      return NextResponse.json({
        success: false,
        error: 'This clause has template-syntax errors and cannot be published.',
        errors: probe.errors,
      }, { status: 422 });
    }

    if (require_legal_review && !clause.legal_reviewer) {
      return NextResponse.json({
        success: false,
        error: 'A legal reviewer must be recorded before this clause can be published.',
      }, { status: 422 });
    }

    const version = await publishClauseVersion(id, auth.userId, changelog);

    await query(
      `UPDATE document_clauses SET status = 'published', updated_at = NOW() WHERE id = $1`, [id]);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'DOCUMENT_CLAUSE_PUBLISHED','document_clause',$2,$3)`,
      [auth.userId, id, JSON.stringify({ version: version.version, changelog })]).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `"${clause.name}" version ${version.version} is now available to profiles.`,
      data: { version_id: version.id, version: version.version },
    }, { status: 201 });
  } catch (error) {
    console.error('[Documents/Clauses/publish] error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to publish the clause' }, { status: 500 });
  }
}
