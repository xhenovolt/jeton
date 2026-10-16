import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { describeVariables } from '@/lib/document-template-engine.js';

const LIFECYCLE = ['draft', 'review', 'approved', 'published', 'deprecated', 'archived'];

/**
 * A template's own metadata, its versions and its profiles.
 */
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;

    const result = await query(
      `SELECT t.*,
              u.name AS owner_name, a.name AS approved_by_name,
              d.name AS department_name,
              (SELECT COUNT(*)::int FROM generated_documents g WHERE g.template_id = t.id) AS generated_count,
              (SELECT COUNT(*)::int FROM document_template_versions v WHERE v.template_id = t.id) AS version_count
         FROM document_templates t
         LEFT JOIN users u ON u.id = t.owner_id
         LEFT JOIN users a ON a.id = t.approved_by
         LEFT JOIN departments d ON d.id = t.department_id
        WHERE t.id = $1`, [id]);

    const template = result.rows[0];
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    const versions = await query(
      `SELECT v.id, v.version, v.name, v.body_format, v.changelog, v.published_at,
              v.governing_law, v.jurisdiction, v.legal_reviewer,
              u.name AS published_by_name,
              length(v.body) AS body_length,
              (SELECT COUNT(*)::int FROM generated_documents g WHERE g.template_version_id = v.id) AS documents_issued
         FROM document_template_versions v
         LEFT JOIN users u ON u.id = v.published_by
        WHERE v.template_id = $1
        ORDER BY v.version DESC`, [id]);

    const profiles = await query(
      `SELECT p.*,
              (SELECT COUNT(*)::int FROM document_profile_clauses pc WHERE pc.profile_id = p.id) AS clause_count
         FROM document_template_profiles p
        WHERE p.template_id = $1
        ORDER BY p.tier, p.name`, [id]);

    return NextResponse.json({
      success: true,
      data: {
        ...template,
        // Derived from the body so the editor shows what the template actually
        // needs, rather than a `variables` column that drifts out of date.
        detected_variables: describeVariables(template.body ?? ''),
        versions: versions.rows,
        profiles: profiles.rows,
      },
    });
  } catch (error) {
    console.error('[Documents/Templates/[id]] GET error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch template' }, { status: 500 });
  }
}

/**
 * PUT — edit a template.
 *
 * THE DEFECT THIS REPLACES
 *
 * The previous handler ran a blind `UPDATE … SET body = $4` with no version
 * record. Because the PDF and verification routes re-derived content from that
 * same column, editing a template silently rewrote the text of every contract
 * already issued from it.
 *
 * Now: editing changes only the WORKING copy. Published versions are immutable
 * rows in `document_template_versions`, and issued documents point at the
 * version they used. Editing a published template moves it back to 'draft'
 * unless the caller asks to publish, so the published version stays the one in
 * force until someone deliberately replaces it.
 *
 * It is also a partial update now. The old handler wrote every column from the
 * request body, so a client that omitted `description` erased it.
 */
