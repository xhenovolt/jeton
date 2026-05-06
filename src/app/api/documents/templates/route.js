import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

export async function GET(request) {
  const perm = await requirePermission(request, 'documents.view');
  if (perm instanceof NextResponse) return perm;
  const r = await query('SELECT * FROM document_templates WHERE is_active ORDER BY name');
  return NextResponse.json({ success: true, data: r.rows });
}

export async function POST(request) {
  const perm = await requirePermission(request, 'documents.create');
  if (perm instanceof NextResponse) {
    const fb = await requirePermission(request, 'documents.manage');
    if (fb instanceof NextResponse) return fb;
  }
  const auth = (perm instanceof NextResponse
    ? await requirePermission(request, 'documents.manage')
    : perm).auth;

  const { name, description, category, body, body_format = 'markdown', variables } = await request.json().catch(() => ({}));
  if (!name) return NextResponse.json({ success: false, error: 'name required' }, { status: 400 });

  const r = await query(
    `INSERT INTO document_templates (name, description, category, body, body_format, variables, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, description || null, category || null, body || null, body_format, JSON.stringify(variables || []), auth.userId]
  );
  return NextResponse.json({ success: true, data: r.rows[0] }, { status: 201 });
}
