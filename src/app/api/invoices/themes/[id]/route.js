import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * PATCH  /api/invoices/themes/[id]  — update fields; setting is_default
 *   here also unflags every other theme so exactly one wins.
 * DELETE /api/invoices/themes/[id]  — refuse to delete the default theme
 *   (must promote another first) so the app always has one to fall back to.
 */
export async function PATCH(request, { params }) {
  try {
    const perm = await requirePermission(request, 'invoices.manage_themes');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;
    const { id } = await params;

    const body = await request.json();
    const allowed = [
      'name','is_default',
      'primary_color','secondary_color','accent_color','background_color',
      'text_color','muted_color','border_color',
      'font_family','base_font_size',
      'paper_size','orientation','margins','rounded_corners','border_style',
      'header_layout','footer_layout','logo_size_px','logo_position',
      'qr_position','watermark_text','watermark_opacity',
      'show_seal','show_signature','show_bank_details','show_tax_section',
      'show_payment_instructions','show_terms','show_notes','show_qr','show_watermark',
    ];
    const sets = [];
    const values = [];
    for (const k of allowed) {
      if (k in body) {
        values.push(k === 'margins' && body[k] ? JSON.stringify(body[k]) : body[k]);
        sets.push(`${k} = $${values.length}`);
      }
    }
    if (sets.length === 0) {
      return NextResponse.json({ success: false, error: 'No updatable fields provided' }, { status: 400 });
    }
    values.push(auth.userId); sets.push(`updated_by = $${values.length}`);
    sets.push('updated_at = NOW()');
    values.push(id);

    const updated = await query(
      `UPDATE invoice_themes SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (updated.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Theme not found' }, { status: 404 });
    }

    if (updated.rows[0].is_default) {
      await query('UPDATE invoice_themes SET is_default = FALSE WHERE id != $1', [id]);
    }

    return NextResponse.json({ success: true, theme: updated.rows[0] });
  } catch (error) {
    console.error('[invoices/themes] PATCH error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const perm = await requirePermission(request, 'invoices.manage_themes');
    if (perm instanceof NextResponse) return perm;
    const { id } = await params;

    const row = await query('SELECT is_default FROM invoice_themes WHERE id = $1', [id]);
    if (row.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Theme not found' }, { status: 404 });
    }
    if (row.rows[0].is_default) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete the default theme — promote another first' },
        { status: 400 }
      );
    }

    await query('DELETE FROM invoice_themes WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[invoices/themes] DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