export async function PUT(request, { params }) {
  const perm = await requirePermission(request, 'documents.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const body = await request.json();

    const current = await query(`SELECT * FROM document_templates WHERE id = $1`, [id]);
    const tpl = current.rows[0];
    if (!tpl) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    if (tpl.status === 'archived' && body.status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'This template is archived. Restore it to draft before editing.',
      }, { status: 409 });
    }

    if (body.status !== undefined && !LIFECYCLE.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `status must be one of: ${LIFECYCLE.join(', ')}` }, { status: 400 });
    }
    // Publishing is a separate, audited action with its own permission.
    if (body.status === 'published' && tpl.status !== 'published') {
      return NextResponse.json({
        success: false,
        error: 'Use POST /api/documents/templates/[id]/publish to publish a template version.',
      }, { status: 400 });
    }

    // Only columns the caller actually sent are written.
    const FIELDS = {
      name: 'name', description: 'description', category: 'category',
      body: 'body', body_format: 'body_format',
      document_type: 'document_type', intended_audience: 'intended_audience',
      engagement_context: 'engagement_context', department_id: 'department_id',
      applicable_roles: 'applicable_roles',
      governing_law: 'governing_law', jurisdiction: 'jurisdiction',
      legal_reviewer: 'legal_reviewer', legal_review_notes: 'legal_review_notes',
      confidentiality: 'confidentiality',
      effective_date: 'effective_date', next_review_date: 'next_review_date',
      owner_id: 'owner_id', status: 'status', is_active: 'is_active',
    };

    const sets = [];
    const values = [];
    for (const [key, column] of Object.entries(FIELDS)) {
      if (!(key in body)) continue;
      values.push(key === 'variables' ? JSON.stringify(body[key]) : body[key]);
      sets.push(`${column} = $${values.length}`);
    }

    // Recording a legal review stamps the time, so "reviewed by" can never sit
    // in the record without a date.
    if ('legal_reviewer' in body && body.legal_reviewer) {
      sets.push(`legal_reviewed_at = NOW()`);
    }

    // Editing the text of a published template retires the published state:
    // the working copy and the in-force version are no longer the same thing.
    const bodyChanged = 'body' in body && body.body !== tpl.body;
    if (bodyChanged && tpl.status === 'published' && body.status === undefined) {
      values.push('draft');
      sets.push(`status = $${values.length}`);
    }

    if (!sets.length) {
      return NextResponse.json({ success: false, error: 'Nothing to update.' }, { status: 400 });
    }

    sets.push('updated_at = NOW()');
    values.push(id);

    const result = await query(
      `UPDATE document_templates SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values);

    const updated = result.rows[0];

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'DOCUMENT_TEMPLATE_UPDATED','document_template',$2,$3)`,
      [auth.userId, id, JSON.stringify({
        fields: Object.keys(body).filter(k => k in FIELDS),
        body_changed: bodyChanged,
        status: updated.status,
        demoted_from_published: bodyChanged && tpl.status === 'published',
      })]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      data: updated,
      notice: bodyChanged && tpl.status === 'published'
        ? 'The text changed, so this template moved back to draft. Documents already issued ' +
          'still use the published version; publish again to put the new text in force.'
        : undefined,
    });
  } catch (error) {
    console.error('[Documents/Templates/[id]] PUT error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to update template' }, { status: 500 });
  }
}

/**
 * DELETE — archive, or hard-delete only when nothing depends on it.
 *
 * The previous handler refused outright when any document referenced the
 * template, which left no way to retire one. Archiving is the correct action:
 * it removes the template from use without destroying the record that issued
 * contracts point at.
 */
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'documents.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === '1';

    const usage = await query(
      `SELECT (SELECT COUNT(*)::int FROM generated_documents WHERE template_id = $1) AS documents,
              (SELECT COUNT(*)::int FROM document_template_versions WHERE template_id = $1) AS versions,
              (SELECT COUNT(*)::int FROM documents WHERE template_id = $1) AS kb_documents`,
      [id]);
    const u = usage.rows[0];
    const inUse = u.documents > 0 || u.versions > 0 || u.kb_documents > 0;

    if (hard && inUse) {
      return NextResponse.json({
        success: false,
        error: `This template cannot be deleted: ${u.documents} issued document(s), ` +
               `${u.versions} published version(s) and ${u.kb_documents} library document(s) ` +
               `refer to it. Archive it instead — archiving removes it from use and keeps the ` +
               `record those documents depend on.`,
        usage: u,
      }, { status: 409 });
    }

    if (hard) {
      const del = await query(`DELETE FROM document_templates WHERE id = $1 RETURNING id, name`, [id]);
      if (!del.rows[0]) {
        return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
      }
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1,'DOCUMENT_TEMPLATE_DELETED','document_template',$2,$3)`,
        [auth.userId, id, JSON.stringify({ name: del.rows[0].name })]).catch(() => {});
      return NextResponse.json({ success: true, message: 'Template deleted.' });
    }

    const arch = await query(
      `UPDATE document_templates
          SET status = 'archived', is_active = FALSE, archived_at = NOW(), updated_at = NOW()
        WHERE id = $1 RETURNING id, name`, [id]);

    if (!arch.rows[0]) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'DOCUMENT_TEMPLATE_ARCHIVED','document_template',$2,$3)`,
      [auth.userId, id, JSON.stringify({ name: arch.rows[0].name, usage: u })]).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `"${arch.rows[0].name}" is archived and can no longer be used for new documents.`,
    });
  } catch (error) {
    console.error('[Documents/Templates/[id]] DELETE error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to remove template' }, { status: 500 });
  }
}
