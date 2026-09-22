import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

/**
 * GET  /api/invoices/themes
 *   List every theme. Any user with invoices.view can read.
 * POST /api/invoices/themes
 *   Create a theme. Superadmin-gated via invoices.manage_themes;
 *   superadmin bypass still applies.
 */
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'invoices.view');
    if (perm instanceof NextResponse) return perm;

    const rows = await query('SELECT * FROM invoice_themes ORDER BY is_default DESC, name ASC');
    return NextResponse.json({ success: true, themes: rows.rows });
  } catch (error) {
    console.error('[invoices/themes] GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'invoices.manage_themes');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    const columns = [
      'name','is_default',
      'primary_color','secondary_color','accent_color','background_color',
      'text_color','muted_color','border_color',
      'font_family','base_font_size',
      'paper_size','orientation','margins','rounded_corners','border_style',
      'header_layout','footer_layout','logo_size_px','logo_position',
      'qr_position','watermark_text','watermark_opacity',
      'show_seal','show_signature','show_bank_details','show_tax_section',
      'show_payment_instructions','show_terms','show_notes','show_qr','show_watermark',
      'updated_by',
    ];
    const values = columns.map((c, i) => {
      if (c === 'updated_by') return auth.userId;
      if (c === 'margins')    return body.margins ? JSON.stringify(body.margins) : null;
      return body[c] ?? null;
    });
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');

    const inserted = await query(
      `INSERT INTO invoice_themes (${columns.join(',')}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    // If this new theme claimed default, unflag the others.
    if (inserted.rows[0].is_default) {
      await query(
        'UPDATE invoice_themes SET is_default = FALSE WHERE id != $1',
        [inserted.rows[0].id]
      );
    }

    return NextResponse.json({ success: true, theme: inserted.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[invoices/themes] POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
