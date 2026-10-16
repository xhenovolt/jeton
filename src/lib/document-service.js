/**
 * Document service — the one place a document is generated, approved, issued
 * or amended.
 *
 * WHY A SERVICE LAYER
 *
 * Generation logic used to live inline in the route, which is how the route
 * ended up computing `htmlContent`, never storing it, launching Puppeteer,
 * throwing the PDF away, and writing the un-normalised `placeholder_data`
 * instead of the data it had actually rendered with. The PDF route then
 * re-derived content from the live template and shipped documents full of
 * `{{recipient_name}}`.
 *
 * Everything that decides what a document SAYS now happens here, once, inside
 * a transaction, and the result is frozen on the row.
 *
 * THE IMMUTABILITY RULE
 *
 * A generated document stores:
 *   - `template_version_id`  which published template version was used
 *   - `html_content`         the fully composed, substituted body
 *   - `content_hash`         SHA-256 of that body, for tamper detection
 *   - `clause_manifest`      the exact clause versions, frozen as JSON
 *   - `resolved_data`        the data actually substituted, not the raw input
 *
 * Nothing downstream re-renders. Editing a template or a clause afterwards
 * cannot change an issued document, which was the single worst defect in the
 * previous design.
 */

import { query, withTransaction } from '@/lib/db.js';
import { renderBody, describeVariables } from '@/lib/document-template-engine.js';
import { buildClauseContent, recordDocumentClauses } from '@/lib/document-clauses.js';
import {
  generateUniqueDocumentId,
  generateVerificationToken,
  generateVerificationHash,
  formatDocumentWithBranding,
  contentHash,
  verificationUrl,
  logDocumentGeneration,
} from '@/lib/document-generation.js';
import { getActiveBranding } from '@/lib/company-branding.js';

/** A validation failure the caller should show to the user, not a crash. */
export class DocumentValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'DocumentValidationError';
    this.code = 'DOCUMENT_VALIDATION';
    this.details = details;
  }
}

/** Read the singleton policy row, with safe defaults if it is somehow absent. */
export async function getDocumentPolicy(tx = null) {
  const q = tx ?? query;
  const r = await q(`SELECT * FROM document_policy_settings WHERE id = 1`);
  return r.rows[0] ?? {
    require_approved_templates: false,
    require_document_approval: false,
    allow_superadmin_bypass: true,
    public_verification_mode: 'token_required',
    public_show_document_body: false,
    default_expiry_days: null,
  };
}

/**
 * Publish a template's current working body as an immutable version.
 *
 * Called when a template moves to `published`, and by the generate path when a
 * template has never been published but policy does not require approval —
 * otherwise the first generation from a legacy template would have no version
 * to point at, and we would be back to rendering from mutable text.
 */
