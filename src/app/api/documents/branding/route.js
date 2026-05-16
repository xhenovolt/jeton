import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/documents/branding - Get active branding
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'documents.view');
    if (perm instanceof NextResponse) return perm;

    const result = await query(
      `SELECT * FROM document_branding
       WHERE is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1`
    );

    if (!result.rows[0]) {
      return NextResponse.json(
        { success: false, error: 'No active branding found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Documents/Branding] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch branding' },
      { status: 500 }
    );
  }
}

// PUT /api/documents/branding - Update branding
export async function PUT(request) {
  try {
    const perm = await requirePermission(request, 'documents.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const brandingData = await request.json();

    // First, get the current active branding
    const currentResult = await query(
      `SELECT id FROM document_branding WHERE is_active = TRUE LIMIT 1`
    );

    let result;
    if (currentResult.rows[0]) {
      // Update existing branding
      result = await query(
        `UPDATE document_branding
         SET organization_name = $1, header_text = $2, primary_color = $3,
             secondary_color = $4, accent_color = $5, logo_url = $6,
             logo_width = $7, logo_height = $8, signature_url = $9,
             signature_name = $10, signature_title = $11, address_line1 = $12,
             city = $13, postal_code = $14, phone = $15, email = $16,
             website = $17, updated_at = NOW()
         WHERE id = $18
         RETURNING *`,
        [
          brandingData.organization_name,
          brandingData.header_text,
          brandingData.primary_color,
          brandingData.secondary_color,
          brandingData.accent_color,
          brandingData.logo_url,
          brandingData.logo_width,
          brandingData.logo_height,
          brandingData.signature_url,
          brandingData.signature_name,
          brandingData.signature_title,
          brandingData.address_line1,
          brandingData.city,
          brandingData.postal_code,
          brandingData.phone,
          brandingData.email,
          brandingData.website,
          currentResult.rows[0].id
        ]
      );
    } else {
      // Create new branding
      result = await query(
        `INSERT INTO document_branding
          (organization_name, header_text, primary_color, secondary_color,
           accent_color, logo_url, logo_width, logo_height, signature_url,
           signature_name, signature_title, address_line1, city, postal_code,
           phone, email, website, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING *`,
        [
          brandingData.organization_name,
          brandingData.header_text,
          brandingData.primary_color,
          brandingData.secondary_color,
          brandingData.accent_color,
          brandingData.logo_url,
          brandingData.logo_width,
          brandingData.logo_height,
          brandingData.signature_url,
          brandingData.signature_name,
          brandingData.signature_title,
          brandingData.address_line1,
          brandingData.city,
          brandingData.postal_code,
          brandingData.phone,
          brandingData.email,
          brandingData.website,
          auth.userId
        ]
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Documents/Branding] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update branding' },
      { status: 500 }
    );
  }
}