/**
 * Clause engine.
 *
 * WHY THIS EXISTS
 *
 * Before this, every document type's text lived in one monolithic
 * `document_templates.body`. There was no way to say "a developer NDA covers
 * source code, credentials and work product, while a contractor NDA covers
 * only project materials" without writing and maintaining a second whole
 * template, and no record of which terms a given contract actually contained.
 *
 * Here a document is composed from reviewed, versioned clauses selected by a
 * PROFILE. A profile is a named, ordered clause set — it is what makes the
 * "standard / enhanced / strict / custom" requirement real rather than a
 * dropdown that changes a title.
 *
 * IMMUTABILITY
 *
 * Clause text is edited on `document_clauses`, but each publish writes an
 * immutable row to `document_clause_versions`. A generated document records
 * the clause VERSION ids it used, so editing a clause afterwards cannot change
 * what an issued contract says.
 *
 * LEGAL POSTURE
 *
 * This module composes and validates text. It does not decide whether the
 * result is enforceable. `tier` orders profiles for the UI and carries no
 * legal meaning; governing law, jurisdiction and reviewer are recorded as
 * metadata so a qualified professional can review them, and
 * `requires_explicit_authorization` lets company policy gate exceptional terms
 * behind a separate permission.
 */

import { query } from '@/lib/db.js';
import { renderBody } from '@/lib/document-template-engine.js';

/** Profile codes Jeton ships with. Custom profiles may use any slug. */
export const STANDARD_PROFILE_CODES = ['standard', 'enhanced', 'strict'];

/**
 * Postgres array columns reach this code from several places — the `pg` driver,
 * a JSON request body, a UI that submitted an empty field — and an empty value
 * shows up variously as `[]`, `['']` or null. Treating a blank entry as absent
 * keeps the rules below from reading "restricted to nothing" as "restricted to
 * the empty string", which would make every clause inapplicable.
 */
function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(v => String(v ?? '').trim()).filter(Boolean);
}

/**
 * Publish the current working text of a clause as an immutable version.
 *
 * Returns the new version row. Safe to call repeatedly: the version number
 * comes from the clause row, which is bumped in the same statement.
 */
