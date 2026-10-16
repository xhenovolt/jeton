import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { clientIp, verificationUrl } from '@/lib/document-generation.js';
import { getActiveBranding } from '@/lib/company-branding.js';

/**
 * /api/documents/generated/[id] — one issued document.
 *
 * Lookup accepts the UUID or the human `unique_id` (XTN-…).
 *
 * WHAT THIS REPLACES
 *
 *   1. GET re-derived the body by substituting `placeholder_data` into the
 *      LIVE template. Editing the template therefore changed what an already
 *      issued contract appeared to say. It now reads the frozen
 *      `html_content` snapshot and nothing else.
 *
 *   2. PATCH wrote four columns that do not exist in this database —
 *      `revoked_at`, `revoked_by`, `revocation_reason` and `metadata`
 *      (verified against the live schema). So revoking a document through this
 *      route, or editing its metadata, failed with
 *      `column "revoked_at" does not exist` and returned a 500.
 *
 *   3. PATCH allowed `recipient_name` and `placeholder_data` to be rewritten
 *      on an executed contract, with no version and no amendment — changing
 *      the terms of a signed agreement in place. Issued and executed documents
 *      are now closed to content edits; a correction goes through the
 *      amendment path (`amends_document_id` on generate), which supersedes the
 *      original instead of overwriting it.
 *
 *   4. DELETE hard-deleted a legal record with no audit entry and no retention
 *      check.
 */

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));

/** Fields that may be corrected while a document is still a draft. */
const DRAFT_EDITABLE = [
  'title', 'recipient_name', 'recipient_email', 'recipient_phone', 'expires_at',
];

/** Fields that stay editable after issue because they are administrative. */
const ALWAYS_EDITABLE = ['expires_at', 'category_id', 'retention_policy_id'];

async function loadDocument(idOrUniqueId) {
  const where = isUuid(idOrUniqueId) ? 'g.id = $1::uuid' : 'UPPER(g.unique_id) = UPPER($1)';
  const r = await query(
    `SELECT g.*,
            t.name AS template_name, t.status AS template_status,
            tv.version AS template_version,
            p.code AS profile_code, p.name AS profile_name, p.tier AS profile_tier,
            s.name AS subject_staff_name, s.position AS subject_staff_position,
            u.full_name AS generated_by_name,
            iu.full_name AS issued_by_name,
            au.full_name AS approved_by_name
       FROM generated_documents g
       LEFT JOIN document_templates t ON t.id = g.template_id
       LEFT JOIN document_template_versions tv ON tv.id = g.template_version_id
       LEFT JOIN document_template_profiles p ON p.id = g.profile_id
       LEFT JOIN staff s ON s.id = g.subject_staff_id
       LEFT JOIN users u ON u.id = g.generated_by
       LEFT JOIN users iu ON iu.id = g.issued_by
       LEFT JOIN users au ON au.id = g.approved_by
      WHERE ${where} LIMIT 1`,
    [idOrUniqueId]
  );
  return r.rows[0] || null;
}

