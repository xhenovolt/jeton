import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * GET /api/staff/[id]/documents
 *
 * Every document that concerns one employee, plus what is missing.
 *
 * This is the integration the documentation system lacked entirely:
 * `generated_documents` held `recipient_name` as free text with no foreign key
 * to `staff`, so an employee's HR profile could not show their own contracts —
 * the same defect class as invoices that displayed "Unknown Client". Migration
 * 989 added `subject_staff_id`.
 *
 * No duplicate employee record is created or read here; `staff` remains the
 * only employee store.
 */
export async function GET(request, { params }) {
  // Reading someone's employment documents needs document rights, not merely
  // the right to see a staff list.
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;

    const staff = await query(
      `SELECT s.id, s.name, s.email, s.position, s.role, s.employment_type,
              s.employment_status, s.hire_date, s.join_date, d.name AS department_name
         FROM staff s
         LEFT JOIN departments d ON d.id = s.department_id
        WHERE s.id = $1`, [id]);

    if (!staff.rows[0]) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    const docs = await query(
      `SELECT g.id, g.unique_id, g.title, g.document_type,
              g.lifecycle_status, g.signature_status,
              g.generated_at, g.issued_at, g.executed_at, g.expires_at,
              g.revision, g.is_revoked,
              g.amends_document_id, g.renews_document_id,
              t.name AS template_name,
              tv.version AS template_version,
              p.name AS profile_name, p.code AS profile_code,
              (g.html_content IS NOT NULL) AS has_content_snapshot,
              (SELECT COUNT(*)::int FROM document_signatures ds
                WHERE ds.generated_document_id = g.id AND ds.is_required) AS signatures_required,
              (SELECT COUNT(*)::int FROM document_signatures ds
                WHERE ds.generated_document_id = g.id AND ds.is_required AND ds.status = 'signed') AS signatures_received
         FROM generated_documents g
         LEFT JOIN document_templates t ON t.id = g.template_id
         LEFT JOIN document_template_versions tv ON tv.id = g.template_version_id
         LEFT JOIN document_template_profiles p ON p.id = g.profile_id
        WHERE g.subject_staff_id = $1
        ORDER BY g.generated_at DESC`, [id]);

    // Which document types this employee should have, taken from the published
    // templates that declare their role as applicable. A template with no
    // declared roles is not treated as required for everyone — guessing that
    // would produce a wall of false "missing" entries.
    const emp = staff.rows[0];
    const roleKeys = [emp.role, emp.position, emp.employment_type].filter(Boolean);

    const expected = await query(
      `SELECT DISTINCT t.id, t.name, t.document_type, t.category
         FROM document_templates t
        WHERE t.status = 'published'
          AND cardinality(t.applicable_roles) > 0
          AND t.applicable_roles && $1::text[]`,
      [roleKeys]);

    const haveTypes = new Set(docs.rows
      .filter(d => ['issued', 'executed'].includes(d.lifecycle_status) && !d.is_revoked)
      .map(d => d.document_type));

    const missing = expected.rows.filter(e => !haveTypes.has(e.document_type ?? e.category));

    const now = Date.now();
    const soon = 60 * 86400000;   // 60 days

    return NextResponse.json({
      success: true,
      data: {
        staff: emp,
        documents: docs.rows,
        summary: {
          total: docs.rows.length,
          draft: docs.rows.filter(d => d.lifecycle_status === 'draft').length,
          pending_approval: docs.rows.filter(d => d.lifecycle_status === 'pending_approval').length,
          issued: docs.rows.filter(d => d.lifecycle_status === 'issued').length,
          executed: docs.rows.filter(d => d.lifecycle_status === 'executed').length,
          awaiting_signature: docs.rows.filter(d =>
            ['pending', 'partially_signed'].includes(d.signature_status)).length,
          expiring_soon: docs.rows.filter(d =>
            d.expires_at && new Date(d.expires_at).getTime() > now
            && new Date(d.expires_at).getTime() - now <= soon).length,
          expired: docs.rows.filter(d =>
            d.expires_at && new Date(d.expires_at).getTime() <= now).length,
          revoked: docs.rows.filter(d => d.is_revoked).length,
        },
        // Named explicitly so the UI can say WHY something is listed as
        // missing rather than showing an unexplained red badge.
        required_but_missing: missing.map(m => ({
          template_id: m.id,
          template_name: m.name,
          document_type: m.document_type ?? m.category,
          reason: `A published template for "${m.document_type ?? m.category}" applies to this ` +
                  `employee's role, and no issued document of that type exists.`,
        })),
        matched_on_roles: roleKeys,
      },
    });
  } catch (error) {
    console.error('[Staff/Documents] GET error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch the employee documents' }, { status: 500 });
  }
}