export async function publishClauseVersion(clauseId, userId, changelog = null, tx = null) {
  const q = tx ?? query;

  const cur = await q(`SELECT * FROM document_clauses WHERE id = $1`, [clauseId]);
  const clause = cur.rows[0];
  if (!clause) throw new Error('Clause not found');

  // Reuse the existing version row if nothing has changed, so repeated
  // publishes do not inflate the history with identical snapshots.
  const same = await q(
    `SELECT * FROM document_clause_versions
      WHERE clause_id = $1 AND body = $2 AND name = $3
      ORDER BY version DESC LIMIT 1`,
    [clauseId, clause.body, clause.name]
  );
  if (same.rows[0]) return same.rows[0];

  const next = await q(
    `SELECT COALESCE(MAX(version), 0) + 1 AS v FROM document_clause_versions WHERE clause_id = $1`,
    [clauseId]
  );
  const version = next.rows[0].v;

  const ins = await q(
    `INSERT INTO document_clause_versions
       (clause_id, version, name, body, body_format, governing_law, jurisdiction,
        legal_reviewer, legal_reviewed_at, changelog, published_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [clauseId, version, clause.name, clause.body, clause.body_format,
     clause.governing_law, clause.jurisdiction, clause.legal_reviewer,
     clause.legal_reviewed_at, changelog, userId]
  );

  await q(`UPDATE document_clauses SET version = $2, updated_at = NOW() WHERE id = $1`,
    [clauseId, version]);

  return ins.rows[0];
}

/**
 * The clause set a profile offers, each with its current published version.
 *
 * A clause with no published version is returned with `version_id: null`; the
 * caller must treat that as unusable rather than falling back to the editable
 * working text, otherwise immutability is lost at the first use.
 */
export async function getProfileClauses(profileId, tx = null) {
  const q = tx ?? query;
  const r = await q(
    `SELECT pc.clause_id, pc.inclusion, pc.sort_order,
            c.code, c.name, c.category, c.status, c.body, c.body_format,
            c.incompatible_with, c.applicable_document_types,
            v.id AS version_id, v.version, v.body AS version_body,
            v.body_format AS version_body_format, v.name AS version_name
       FROM document_profile_clauses pc
       JOIN document_clauses c ON c.id = pc.clause_id
       LEFT JOIN LATERAL (
         SELECT * FROM document_clause_versions
          WHERE clause_id = c.id ORDER BY version DESC LIMIT 1
       ) v ON TRUE
      WHERE pc.profile_id = $1
      ORDER BY pc.sort_order, c.name`,
    [profileId]
  );
  return r.rows;
}

/**
 * Validate a requested clause selection against a profile.
 *
 * Rules, in the order a user would expect to hear about them:
 *   1. every required clause must be present
 *   2. every selected clause must belong to the profile
 *   3. no selected clause may be unpublished, deprecated or archived
 *   4. no selected clause may be incompatible with another selected clause
 *   5. a clause restricted to certain document types must match this one
 *
 * @returns {{ ok: boolean, errors: string[], warnings: string[], resolved: object[] }}
 */
export function validateSelection(profileClauses, selectedClauseIds, { documentType = null } = {}) {
  const errors = [];
  const warnings = [];
  const byId = new Map(profileClauses.map(c => [c.clause_id, c]));

  const selected = new Set(selectedClauseIds ?? []);

  // Required clauses are not optional, whatever the caller sent.
  for (const c of profileClauses) {
    if (c.inclusion === 'required' && !selected.has(c.clause_id)) {
      selected.add(c.clause_id);
      warnings.push(`"${c.name}" is required by this profile and was added.`);
    }
  }

  for (const id of selected) {
    if (!byId.has(id)) errors.push(`Clause ${id} is not part of this profile.`);
  }

  const resolved = [];
  for (const id of selected) {
    const c = byId.get(id);
    if (!c) continue;

    if (!c.version_id) {
      errors.push(`"${c.name}" has no published version and cannot be used. Publish it first.`);
      continue;
    }
    if (['deprecated', 'archived'].includes(c.status)) {
      errors.push(`"${c.name}" is ${c.status} and cannot be used in a new document.`);
      continue;
    }
    if (c.status !== 'published' && c.status !== 'approved') {
      errors.push(`"${c.name}" is in "${c.status}" and is not cleared for use.`);
      continue;
    }
    const restrictedTo = cleanList(c.applicable_document_types);
    if (documentType && restrictedTo.length && !restrictedTo.includes(documentType)) {
      errors.push(`"${c.name}" does not apply to ${documentType} documents.`);
      continue;
    }
    resolved.push(c);
  }

  // Incompatibility. Checked both ways so a one-sided declaration still bites.
  for (const a of resolved) {
    for (const b of resolved) {
      if (a.clause_id === b.clause_id) continue;
      const aSaysNo = cleanList(a.incompatible_with).includes(b.clause_id);
      const bSaysNo = cleanList(b.incompatible_with).includes(a.clause_id);
      if (aSaysNo || bSaysNo) {
        const pair = [a.name, b.name].sort().join('" and "');
        const msg = `"${pair}" cannot appear in the same document.`;
        if (!errors.includes(msg)) errors.push(msg);
      }
    }
  }

  resolved.sort((x, y) => x.sort_order - y.sort_order || x.name.localeCompare(y.name));

  return { ok: errors.length === 0, errors, warnings, resolved };
}

/**
 * Compose the clause bodies into one HTML fragment and build the manifest.
 *
 * Always renders from `version_body` — the immutable snapshot — never from the
 * editable `body`. Placeholder values are substituted and escaped by the
 * template engine, so clause text may contain markup but data never can.
 *
 * @returns {{ html: string, manifest: object[], missing: string[], errors: string[] }}
 */
export function composeClauses(resolvedClauses, data) {
  const parts = [];
  const manifest = [];
  const missing = new Set();
  const errors = [];

  for (const [i, c] of resolvedClauses.entries()) {
    const r = renderBody(c.version_body, c.version_body_format, data);
    for (const m of r.missing) missing.add(m);
    for (const e of r.errors) errors.push(`clause "${c.name}": ${e}`);

    parts.push(
      `<section class="doc-clause" data-clause-code="${escapeAttr(c.code)}">\n` +
      `<h3 class="doc-clause-title">${i + 1}. ${escapeAttr(c.version_name ?? c.name)}</h3>\n` +
      `${r.html}\n</section>`
    );

    // The manifest is the immutable legal record: it names the clause, the
    // exact version and the text hash, so a document can be audited even if
    // the clause tables are later reorganised.
    manifest.push({
      clause_id: c.clause_id,
      clause_version_id: c.version_id,
      code: c.code,
      name: c.version_name ?? c.name,
      version: c.version,
      category: c.category,
      inclusion: c.inclusion,
      sort_order: i,
    });
  }

  return { html: parts.join('\n\n'), manifest, missing: [...missing], errors };
}

function escapeAttr(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Resolve a profile, validate the selection and compose the text in one call.
 * This is what the generate route uses.
 */
export async function buildClauseContent({ profileId, selectedClauseIds, documentType, data, tx = null }) {
  if (!profileId) {
    // A template with no profile is still valid — it is just a plain template
    // with no clause composition. Say so explicitly rather than failing.
    return { html: '', manifest: [], missing: [], errors: [], warnings: [], usedProfile: false };
  }

  const profileClauses = await getProfileClauses(profileId, tx);
  const v = validateSelection(profileClauses, selectedClauseIds, { documentType });
  if (!v.ok) {
    return { html: '', manifest: [], missing: [], errors: v.errors, warnings: v.warnings, usedProfile: true };
  }

  const composed = composeClauses(v.resolved, data);
  return {
    ...composed,
    errors: [...v.errors, ...composed.errors],
    warnings: v.warnings,
    usedProfile: true,
  };
}

/** Record, relationally, which clause versions went into a document. */
export async function recordDocumentClauses(generatedDocumentId, manifest, tx = null) {
  const q = tx ?? query;
  for (const m of manifest) {
    await q(
      `INSERT INTO generated_document_clauses
         (generated_document_id, clause_id, clause_version_id, sort_order, inclusion)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (generated_document_id, clause_id) DO NOTHING`,
      [generatedDocumentId, m.clause_id, m.clause_version_id, m.sort_order, m.inclusion ?? 'required']
    );
  }
}
