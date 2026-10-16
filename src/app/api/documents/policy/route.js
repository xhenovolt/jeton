import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { hasVerificationSecret } from '@/lib/document-generation.js';
import { pdfAvailable } from '@/lib/document-pdf.js';

const MODES = ['disabled', 'token_required', 'id_sufficient'];

/**
 * GET /api/documents/policy
 *
 * Company policy for the documentation module, plus the environment facts an
 * administrator needs in order to trust it: whether a verification secret is
 * configured and whether server-side PDF rendering is actually available in
 * this deployment. Reporting those honestly is the point — the system
 * previously claimed to produce verifiable PDFs while the signing secret
 * defaulted to a string committed to the repository and the QR code was a
 * blank pixel.
 */
export async function GET(request) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const r = await query(
      `SELECT p.*, u.full_name AS updated_by_name
         FROM document_policy_settings p
         LEFT JOIN users u ON u.id = p.updated_by
        WHERE p.id = 1`);

    const pdf = await pdfAvailable();

    return NextResponse.json({
      success: true,
      data: r.rows[0] ?? null,
      environment: {
        verification_secret_configured: hasVerificationSecret(),
        pdf_rendering_available: pdf.ok,
        pdf_rendering_note: pdf.ok
          ? 'Documents are rendered to PDF on the server.'
          : pdf.reason + ' Documents are served as print-ready HTML, which the browser can ' +
            'save as a PDF with the same pagination.',
      },
    });
  } catch (error) {
    console.error('[Documents/Policy] GET error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to read policy' }, { status: 500 });
  }
}

/**
 * PUT /api/documents/policy
 *
 * Relaxing public verification to `id_sufficient` is the one setting that can
 * expose contracts, because document references are sequential. The response
 * says so explicitly rather than accepting the change silently.
 */
export async function PUT(request) {
  const perm = await requirePermission(request, 'documents.manage_policy');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const b = await request.json();

    if (b.public_verification_mode !== undefined && !MODES.includes(b.public_verification_mode)) {
      return NextResponse.json(
        { success: false, error: `public_verification_mode must be one of: ${MODES.join(', ')}` },
        { status: 400 });
    }
    if (b.default_expiry_days !== undefined && b.default_expiry_days !== null) {
      const n = Number(b.default_expiry_days);
      if (!Number.isInteger(n) || n < 1 || n > 36500) {
        return NextResponse.json(
          { success: false, error: 'default_expiry_days must be between 1 and 36500, or null for no expiry.' },
          { status: 400 });
      }
    }

    const FIELDS = ['require_approved_templates', 'require_document_approval',
      'allow_superadmin_bypass', 'public_verification_mode',
      'public_show_document_body', 'default_expiry_days'];

    const sets = [];
    const values = [];
    for (const f of FIELDS) {
      if (!(f in b)) continue;
      values.push(b[f]);
      sets.push(`${f} = $${values.length}`);
    }
    if (!sets.length) {
      return NextResponse.json({ success: false, error: 'Nothing to update.' }, { status: 400 });
    }

    values.push(auth.userId);
    sets.push(`updated_by = $${values.length}`, 'updated_at = NOW()');

    const r = await query(
      `UPDATE document_policy_settings SET ${sets.join(', ')} WHERE id = 1 RETURNING *`, values);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'DOCUMENT_POLICY_UPDATED','document_policy',NULL,$2)`,
      [auth.userId, JSON.stringify(Object.fromEntries(
        Object.entries(b).filter(([k]) => FIELDS.includes(k))))]).catch(() => {});

    const warnings = [];
    if (r.rows[0].public_verification_mode === 'id_sufficient') {
      warnings.push(
        'Public verification now accepts a document reference with no token. References are ' +
        'sequential (XTN-TYPE-YEAR-0001), so anyone can enumerate them. Only use this if you ' +
        'intend document existence to be public.');
    }
    if (r.rows[0].public_show_document_body) {
      warnings.push(
        'The public verification page will now show full document content to anyone holding ' +
        'a valid link.');
    }
    if (r.rows[0].public_verification_mode === 'id_sufficient' && r.rows[0].public_show_document_body) {
      warnings.push(
        'Together, these two settings publish every issued document to the internet. This is ' +
        'the configuration the earlier version of Jeton had by default.');
    }

    return NextResponse.json({ success: true, data: r.rows[0], warnings });
  } catch (error) {
    console.error('[Documents/Policy] PUT error:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to update policy' }, { status: 500 });
  }
}
