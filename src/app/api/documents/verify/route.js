import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import {
  isDocumentValid, safeEqual, clientIp, hasVerificationSecret,
} from '@/lib/document-generation.js';
import { getDocumentPolicy } from '@/lib/document-service.js';
import { getActiveBranding } from '@/lib/company-branding.js';

/**
 * GET /api/documents/verify?id=XTN-…&token=…  — PUBLIC, unauthenticated.
 *
 * WHAT THIS ENDPOINT USED TO DO
 *
 * It returned, to anyone on the internet, with no token required:
 *   - `recipient_name` and `recipient_email`
 *   - `rendered_body` — the full contract text with all data substituted
 *
 * The token check was `if (token && doc.verification_token !== token)`, so
 * omitting the token skipped it entirely. Documents are addressed by
 * `unique_id`, which is `XTN-<TYPE>-<YEAR>-<0001>` — sequential and trivially
 * enumerable. Walking the numbers exposed every employment agreement, NDA and
 * salary figure the company had ever issued.
 *
 * WHAT IT DOES NOW
 *
 *   - A valid token is REQUIRED by default, compared in constant time.
 *     `document_policy_settings.public_verification_mode` governs this and
 *     defaults to 'token_required'; 'disabled' turns the page off entirely and
 *     'id_sufficient' restores the old behaviour for organisations that
 *     deliberately want it.
 *   - Without a token, the answer is the same 404 as a non-existent document,
 *     so the endpoint cannot be used to discover which ids exist.
 *   - The document BODY is withheld unless policy explicitly opts in
 *     (`public_show_document_body`, default false). Verification means
 *     "this reference is genuine and current" — it does not require publishing
 *     the contract.
 *   - `recipient_email` is never returned; the name is partially masked.
 *   - `error.message` is no longer echoed to the public, which previously
 *     leaked schema details.
 */
export async function GET(request) {
  const ipAddress = clientIp(request);
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

  // Logging must never be able to fail the request. `ip_address` is an `inet`
  // column and the old code fed it Vercel's comma-separated x-forwarded-for
  // chain and the literal string 'unknown', both of which are invalid inet —
  // so the happy path raised a 500 in production. `document_id` is NOT NULL,
  // and the not-found branch passed null, producing a 500 instead of a 404.
  const logAttempt = async (documentId, status) => {
    if (!documentId) return;              // the column is NOT NULL by design
    try {
      await query(
        `INSERT INTO document_verification_logs (document_id, ip_address, user_agent, verification_status)
         VALUES ($1,$2,$3,$4)`,
        [documentId, ipAddress, userAgent, status]);
    } catch (e) {
      console.error('[Documents/Verify] log failed:', e.message);
    }
  };

  // One response shape for "no such document" and "wrong token", so the
  // endpoint reveals nothing about which ids are real.
  const notFound = () => NextResponse.json(
    { success: false, error: 'No valid document matches that reference.', status: 'not_found' },
    { status: 404 });

  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id')?.trim();
    const token = searchParams.get('token');

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'A document reference is required.' }, { status: 400 });
    }

    const policy = await getDocumentPolicy();

    if (policy.public_verification_mode === 'disabled') {
      return NextResponse.json(
        { success: false, error: 'Public document verification is turned off.', status: 'disabled' },
        { status: 403 });
    }

    const tokenRequired = policy.public_verification_mode !== 'id_sufficient';

    if (tokenRequired && !token) {
      // Deliberately the same answer as an unknown id.
      return notFound();
    }

    const docRes = await query(
      `SELECT g.id, g.unique_id, g.title, g.document_type, g.recipient_name,
              g.generated_at, g.issued_at, g.viewed_count, g.expires_at,
              g.lifecycle_status, g.signature_status, g.is_revoked,
              g.verification_token, g.html_content, g.content_hash,
              g.revision, g.template_version_id,
              tv.version AS template_version
         FROM generated_documents g
         LEFT JOIN document_template_versions tv ON tv.id = g.template_version_id
        WHERE UPPER(g.unique_id) = UPPER($1)`,
      [documentId]
    );

    const doc = docRes.rows[0];
    if (!doc) return notFound();

    // Constant-time comparison, and a wrong token is indistinguishable from a
    // missing document.
    if (tokenRequired && !safeEqual(token, doc.verification_token)) {
      await logAttempt(doc.id, 'failed');
      return notFound();
    }

    if (!isDocumentValid(doc)) {
      const status = doc.is_revoked ? 'revoked'
        : doc.lifecycle_status === 'cancelled' ? 'cancelled'
        : doc.lifecycle_status === 'superseded' ? 'superseded'
        : (doc.expires_at && new Date(doc.expires_at) < new Date()) ? 'expired'
        : 'not_issued';
      await logAttempt(doc.id, status);

      // The holder of a valid token is told WHY it is not valid, which is the
      // useful answer for someone checking a document they were given.
      return NextResponse.json({
        success: false,
        status,
        error:
          status === 'revoked'    ? 'This document has been revoked by the issuer.' :
          status === 'expired'    ? 'This document has expired.' :
          status === 'superseded' ? 'This document has been replaced by a later version.' :
          status === 'cancelled'  ? 'This document was cancelled.' :
                                    'This reference is not a currently issued document.',
        data: {
          id: doc.unique_id,
          document_type: doc.document_type,
          expires_at: doc.expires_at,
        },
      }, { status: 410 });
    }

    await logAttempt(doc.id, 'success');
    await query(
      `UPDATE generated_documents
          SET viewed_count = viewed_count + 1, last_viewed_at = NOW()
        WHERE id = $1`, [doc.id]
    ).catch(e => console.error('[Documents/Verify] view count failed:', e.message));

    // Branding, limited to what a public page legitimately needs to show who
    // issued the document.
    let branding = null;
    try {
      const b = await getActiveBranding();
      branding = {
        organization_name: b.organization_name,
        logo_url: b.logo_url,
        header_text: b.header_text,
        address_line1: b.address_line1,
        city: b.city,
        phone: b.phone,
        email: b.email,
        website: b.website,
        primary_color: b.primary_color,
      };
    } catch { /* a missing branding row must not break verification */ }

    return NextResponse.json({
      success: true,
      status: 'valid',
      data: {
        id: doc.unique_id,
        title: doc.title,
        document_type: doc.document_type,
        // Enough to confirm the document is the one in the reader's hand,
        // without publishing a full name next to a contract type.
        recipient_name: maskName(doc.recipient_name),
        issued_at: doc.issued_at ?? doc.generated_at,
        expires_at: doc.expires_at,
        revision: doc.revision,
        template_version: doc.template_version,
        signature_status: doc.signature_status,
        view_count: doc.viewed_count + 1,
        verified: true,
        // Proof the holder can check against their own copy without the body
        // being published.
        content_fingerprint: doc.content_hash ? doc.content_hash.slice(0, 16) : null,
        // Opt-in only. Verification does not require republishing the contract.
        document_html: policy.public_show_document_body ? doc.html_content : undefined,
        body_withheld: !policy.public_show_document_body,
        verification_secret_configured: hasVerificationSecret(),
      },
    });
  } catch (error) {
    // Never echo error.message to an anonymous caller.
    console.error('[Documents/Verify] GET error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Verification is temporarily unavailable.' }, { status: 500 });
  }
}

