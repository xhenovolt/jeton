import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import {
  composeDocument, resolveSubjectData, getDocumentPolicy, DocumentValidationError,
} from '@/lib/document-service.js';
import { formatDocumentWithBranding } from '@/lib/document-generation.js';
import { getActiveBranding } from '@/lib/company-branding.js';

/**
 * POST /api/documents/preview — see the document before issuing it.
 *
 * Deliberately uses `composeDocument`, the SAME function the generate path
 * uses. A preview rendered by different code is not a preview; the old design
 * had no preview at all, and the PDF route rendered something different again
 * (the raw template), so nobody could see what a recipient would receive.
 *
 * Writes nothing. No document number is consumed, no row is created.
 */
export async function POST(request) {
  const perm = await requirePermission(request, 'documents.generate');
  if (perm instanceof NextResponse) return perm;

  try {
    const b = await request.json();
    if (!b.template_id) {
      return NextResponse.json({ success: false, error: 'template_id is required' }, { status: 400 });
    }

    const policy = await getDocumentPolicy();
    const branding = await getActiveBranding();

    const t = await query(`SELECT * FROM document_templates WHERE id = $1`, [b.template_id]);
    const template = t.rows[0];
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    // Preview the version that WOULD be used: the published one if there is
    // one, otherwise the working copy, clearly labelled.
    let versionRow = null;
    if (template.published_version_id) {
      const v = await query(
        `SELECT * FROM document_template_versions WHERE id = $1`, [template.published_version_id]);
      versionRow = v.rows[0] ?? null;
    }

    const subjectData = await resolveSubjectData(b.subject_staff_id ?? null);

    const data = {
      ...subjectData,
      ...(b.placeholder_data ?? {}),
      recipient_name: b.recipient_name ?? subjectData.employee_name ?? null,
      recipient_email: b.recipient_email ?? subjectData.employee_email ?? null,
      recipient_phone: b.recipient_phone ?? null,
      company_name: branding.organization_name,
      today: new Date().toISOString().slice(0, 10),
      governing_law: template.governing_law ?? b.placeholder_data?.governing_law,
      jurisdiction: template.jurisdiction ?? b.placeholder_data?.jurisdiction,
    };

    const composed = await composeDocument({
      template,
      templateVersion: versionRow,
      profileId: b.profile_id ?? null,
      selectedClauseIds: b.clause_ids ?? null,
      data,
      documentType: b.document_type ?? template.document_type ?? template.category,
    });

    const html = await formatDocumentWithBranding(composed.html, branding, {
      // No real document id exists yet, so there is nothing honest to encode.
      includeQr: false,
      documentId: 'PREVIEW',
      documentTitle: `${template.name} (preview)`,
      watermark: 'PREVIEW',
      footerNote: 'Preview — not an issued document.',
    });

    return NextResponse.json({
      success: true,
      data: {
        html,
        // Everything the configure screen needs to tell the user what is wrong
        // BEFORE they try to issue.
        missing: composed.missing,
        errors: composed.errors,
        warnings: composed.warnings,
        variables: composed.variables,
        clauses: composed.manifest,
        can_generate: composed.errors.length === 0 && composed.missing.length === 0,
        template_status: template.status,
        using_version: versionRow?.version ?? null,
        using_working_copy: !versionRow,
        policy_requires_published_template: policy.require_approved_templates,
        blocked_by_policy:
          policy.require_approved_templates && template.status !== 'published',
      },
    });
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return NextResponse.json(
        { success: false, error: error.message, ...error.details }, { status: 422 });
    }
    console.error('[Documents/Preview] POST error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to build the preview' }, { status: 500 });
  }
}
