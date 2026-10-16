import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';
import { getProfileClauses, validateSelection } from '@/lib/document-clauses.js';

/**
 * PUT /api/documents/profiles/[id]/clauses — set the profile's clause set.
 *
 * Body: { clauses: [{ clause_id, inclusion, sort_order }] }
 *
 * Replaces the whole set in one transaction, which is how a reorder and a
 * removal in the same edit stay consistent.
 *
 * Rejects a set that contains a declared incompatibility, so an impossible
 * profile cannot be saved and then fail at generation time, when a user is
 * halfway through issuing a contract.
 */
export async function PUT(request, { params }) {
  const perm = await requirePermission(request, 'documents.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { id } = await params;
    const { clauses } = await request.json();

    if (!Array.isArray(clauses)) {
      return NextResponse.json(
        { success: false, error: 'clauses must be an array' }, { status: 400 });
    }

    const p = await query(
      `SELECT p.id, p.name, p.template_id, t.document_type
         FROM document_template_profiles p
         JOIN document_templates t ON t.id = p.template_id
        WHERE p.id = $1`, [id]);
    if (!p.rows[0]) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    const ids = clauses.map(c => c.clause_id).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      return NextResponse.json(
        { success: false, error: 'The same clause appears more than once.' }, { status: 400 });
    }

    if (ids.length) {
      const found = await query(
        `SELECT id, name, incompatible_with FROM document_clauses WHERE id = ANY($1::uuid[])`, [ids]);
      if (found.rows.length !== ids.length) {
        return NextResponse.json(
          { success: false, error: 'One or more clauses do not exist.' }, { status: 400 });
      }

      // Catch an impossible combination now rather than at generation time.
      const byId = new Map(found.rows.map(c => [c.id, c]));
      const conflicts = [];
      for (const a of found.rows) {
        for (const b of found.rows) {
          if (a.id === b.id) continue;
          const list = (v) => (Array.isArray(v) ? v : []).map(x => String(x ?? '').trim()).filter(Boolean);
          if (list(a.incompatible_with).includes(b.id) || list(b.incompatible_with).includes(a.id)) {
            const pair = [a.name, b.name].sort().join('" and "');
            const msg = `"${pair}" are declared incompatible and cannot both be in one profile.`;
            if (!conflicts.includes(msg)) conflicts.push(msg);
          }
        }
      }
      if (conflicts.length) {
        return NextResponse.json(
          { success: false, error: 'This clause set contradicts itself.', errors: conflicts },
          { status: 422 });
      }
      void byId;
    }

    await withTransaction(async (tx) => {
      await tx(`DELETE FROM document_profile_clauses WHERE profile_id = $1`, [id]);
      for (const [i, c] of clauses.entries()) {
        if (!c.clause_id) continue;
        await tx(
          `INSERT INTO document_profile_clauses (profile_id, clause_id, inclusion, sort_order)
           VALUES ($1,$2,$3,$4)`,
          [id, c.clause_id,
           ['required', 'optional', 'available'].includes(c.inclusion) ? c.inclusion : 'required',
           Number.isFinite(Number(c.sort_order)) ? Number(c.sort_order) : i]);
      }
      await tx(`UPDATE document_template_profiles SET updated_at = NOW() WHERE id = $1`, [id]);
    });

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'DOCUMENT_PROFILE_CLAUSES_SET','document_profile',$2,$3)`,
      [auth.userId, id, JSON.stringify({ clause_count: ids.length })]).catch(() => {});

    // Report back whether the saved set can actually produce a document, so an
    // author learns about an unpublished clause here rather than later.
    const resolved = await getProfileClauses(id);
    const check = validateSelection(resolved, resolved.map(c => c.clause_id),
      { documentType: p.rows[0].document_type });

    return NextResponse.json({
      success: true,
      message: `${ids.length} clause(s) set on "${p.rows[0].name}".`,
      ready: check.ok,
      blocking: check.errors,
    });
  } catch (error) {
    console.error('[Documents/Profiles/clauses] PUT error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to update the clause set' }, { status: 500 });
  }
}
