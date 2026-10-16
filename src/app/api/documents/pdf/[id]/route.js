import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { isDocumentValid, clientIp } from '@/lib/document-generation.js';
import { renderPdf, safeFilename } from '@/lib/document-pdf.js';

/**
 * GET /api/documents/pdf/[id] — download a generated document.
 *
 * `[id]` accepts either the `unique_id` (XTN-…) or the row's UUID.
 *
 * THREE DEFECTS THIS REPLACES
 *
 *   1. `const { id } = params` without `await`. On Next.js 16 `params` is a
 *      Promise, so `id` was always `undefined` and this route answered 400 to
 *      every single request.
 *
 *   2. It rendered `document.template_body` — the RAW TEMPLATE — so every PDF
 *      that did get produced contained literal `{{recipient_name}}`,
 *      `{{start_date}}` and so on. `placeholder_data` was selected in the same
 *      query and never used.
 *
 *   3. It re-derived content from the live template, which meant a template
 *      edit retroactively changed an already-issued contract.
 *
 * Now it serves the FROZEN snapshot (`html_content`) and nothing else. If no
 * snapshot exists — only documents generated before this change — it says so
 * rather than quietly reconstructing something that may not match what was
 * issued.
 */
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'A document id is required' }, { status: 400 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const docRes = await query(
      `SELECT g.id, g.unique_id, g.title, g.document_type, g.recipient_name,
              g.html_content, g.content_hash, g.lifecycle_status, g.is_revoked,
              g.expires_at, g.template_version_id
         FROM generated_documents g
        WHERE ${isUuid ? 'g.id = $1::uuid' : 'UPPER(g.unique_id) = UPPER($1)'}`,
      [id]
    );

    const document = docRes.rows[0];
    if (!document) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
    }

    // A revoked or expired document is still downloadable by an internal user
    // holding documents.view — the record must remain readable for audit — but
    // a draft has no issued content to hand out.
    if (document.lifecycle_status === 'draft') {
      return NextResponse.json(
        { success: false, error: 'This document is still a draft and has not been produced yet.' },
        { status: 409 });
    }

    if (!document.html_content) {
      // Documents generated before content snapshots existed. Reconstructing
      // from the current template would be a guess, and guessing about what a
      // contract said is worse than refusing.
      return NextResponse.json({
        success: false,
        code: 'NO_CONTENT_SNAPSHOT',
        error: 'This document was generated before Jeton stored document content, so its ' +
               'original text cannot be reproduced faithfully. Open the document and ' +
               'regenerate it to create an auditable version.',
      }, { status: 409 });
    }

    const filename = safeFilename(`${document.unique_id}_${document.title}`);
    const stamp = isDocumentValid(document) ? null : 'not currently valid';

    const pdf = await renderPdf(document.html_content, {
      title: `${document.unique_id} — ${document.title}`,
    });

    // Audit before returning, and never fail the download because the audit
    // insert failed.
    await query(
      `INSERT INTO document_audit_logs (document_id, action, actor_id, details, ip_address, user_agent)
       VALUES ($1,'downloaded',$2,$3,$4,$5)`,
      [document.id, auth.userId,
       JSON.stringify({ format: pdf.ok ? 'pdf' : 'html', validity: stamp }),
       clientIp(request),
       request.headers.get('user-agent')?.slice(0, 500) ?? null]
    ).catch(e => console.error('[Documents/PDF] audit insert failed:', e.message));

    if (pdf.ok) {
      return new NextResponse(pdf.buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(pdf.buffer.length),
          'Cache-Control': 'private, no-store',
        },
      });
    }

    // Honest fallback: serve the same frozen HTML as a print-ready page. The
    // document stylesheet carries the @page and break rules, so the browser's
    // own "Save as PDF" produces the intended pagination. The header tells the
    // client why it did not get a PDF.
    return new NextResponse(document.html_content, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${safeFilename(document.unique_id, 'html')}"`,
        'X-Jeton-Pdf-Fallback': '1',
        'X-Jeton-Pdf-Reason': pdf.reason.replace(/[^\x20-\x7E]/g, ' ').slice(0, 200),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[Documents/PDF] GET error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to produce the document' }, { status: 500 });
  }
}
