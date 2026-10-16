import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * GET /api/documents/templates/[id]/versions
 *
 * The immutable publish history. `?version=N` returns that version's full
 * body, which is what the "compare versions" view and any audit of an issued
 * contract reads.
 */
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const want = searchParams.get('version');

    if (want) {
      const r = await query(
        `SELECT v.*, u.name AS published_by_name
           FROM document_template_versions v
           LEFT JOIN users u ON u.id = v.published_by
          WHERE v.template_id = $1 AND v.version = $2`,
        [id, parseInt(want, 10)]);
      if (!r.rows[0]) {
        return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: r.rows[0] });
    }

    const r = await query(
      `SELECT v.id, v.version, v.name, v.body_format, v.changelog, v.published_at,
              v.governing_law, v.jurisdiction, v.legal_reviewer, v.legal_reviewed_at,
              v.confidentiality, length(v.body) AS body_length,
              u.name AS published_by_name,
              (SELECT COUNT(*)::int FROM generated_documents g WHERE g.template_version_id = v.id) AS documents_issued,
              (t.published_version_id = v.id) AS is_in_force
         FROM document_template_versions v
         JOIN document_templates t ON t.id = v.template_id
         LEFT JOIN users u ON u.id = v.published_by
        WHERE v.template_id = $1
        ORDER BY v.version DESC`, [id]);

    return NextResponse.json({ success: true, data: r.rows });
  } catch (error) {
    console.error('[Documents/Templates/versions] GET error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch versions' }, { status: 500 });
  }
}
