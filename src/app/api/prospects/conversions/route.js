/**
 * GET /api/prospects/conversions
 *
 * Returns prospects ready to convert (Negotiating/Interested stage)
 * These are warm leads ready to become clients
 */

import { query } from '@/lib/db.js';

export async function GET(request) {
  try {
    const sql = `
      SELECT
        p.id,
        p.prospect_name,
        p.email,
        p.phone,
        p.business_name,
        p.sales_stage,
        COUNT(pa.id) as total_activities,
        MAX(pa.created_at) as last_contact_at
      FROM prospects p
      LEFT JOIN prospect_activities pa ON p.id = pa.prospect_id
      WHERE p.status = 'Active'
        AND p.client_id IS NULL
        AND p.sales_stage IN ('Negotiating', 'Interested')
      GROUP BY p.id, p.prospect_name, p.email, p.phone, p.business_name, p.sales_stage
      ORDER BY p.sales_stage DESC, MAX(pa.created_at) DESC NULLS LAST
    `;

    const result = await query(sql);

    return Response.json({
      success: true,
      data: result.rows || [],
      count: result.rows?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching conversion prospects:', error);
    return Response.json(
      {
        success: false,
        error: error.message || 'Failed to fetch conversion prospects',
      },
      { status: 500 }
    );
  }
}