export async function publishTemplateVersion(templateId, userId, changelog = null, tx = null) {
  const q = tx ?? query;

  const t = await q(`SELECT * FROM document_templates WHERE id = $1`, [templateId]);
  const tpl = t.rows[0];
  if (!tpl) throw new DocumentValidationError('Template not found');
  if (!tpl.body || !tpl.body.trim()) {
    throw new DocumentValidationError('This template has no body, so there is nothing to publish.');
  }

  // Identical content should not create a second version.
  const same = await q(
    `SELECT * FROM document_template_versions
      WHERE template_id = $1 AND body = $2 AND name = $3
      ORDER BY version DESC LIMIT 1`,
    [templateId, tpl.body, tpl.name]
  );
  if (same.rows[0]) {
    await q(`UPDATE document_templates SET published_version_id = $2 WHERE id = $1`,
      [templateId, same.rows[0].id]);
    return same.rows[0];
  }

  const n = await q(
    `SELECT COALESCE(MAX(version),0) + 1 AS v FROM document_template_versions WHERE template_id = $1`,
    [templateId]);
  const version = n.rows[0].v;

  const ins = await q(
    `INSERT INTO document_template_versions
       (template_id, version, name, body, body_format, variables,
        governing_law, jurisdiction, legal_reviewer, legal_reviewed_at,
        confidentiality, changelog, published_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [templateId, version, tpl.name, tpl.body, tpl.body_format ?? 'html',
     JSON.stringify(tpl.variables ?? []), tpl.governing_law, tpl.jurisdiction,
     tpl.legal_reviewer, tpl.legal_reviewed_at, tpl.confidentiality,
     changelog, userId]
  );

  await q(
    `UPDATE document_templates
        SET version = $2, published_version_id = $3, updated_at = NOW()
      WHERE id = $1`,
    [templateId, version, ins.rows[0].id]);

  return ins.rows[0];
}

/**
 * Assemble the data a document is rendered from.
 *
 * Employee details come from the existing `staff` table — no second employee
 * store. Only an explicit field map is copied, so a contract never silently
 * picks up every column on a staff row (salary, for instance, belongs in an
 * offer letter but not in an NDA).
 */
export async function resolveSubjectData(subjectStaffId, tx = null) {
  if (!subjectStaffId) return {};
  const q = tx ?? query;
  const r = await q(
    `SELECT s.id, s.name, s.email, s.phone, s.position, s.role,
            s.employment_type, s.hire_date, s.join_date, s.salary, s.salary_currency,
            d.name AS department_name,
            m.name AS manager_name
       FROM staff s
       LEFT JOIN departments d ON d.id = s.department_id
       LEFT JOIN staff m ON m.id = s.manager_id
      WHERE s.id = $1`,
    [subjectStaffId]
  );
  const s = r.rows[0];
  if (!s) throw new DocumentValidationError('The selected employee no longer exists.');

  // An explicit map, deliberately. Adding a column to `staff` must not change
  // what appears in contracts.
  return {
    employee_name: s.name,
    employee_email: s.email,
    employee_phone: s.phone,
    employee_position: s.position ?? s.role,
    employee_role: s.role,
    employee_department: s.department_name,
    employee_manager: s.manager_name,
    employment_type: s.employment_type,
    employee_start_date: s.hire_date ?? s.join_date,
    employee_salary: s.salary,
    employee_salary_currency: s.salary_currency,
  };
}

/**
 * Compose a document without writing anything. Used by the preview endpoint so
 * that what a user reviews is produced by exactly the same code path that will
 * later issue the document.
 */
export async function composeDocument({
  template, templateVersion, profileId, selectedClauseIds, data, documentType, tx = null,
}) {
  const source = templateVersion ?? template;
  const body = source.body;
  const format = source.body_format ?? 'html';

  const clauses = await buildClauseContent({
    profileId,
    selectedClauseIds,
    documentType: documentType ?? template.document_type ?? template.category,
    data,
    tx,
  });

  // `{{clauses}}` is where a template chooses to place the composed clause
  // set. A template that does not mention it gets the clauses appended, so a
  // profile is never silently dropped.
  //
  // The slot becomes a sentinel before rendering and is substituted back
  // afterwards, so clause HTML never passes through the template engine (which
  // would escape it as a value) or the Markdown converter.
  const SLOT = '\u0000JETON_CLAUSES\u0000';
  const hasSlot = /\{\{\s*clauses\s*\}\}/.test(body);
  const withClauses = hasSlot
    ? body.replace(/\{\{\s*clauses\s*\}\}/g, SLOT)
    : body;

  const rendered = renderBody(withClauses, format, data);

  let html = rendered.html;
  if (hasSlot) {
    // A Markdown body leaves the sentinel inside a paragraph of its own.
    // Clause sections are block elements, so that <p> wrapper is dropped
    // first; otherwise the clauses would be nested inside a paragraph.
    html = html
      .split(`<p>${SLOT}</p>`).join(clauses.html)
      .split(SLOT).join(clauses.html);
  } else if (clauses.html) {
    html = `${html}\n${clauses.html}`;
  }

  const missing = [...new Set([...rendered.missing, ...clauses.missing])];
  const errors = [...rendered.errors, ...clauses.errors];

  return {
    html,
    missing,
    errors,
    warnings: clauses.warnings ?? [],
    manifest: clauses.manifest,
    variables: describeVariables(body),
  };
}

/**
 * Generate a document.
 *
 * Everything happens in one transaction: the number is allocated, the content
 * is frozen, the clause versions are recorded and the audit line is written,
 * or none of it is.
 *
 * @returns the created row plus the composed html
 */
export async function generateDocument({
  templateId,
  profileId = null,
  selectedClauseIds = null,
  documentType = null,
  recipientName,
  recipientEmail = null,
  recipientPhone = null,
  subjectStaffId = null,
  subjectType = null,
  subjectId = null,
  placeholderData = {},
  expiresInDays,
  categoryId = null,
  amendsDocumentId = null,
  renewsDocumentId = null,
  userId,
  isSuperadmin = false,
  canIssueExceptional = false,
  allowMissing = false,
}) {
  if (!templateId) throw new DocumentValidationError('A template must be selected.');

  const branding = await getActiveBranding();

  return withTransaction(async (tx) => {
    const policy = await getDocumentPolicy(tx);

    // ── the template, and the version we will actually render ───────────────
    const t = await tx(`SELECT * FROM document_templates WHERE id = $1`, [templateId]);
    const template = t.rows[0];
    if (!template) throw new DocumentValidationError('Template not found.');

    if (['archived', 'deprecated'].includes(template.status)) {
      throw new DocumentValidationError(
        `This template is ${template.status} and cannot be used for new documents.`);
    }
    if (policy.require_approved_templates && template.status !== 'published') {
      throw new DocumentValidationError(
        `Company policy allows generation only from published templates. ` +
        `"${template.name}" is in "${template.status}".`);
    }

    // Point at an immutable version. If the template has never been published,
    // publish the current body now rather than rendering from mutable text —
    // that is what made issued documents mutate retroactively.
    let versionRow = null;
    if (template.published_version_id) {
      const v = await tx(`SELECT * FROM document_template_versions WHERE id = $1`,
        [template.published_version_id]);
      versionRow = v.rows[0] ?? null;
    }
    if (!versionRow) {
      versionRow = await publishTemplateVersion(
        templateId, userId, 'Auto-published on first generation', tx);
    }

    // ── the profile, and whether this user may use it ───────────────────────
    let profile = null;
    if (profileId) {
      const p = await tx(
        `SELECT * FROM document_template_profiles WHERE id = $1 AND template_id = $2`,
        [profileId, templateId]);
      profile = p.rows[0];
      if (!profile) {
        throw new DocumentValidationError('That profile does not belong to this template.');
      }
      if (['archived', 'deprecated'].includes(profile.status)) {
        throw new DocumentValidationError(`This profile is ${profile.status}.`);
      }
      if (profile.requires_explicit_authorization && !canIssueExceptional) {
        throw new DocumentValidationError(
          `"${profile.name}" contains exceptional terms and needs the ` +
          `"documents.issue_exceptional" permission to use.`);
      }
    }

    // ── the data ────────────────────────────────────────────────────────────
    const subjectData = await resolveSubjectData(subjectStaffId, tx);

    const resolvedData = {
      // Company and document context first, so a caller cannot override the
      // document's own identity with a placeholder of the same name.
      ...subjectData,
      ...(placeholderData ?? {}),
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      recipient_phone: recipientPhone,
      company_name: branding.organization_name,
      today: new Date().toISOString().slice(0, 10),
      governing_law: template.governing_law ?? placeholderData?.governing_law,
      jurisdiction: template.jurisdiction ?? placeholderData?.jurisdiction,
    };

    if (!recipientName || !String(recipientName).trim()) {
      throw new DocumentValidationError('A recipient name is required.');
    }

    // ── compose ─────────────────────────────────────────────────────────────
    const composed = await composeDocument({
      template,
      templateVersion: versionRow,
      profileId,
      selectedClauseIds,
      data: resolvedData,
      documentType: documentType ?? template.document_type ?? template.category,
      tx,
    });

    if (composed.errors.length) {
      // Name the problems in the message, not only in `details`. A caller that
      // only logs `error.message` would otherwise report "cannot be produced
      // yet" with nothing actionable in it.
      throw new DocumentValidationError(
        `This document cannot be produced yet: ${composed.errors.join(' ')}`,
        { errors: composed.errors });
    }

    // Refusing here is the point. A contract with a blank salary or a blank
    // date looks identical to a correct one, which is how the old engine let
    // them through.
    if (composed.missing.length && !allowMissing) {
      throw new DocumentValidationError(
        `These fields have no value: ${composed.missing.join(', ')}. ` +
        `Fill them in, or make them optional in the template.`,
        { missing: composed.missing }
      );
    }

    // ── identity ────────────────────────────────────────────────────────────
    const docType = documentType ?? template.document_type ?? template.category ?? 'other';
    const prefix = String(docType).replace(/[^A-Za-z0-9]/g, '').slice(0, 3) || 'DOC';
    const uniqueId = await generateUniqueDocumentId(prefix, tx);
    const token = generateVerificationToken();
    const hash = generateVerificationHash(uniqueId);

    const days = expiresInDays === undefined ? policy.default_expiry_days : expiresInDays;
    const expiresAt = days ? new Date(Date.now() + Number(days) * 86400000) : null;

    // The revision is resolved BEFORE the insert, so the row returned to the
    // caller already carries it. An earlier version bumped it with a follow-up
    // UPDATE, which left the returned object saying revision 1.
    let revision = 1;
    if (amendsDocumentId) {
      const parent = await tx(
        `SELECT id, revision, lifecycle_status FROM generated_documents WHERE id = $1`,
        [amendsDocumentId]);
      if (!parent.rows[0]) {
        throw new DocumentValidationError('The document being amended no longer exists.');
      }
      if (parent.rows[0].lifecycle_status === 'draft') {
        throw new DocumentValidationError(
          'That document is still a draft, so edit it directly rather than amending it.');
      }
      revision = (parent.rows[0].revision ?? 1) + 1;
    }

    // ── freeze ──────────────────────────────────────────────────────────────
    const fullHtml = await formatDocumentWithBranding(composed.html, branding, {
      includeQr: true,
      qrText: verificationUrl(uniqueId, token),
      documentId: uniqueId,
      documentTitle: `${template.name} — ${recipientName}`,
    });

    // Approval is a policy question. Without it a document goes straight to
    // approved so that existing single-step use keeps working.
    const needsApproval = policy.require_document_approval
      && !(isSuperadmin && policy.allow_superadmin_bypass);

    const lifecycle = needsApproval ? 'pending_approval' : 'approved';

    const ins = await tx(
      `INSERT INTO generated_documents (
         template_id, template_version_id, profile_id, branding_id,
         unique_id, title, document_type,
         recipient_name, recipient_email, recipient_phone,
         subject_staff_id, subject_type, subject_id,
         placeholder_data, resolved_data, clause_manifest,
         html_content, content_hash,
         verification_token, verification_hash,
         category_id, generated_by, expires_at,
         lifecycle_status, signature_status, status,
         amends_document_id, renews_document_id, revision,
         submitted_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
         $21,$22,$23,$24,$25,$26,$27,$28,$29,$30
       ) RETURNING *`,
      [
        templateId, versionRow.id, profileId, branding.id,
        uniqueId, template.name, docType,
        String(recipientName).trim(), recipientEmail, recipientPhone,
        subjectStaffId, subjectType, subjectId,
        JSON.stringify(placeholderData ?? {}),
        JSON.stringify(resolvedData),
        JSON.stringify(composed.manifest),
        fullHtml, contentHash(fullHtml),
        token, hash,
        categoryId, userId, expiresAt,
        lifecycle, 'not_required', 'active',
        amendsDocumentId, renewsDocumentId, revision,
        needsApproval ? new Date() : null,
      ]
    );
    const doc = ins.rows[0];

    // Relational record of the clause versions, so "which live contracts
    // contain clause X v2?" is answerable.
    await recordDocumentClauses(doc.id, composed.manifest, tx);

    // A document that amends another supersedes it, rather than overwriting it.
    if (amendsDocumentId) {
      await tx(
        `UPDATE generated_documents
            SET lifecycle_status = 'superseded', updated_at = NOW()
          WHERE id = $1 AND lifecycle_status NOT IN ('superseded','archived')`,
        [amendsDocumentId]);
    }

    // If approval is required, open the first step.
    if (needsApproval) {
      await tx(
        `INSERT INTO document_approvals
           (generated_document_id, step_order, status, requested_by, requested_at, required_permission)
         VALUES ($1, 1, 'pending', $2, NOW(), 'documents.approve')`,
        [doc.id, userId]);
    }

    await logDocumentGeneration(tx, doc.id, 'info', 'generated',
      `Generated ${docType} for ${recipientName}`,
      {
        template_version: versionRow.version,
        profile: profile?.code ?? null,
        clauses: composed.manifest.length,
        lifecycle,
      }, userId);

    await tx(
      `INSERT INTO document_audit_logs (document_id, action, actor_id, details)
       VALUES ($1,'generated',$2,$3)`,
      [doc.id, userId, JSON.stringify({
        unique_id: uniqueId,
        template_version_id: versionRow.id,
        profile_id: profileId,
        clause_count: composed.manifest.length,
      })]
    );

    return { document: doc, html: fullHtml, warnings: composed.warnings };
  });
}

/**
 * Record an approval decision.
 *
 * A rejection must carry a reason — "rejected" with no explanation is not a
 * usable business record.
 */
export async function decideApproval({ documentId, approve, reason, userId }) {
  if (!approve && !String(reason ?? '').trim()) {
    throw new DocumentValidationError('A reason is required when rejecting a document.');
  }

  return withTransaction(async (tx) => {
    const d = await tx(`SELECT * FROM generated_documents WHERE id = $1`, [documentId]);
    const doc = d.rows[0];
    if (!doc) throw new DocumentValidationError('Document not found.');
    if (doc.lifecycle_status !== 'pending_approval') {
      throw new DocumentValidationError(
        `This document is "${doc.lifecycle_status}", so there is nothing awaiting a decision.`);
    }

    await tx(
      `UPDATE document_approvals
          SET status = $3, approver_id = $2, decision_at = NOW(), comment = $4
        WHERE generated_document_id = $1 AND status = 'pending'`,
      [documentId, userId, approve ? 'approved' : 'rejected', reason ?? null]);

    await tx(
      `UPDATE generated_documents
          SET lifecycle_status = $2,
              approved_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
              approved_by = CASE WHEN $3 THEN $4::uuid ELSE NULL END,
              updated_at = NOW()
        WHERE id = $1`,
      [documentId, approve ? 'approved' : 'rejected', approve, userId]);

    await tx(
      `INSERT INTO document_audit_logs (document_id, action, actor_id, details)
       VALUES ($1,$2,$3,$4)`,
      [documentId, approve ? 'approved' : 'rejected', userId,
       JSON.stringify({ reason: reason ?? null })]);

    return { ok: true };
  });
}

/**
 * Issue an approved document.
 *
 * `signatureParties` creates signature-STATE rows. Nothing here signs anything
 * or claims a signature is legally valid; it records who is expected to sign
 * and tracks whether a signed copy has been received.
 */
export async function issueDocument({ documentId, userId, signatureParties = [], bypassReason = null, isSuperadmin = false }) {
  return withTransaction(async (tx) => {
    const policy = await getDocumentPolicy(tx);
    const d = await tx(`SELECT * FROM generated_documents WHERE id = $1`, [documentId]);
    const doc = d.rows[0];
    if (!doc) throw new DocumentValidationError('Document not found.');

    if (doc.lifecycle_status === 'issued' || doc.lifecycle_status === 'executed') {
      throw new DocumentValidationError('This document has already been issued.');
    }

    let bypassed = null;
    if (doc.lifecycle_status === 'pending_approval') {
      // A bypass is permitted only where policy says so, and it is recorded on
      // the document and in the audit log — never silent.
      if (!(isSuperadmin && policy.allow_superadmin_bypass)) {
        throw new DocumentValidationError('This document is still awaiting approval.');
      }
      if (!String(bypassReason ?? '').trim()) {
        throw new DocumentValidationError('Issuing without approval requires a reason.');
      }
      bypassed = userId;
    } else if (doc.lifecycle_status !== 'approved') {
      throw new DocumentValidationError(
        `A document in "${doc.lifecycle_status}" cannot be issued.`);
    }

    const parties = Array.isArray(signatureParties) ? signatureParties.filter(p => p?.party_name) : [];
    for (const [i, p] of parties.entries()) {
      await tx(
        `INSERT INTO document_signatures
           (generated_document_id, party_role, party_name, party_email, staff_id,
            is_required, sort_order, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
        [documentId, p.party_role ?? 'recipient', String(p.party_name).trim(),
         p.party_email ?? null, p.staff_id ?? null, p.is_required !== false, i]);
    }

    await tx(
      `UPDATE generated_documents
          SET lifecycle_status = 'issued',
              signature_status = CASE WHEN $3 > 0 THEN 'pending' ELSE 'not_required' END,
              issued_at = NOW(), issued_by = $2,
              approval_bypassed_by = COALESCE($4::uuid, approval_bypassed_by),
              approval_bypass_reason = COALESCE($5, approval_bypass_reason),
              updated_at = NOW()
        WHERE id = $1`,
      [documentId, userId, parties.length, bypassed, bypassReason]);

    await tx(
      `INSERT INTO document_audit_logs (document_id, action, actor_id, details)
       VALUES ($1,'issued',$2,$3)`,
      [documentId, userId, JSON.stringify({
        signature_parties: parties.length,
        approval_bypassed: !!bypassed,
        bypass_reason: bypassReason ?? null,
      })]);

    return { ok: true };
  });
}

