import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { publishTemplateVersion, DocumentValidationError } from '@/lib/document-service.js';
import { describeVariables } from '@/lib/document-template-engine.js';

/**
 * POST /api/documents/templates/[id]/publish
 *
 * Freeze the template's current working body as an immutable version and put
 * it in force. This is the only way a template reaches the 'published' state,
 * because publishing is what documents are generated against — editing the
 * working copy must never change what is already in force.
 *
 * Refuses a template whose body does not parse: an unbalanced conditional
 * renders silently wrong, so it must not reach a contract.
 */
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'documents.publish_template');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const { changelog = null, require_legal_review = false } = await request.json().catch(() => ({}));

    const t = await query(`SELECT * FROM document_templates WHERE id = $1`, [id]);
    const tpl = t.rows[0];
    if (!tpl) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    // A template that will not render correctly must not become the version
    // that contracts are issued from.
    const { render } = await import('@/lib/document-template-engine.js');
    const probe = render(tpl.body ?? '', {});
    if (probe.errors.length) {
      return NextResponse.json({
        success: false,
        error: 'This template has template-syntax errors and cannot be published.',
        errors: probe.errors,
      }, { status: 422 });
    }

    if (require_legal_review && !tpl.legal_reviewer) {
      return NextResponse.json({
        success: false,
        error: 'A legal reviewer must be recorded before this template can be published.',
      }, { status: 422 });
    }

    const version = await publishTemplateVersion(id, auth.userId, changelog);

    await query(
      `UPDATE document_templates
          SET status = 'published', is_active = TRUE,
              approved_by = $2, approved_at = NOW(), updated_at = NOW()
        WHERE id = $1`, [id, auth.userId]);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'DOCUMENT_TEMPLATE_PUBLISHED','document_template',$2,$3)`,
      [auth.userId, id, JSON.stringify({
        version: version.version,
        version_id: version.id,
        changelog,
      })]).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `"${tpl.name}" version ${version.version} is now in force.`,
      data: {
        version_id: version.id,
        version: version.version,
        variables: describeVariables(tpl.body ?? ''),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return NextResponse.json({ success: false, error: error.message, ...error.details }, { status: 422 });
    }
    console.error('[Documents/Templates/publish] error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to publish the template' }, { status: 500 });
  }
}