export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const doc = await loadDocument(id);
    if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const [clauses, signatures, approvals, logs] = await Promise.all([
      query(
        `SELECT gc.sort_order, gc.inclusion, gc.clause_id, gc.clause_version_id,
                c.code, c.name AS current_name, c.status AS current_status,
                v.version, v.name AS issued_name
           FROM generated_document_clauses gc
           JOIN document_clauses c ON c.id = gc.clause_id
           LEFT JOIN document_clause_versions v ON v.id = gc.clause_version_id
          WHERE gc.generated_document_id = $1
          ORDER BY gc.sort_order`, [doc.id]),
      query(
        `SELECT id, party_role, party_name, party_email, status, is_required,
                sort_order, signed_copy_url, signed_copy_name, signed_at, declined_reason
           FROM document_signatures
          WHERE generated_document_id = $1 ORDER BY sort_order`, [doc.id]),
      query(
        `SELECT a.step_order, a.status, a.decision_at, a.comment,
                u.full_name AS approver_name, r.full_name AS requested_by_name, a.requested_at
           FROM document_approvals a
           LEFT JOIN users u ON u.id = a.approver_id
           LEFT JOIN users r ON r.id = a.requested_by
          WHERE a.generated_document_id = $1 ORDER BY a.step_order`, [doc.id]),
      query(
        `SELECT l.action, l.created_at, l.details, u.full_name AS actor_name
           FROM document_audit_logs l
           LEFT JOIN users u ON u.id = l.actor_id
          WHERE l.document_id = $1 ORDER BY l.created_at DESC LIMIT 100`, [doc.id]),
    ]);

    let branding = null;
    try { branding = await getActiveBranding(); } catch { /* non-fatal */ }

    // The verification token is the access credential for the public page. It
    // is handed only to a caller who may issue documents, and never appears in
    // a listing.
    const canSeeToken = auth.role === 'superadmin';
    const { verification_token, verification_hash, ...safe } = doc;

    return NextResponse.json({
      success: true,
      data: {
        ...safe,
        // The frozen snapshot. Never re-rendered from the template.
        document_html: doc.html_content,
        has_content_snapshot: !!doc.html_content,
        content_snapshot_note: doc.html_content
          ? 'This is the exact content that was issued.'
          : 'This document predates content snapshots, so its original text cannot be ' +
            'reproduced faithfully. Regenerate it to create an auditable version.',
        clauses: clauses.rows.map(c => ({
          ...c,
          // Flags a clause whose library text has moved on since this document
          // was issued — useful for review, and harmless to the document.
          drifted: c.issued_name != null && c.current_name !== c.issued_name,
        })),
        signatures: signatures.rows,
        approvals: approvals.rows,
        activity: logs.rows,
        branding,
        verification_url: canSeeToken
          ? verificationUrl(doc.unique_id, verification_token)
          : undefined,
        content_fingerprint: doc.content_hash?.slice(0, 16) ?? null,
      },
    });
  } catch (err) {
    console.error('[Generated/[id]] GET error:', err.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch document' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'documents.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const doc = await loadDocument(id);
    if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));

    const closed = ['issued', 'executed', 'superseded', 'archived'].includes(doc.lifecycle_status);
    const editable = closed ? ALWAYS_EDITABLE : [...new Set([...DRAFT_EDITABLE, ...ALWAYS_EDITABLE])];

    // Refusing is the point: rewriting the recipient on a signed contract
    // would change a legal record with no trace of the original.
    const refused = Object.keys(body)
      .filter(k => DRAFT_EDITABLE.includes(k) && !editable.includes(k));
    if (refused.length) {
      return NextResponse.json({
        success: false,
        error: `This document is "${doc.lifecycle_status}", so ${refused.join(', ')} cannot be ` +
               `changed in place. Generate an amendment instead — it supersedes this document ` +
               `and keeps the original on record.`,
        amend_with: { amends_document_id: doc.id },
      }, { status: 409 });
    }

    const sets = [];
    const values = [];

    for (const field of editable) {
      if (body[field] === undefined) continue;
      let value = body[field];
      if (field === 'expires_at') value = (value === '' || value === null) ? null : value;
      values.push(value);
      sets.push(`${field} = $${values.length}`);
    }

    // Revocation. The previous handler wrote revoked_at / revoked_by /
    // revocation_reason, none of which exist in this schema, so revoking
    // through this route always returned a 500.
    if (body.is_revoked === true && !doc.is_revoked) {
      if (!String(body.revocation_reason ?? '').trim()) {
        return NextResponse.json(
          { success: false, error: 'A reason is required to revoke a document.' }, { status: 400 });
      }
      values.push(String(body.revocation_reason).trim().slice(0, 1000));
      sets.push(
        `is_revoked = TRUE`,
        `lifecycle_status = 'cancelled'`,
        `cancelled_at = NOW()`,
        `status = 'revoked'`,
        `cancellation_reason = $${values.length}`);
    } else if (body.is_revoked === false && doc.is_revoked) {
      sets.push(
        `is_revoked = FALSE`,
        `lifecycle_status = CASE WHEN issued_at IS NOT NULL THEN 'issued' ELSE 'approved' END`,
        `cancelled_at = NULL`,
        `cancellation_reason = NULL`,
        `status = 'active'`);
    }

    if (!sets.length) {
      return NextResponse.json(
        { success: false, error: 'No editable fields supplied' }, { status: 400 });
    }

    sets.push('updated_at = NOW()');
    values.push(doc.id);

    const r = await query(
      `UPDATE generated_documents SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values);

    await query(
      `INSERT INTO document_audit_logs (document_id, action, actor_id, details, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [doc.id,
       body.is_revoked === true ? 'revoked' : body.is_revoked === false ? 'unrevoked' : 'edited',
       auth.userId,
       JSON.stringify({
         fields: Object.keys(body).filter(k => editable.includes(k)),
         reason: body.revocation_reason ?? undefined,
       }),
       clientIp(request),
       request.headers.get('user-agent')?.slice(0, 500) ?? null]
    ).catch(e => console.error('[Generated/[id]] audit insert failed:', e.message));

    const { verification_token, verification_hash, ...safe } = r.rows[0];
    return NextResponse.json({ success: true, data: safe });
  } catch (err) {
    console.error('[Generated/[id]] PATCH error:', err.message);
    return NextResponse.json({ success: false, error: 'Failed to update the document' }, { status: 500 });
  }
}

/**
 * DELETE — archive. A hard delete is available only for a draft.
 *
 * The previous handler hard-deleted any document, including an executed
 * contract, with no audit entry. Legal and financial records are not removed
 * because someone clicked a bin icon; retention is a policy decision.
 */
export async function DELETE(request, { params }) {
  const perm = await requirePermission(request, 'documents.delete');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const doc = await loadDocument(id);
    if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === '1';

    if (hard && doc.lifecycle_status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: `"${doc.unique_id}" is ${doc.lifecycle_status} and cannot be deleted. ` +
               `Issued documents are a business record: revoke it if it should no longer be ` +
               `relied on, or archive it if it is simply finished.`,
      }, { status: 409 });
    }

    if (hard) {
      // Only a draft. The cascade removes its clause rows and logs with it.
      await query(`DELETE FROM generated_documents WHERE id = $1`, [doc.id]);
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1,'DOCUMENT_DRAFT_DELETED','generated_document',$2,$3)`,
        [auth.userId, doc.id, JSON.stringify({ unique_id: doc.unique_id })]).catch(() => {});
      return NextResponse.json({ success: true, message: `Draft ${doc.unique_id} deleted.` });
    }

    const r = await query(
      `UPDATE generated_documents
          SET lifecycle_status = 'archived', archived_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND lifecycle_status <> 'archived'
        RETURNING unique_id`, [doc.id]);

    if (!r.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'This document is already archived.' }, { status: 409 });
    }

    await query(
      `INSERT INTO document_audit_logs (document_id, action, actor_id, details)
       VALUES ($1,'archived',$2,$3)`,
      [doc.id, auth.userId, JSON.stringify({ from: doc.lifecycle_status })]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `${r.rows[0].unique_id} archived. It stays on record and in search with ` +
               `the archived filter.`,
    });
  } catch (err) {
    console.error('[Generated/[id]] DELETE error:', err.message);
    return NextResponse.json({ success: false, error: 'Failed to remove the document' }, { status: 500 });
  }
}