/**
 * "Hamuza Ashiraf" -> "Hamuza A."
 *
 * The public page must let a holder confirm the document is theirs, not
 * broadcast who holds which contract to anyone with a link.
 */
function maskName(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts.slice(1).map(p => `${p[0].toUpperCase()}.`).join(' ')}`;
}

/**
 * POST /api/documents/verify — revoke a document.
 *
 * Unchanged in intent, but it now records the lifecycle transition and the
 * reason, and requires one.
 */
export async function POST(request) {
  const { requirePermission } = await import('@/lib/permissions.js');
  const perm = await requirePermission(request, 'documents.revoke');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { document_id, reason } = await request.json();

    if (!document_id) {
      return NextResponse.json(
        { success: false, error: 'document_id is required' }, { status: 400 });
    }
    if (!String(reason ?? '').trim()) {
      return NextResponse.json(
        { success: false, error: 'A reason is required to revoke a document.' }, { status: 400 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(document_id);
    const r = await query(
      `UPDATE generated_documents
          SET is_revoked = TRUE,
              lifecycle_status = 'cancelled',
              cancelled_at = NOW(),
              cancellation_reason = $2,
              status = 'revoked',
              updated_at = NOW()
        WHERE ${isUuid ? 'id = $1::uuid' : 'UPPER(unique_id) = UPPER($1)'}
          AND is_revoked = FALSE
        RETURNING id, unique_id`,
      [document_id, String(reason).trim().slice(0, 1000)]
    );

    if (!r.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'Document not found, or it was already revoked.' }, { status: 404 });
    }

    await query(
      `INSERT INTO document_audit_logs (document_id, action, actor_id, details, ip_address, user_agent)
       VALUES ($1,'revoked',$2,$3,$4,$5)`,
      [r.rows[0].id, auth.userId, JSON.stringify({ reason }),
       clientIp(request), request.headers.get('user-agent')?.slice(0, 500) ?? null]
    ).catch(e => console.error('[Documents/Verify] audit insert failed:', e.message));

    return NextResponse.json({
      success: true,
      message: `${r.rows[0].unique_id} has been revoked.`,
    });
  } catch (error) {
    console.error('[Documents/Verify] POST error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke the document' }, { status: 500 });
  }
}
