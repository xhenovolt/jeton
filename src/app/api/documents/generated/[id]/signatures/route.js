import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { recordSignature, DocumentValidationError } from '@/lib/document-service.js';

/** The signature-state rows for a document. */
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const r = await query(
      `SELECT s.id, s.party_role, s.party_name, s.party_email, s.staff_id,
              s.status, s.is_required, s.sort_order,
              s.signed_copy_url, s.signed_copy_name, s.signed_at,
              s.declined_reason, s.recorded_at, s.provider, s.provider_reference,
              u.name AS recorded_by_name,
              st.name AS staff_name
         FROM document_signatures s
         LEFT JOIN users u ON u.id = s.recorded_by
         LEFT JOIN staff st ON st.id = s.staff_id
        WHERE s.generated_document_id = $1
        ORDER BY s.sort_order, s.party_name`, [id]);

    const doc = await query(
      `SELECT signature_status, lifecycle_status, executed_at
         FROM generated_documents WHERE id = $1`, [id]);

    return NextResponse.json({
      success: true,
      data: r.rows,
      document: doc.rows[0] ?? null,
      // Stated plainly so no caller mistakes this for an e-signature feature.
      capability_note:
        'Jeton records signature status and stores uploaded signed copies. It does not ' +
        'create or validate electronic signatures, and none of these states asserts that ' +
        'a signature is legally binding.',
    });
  } catch (error) {
    console.error('[Documents/Signatures] GET error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch signature records' }, { status: 500 });
  }
}

/** Add an expected signatory to an already-issued document. */
export async function POST(request, { params }) {
  const perm = await requirePermission(request, 'documents.record_signature');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;
    const b = await request.json();

    if (!b.party_name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'party_name is required' }, { status: 400 });
    }

    const doc = await query(
      `SELECT id, lifecycle_status FROM generated_documents WHERE id = $1`, [id]);
    if (!doc.rows[0]) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
    }

    const next = await query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n
         FROM document_signatures WHERE generated_document_id = $1`, [id]);

    const r = await query(
      `INSERT INTO document_signatures
         (generated_document_id, party_role, party_name, party_email, staff_id,
          is_required, sort_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
      [id, b.party_role ?? 'recipient', b.party_name.trim(), b.party_email ?? null,
       b.staff_id ?? null, b.is_required !== false, next.rows[0].n]);

    // Adding a required signatory to a document already marked executed means
    // it is no longer fully executed.
    if (b.is_required !== false) {
      await query(
        `UPDATE generated_documents
            SET signature_status = CASE
                  WHEN signature_status IN ('not_required','prepared') THEN 'pending'
                  WHEN signature_status = 'executed' THEN 'partially_signed'
                  ELSE signature_status END,
                lifecycle_status = CASE
                  WHEN lifecycle_status = 'executed' THEN 'issued' ELSE lifecycle_status END,
                executed_at = CASE WHEN lifecycle_status = 'executed' THEN NULL ELSE executed_at END,
                updated_at = NOW()
          WHERE id = $1`, [id]);
    }

    return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Documents/Signatures] POST error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to add the signatory' }, { status: 500 });
  }
}

/**
 * PATCH — record a received signed copy, or a decline.
 *
 * Body: { signature_id, signed_copy_url?, signed_copy_name?, declined?, declined_reason? }
 */
export async function PATCH(request, { params }) {
  const perm = await requirePermission(request, 'documents.record_signature');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const b = await request.json();

    if (!b.signature_id) {
      return NextResponse.json(
        { success: false, error: 'signature_id is required' }, { status: 400 });
    }

    // The signature must belong to the document in the URL; otherwise a caller
    // could record against any document by id.
    const owns = await query(
      `SELECT id FROM document_signatures WHERE id = $1 AND generated_document_id = $2`,
      [b.signature_id, id]);
    if (!owns.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'That signature record does not belong to this document.' },
        { status: 404 });
    }

    await recordSignature({
      signatureId: b.signature_id,
      userId: auth.userId,
      signedCopyUrl: b.signed_copy_url ?? null,
      signedCopyName: b.signed_copy_name ?? null,
      declined: b.declined === true,
      declinedReason: b.declined_reason ?? null,
    });

    const doc = await query(
      `SELECT signature_status, lifecycle_status, executed_at
         FROM generated_documents WHERE id = $1`, [id]);

    return NextResponse.json({
      success: true,
      message: b.declined === true ? 'Decline recorded.' : 'Signed copy recorded.',
      document: doc.rows[0] ?? null,
    });
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    }
    console.error('[Documents/Signatures] PATCH error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to record the signature' }, { status: 500 });
  }
}