/**
 * Record that a signed copy has been received.
 *
 * The document becomes `executed` only once every required party has one on
 * file. This is bookkeeping about paper, not an assertion of legal validity.
 */
export async function recordSignature({ signatureId, userId, signedCopyUrl, signedCopyName, declined = false, declinedReason = null }) {
  return withTransaction(async (tx) => {
    const s = await tx(
      `SELECT ds.*, gd.id AS doc_id FROM document_signatures ds
         JOIN generated_documents gd ON gd.id = ds.generated_document_id
        WHERE ds.id = $1`, [signatureId]);
    const sig = s.rows[0];
    if (!sig) throw new DocumentValidationError('Signature record not found.');

    if (declined) {
      if (!String(declinedReason ?? '').trim()) {
        throw new DocumentValidationError('A reason is required when recording a decline.');
      }
      await tx(
        `UPDATE document_signatures
            SET status='declined', declined_reason=$2, recorded_by=$3, recorded_at=NOW(), updated_at=NOW()
          WHERE id=$1`, [signatureId, declinedReason, userId]);
      await tx(
        `UPDATE generated_documents SET signature_status='declined', updated_at=NOW() WHERE id=$1`,
        [sig.doc_id]);
    } else {
      if (!signedCopyUrl) {
        throw new DocumentValidationError('Attach the signed copy before recording it.');
      }
      await tx(
        `UPDATE document_signatures
            SET status='signed', signed_copy_url=$2, signed_copy_name=$3,
                signed_at=NOW(), recorded_by=$4, recorded_at=NOW(), updated_at=NOW()
          WHERE id=$1`,
        [signatureId, signedCopyUrl, signedCopyName ?? null, userId]);

      const outstanding = await tx(
        `SELECT COUNT(*)::int AS n FROM document_signatures
          WHERE generated_document_id=$1 AND is_required AND status <> 'signed'`,
        [sig.doc_id]);

      const allIn = outstanding.rows[0].n === 0;
      await tx(
        `UPDATE generated_documents
            SET signature_status = $2,
                lifecycle_status = CASE WHEN $3 THEN 'executed' ELSE lifecycle_status END,
                executed_at = CASE WHEN $3 THEN NOW() ELSE executed_at END,
                updated_at = NOW()
          WHERE id = $1`,
        [sig.doc_id, allIn ? 'executed' : 'partially_signed', allIn]);
    }

    await tx(
      `INSERT INTO document_audit_logs (document_id, action, actor_id, details)
       VALUES ($1,$2,$3,$4)`,
      [sig.doc_id, declined ? 'signature_declined' : 'signature_recorded', userId,
       JSON.stringify({ party_role: sig.party_role, party_name: sig.party_name })]);

    return { ok: true };
  });
}
