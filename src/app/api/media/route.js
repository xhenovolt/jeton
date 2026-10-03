import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';
import { requirePermission } from '@/lib/permissions.js';

// GET /api/media
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'media.view');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const { searchParams } = new URL(request.url);
    const entity_type = searchParams.get('entity_type');
    const entity_id = searchParams.get('entity_id');
    const tag = searchParams.get('tag');

    const search = searchParams.get('search');
    const mime_prefix = searchParams.get('type');   // 'image', 'video', 'application'
    const sort = searchParams.get('sort') || 'newest';
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '60')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    const where = [];
    const params = [];
    if (entity_type) { params.push(entity_type); where.push(`entity_type = $${params.length}`); }
    if (entity_id)   { params.push(entity_id);   where.push(`entity_id = $${params.length}`); }
    if (tag)         { params.push(tag);         where.push(`$${params.length} = ANY(tags)`); }
    if (mime_prefix) { params.push(`${mime_prefix}/%`); where.push(`mime_type LIKE $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(original_filename ILIKE $${params.length} OR filename ILIKE $${params.length} OR notes ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Deterministic ordering. `created_at DESC` alone leaves files uploaded in
    // the same batch free to come back in any order, and in a different order
    // next time — the same instability the expense list had. Every option ends
    // with id DESC so rows cannot tie.
    const ORDER_BY = {
      newest:  'created_at DESC, id DESC',
      oldest:  'created_at ASC,  id ASC',
      largest: 'file_size DESC NULLS LAST, created_at DESC, id DESC',
      smallest:'file_size ASC NULLS LAST,  created_at DESC, id DESC',
      name:    'COALESCE(original_filename, filename) ASC, created_at DESC, id DESC',
    };
    const orderSql = ORDER_BY[sort] || ORDER_BY.newest;

    // The list was unbounded. 19 files is fine; a media library is exactly the
    // table that grows without anyone noticing, so it is paged from the start.
    const [result, countResult] = await Promise.all([
      query(
        `SELECT * FROM media ${whereSql} ORDER BY ${orderSql}
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*)::int AS total FROM media ${whereSql}`, params),
    ]);

    return NextResponse.json({
      success: true,
      data: result.rows,
      sort: ORDER_BY[sort] ? sort : 'newest',
      sort_options: Object.keys(ORDER_BY),
      pagination: {
        total: countResult.rows[0].total,
        limit,
        offset,
        has_more: offset + result.rows.length < countResult.rows[0].total,
      },
    });
  } catch (error) {
    console.error('[Media] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch media' }, { status: 500 });
  }
}

// POST /api/media — record uploaded file metadata
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'media.manage');
    if (perm instanceof NextResponse) return perm;
    const { auth } = perm;

    const body = await request.json();
    const { filename, original_filename, mime_type, file_size, storage_provider, cloudinary_account,
            public_id, url, secure_url, thumbnail_url, width, height, format,
            entity_type, entity_id, tags, quality, notes } = body;

    if (!filename || !url) {
      return NextResponse.json({ success: false, error: 'filename and url are required' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO media (filename, original_filename, mime_type, file_size, storage_provider, cloudinary_account,
        public_id, url, secure_url, thumbnail_url, width, height, format,
        entity_type, entity_id, tags, quality, notes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [filename, original_filename || filename, mime_type || null, file_size || null,
       storage_provider || 'cloudinary', cloudinary_account || null,
       public_id || null, url, secure_url || url, thumbnail_url || null,
       width || null, height || null, format || null,
       entity_type || null, entity_id || null,
       tags || '{}', quality || 'original', notes || null, auth.userId]
    );

    await query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
      [auth.userId, 'CREATE', 'media', result.rows[0].id, JSON.stringify({ filename, entity_type })]);

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[Media] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save media record' }, { status: 500 });
  }
}

// DELETE /api/media?id=xxx
export async function DELETE(request) {
  // This only checked that the caller was logged in, so any authenticated
  // user could delete any file in the company media library. Deleting is a
  // media.manage action, the same as uploading.
  const perm = await requirePermission(request, 'media.manage');
  if (perm instanceof NextResponse) return perm;
  const { auth } = perm;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    // RETURNING tells us whether anything was actually removed, so a bad id
    // reports "not found" instead of a cheerful success.
    const deleted = await query(
      `DELETE FROM media WHERE id = $1
       RETURNING id, original_filename, filename, public_id, storage_provider, file_size`,
      [id]
    );
    if (!deleted.rows[0]) {
      return NextResponse.json({ success: false, error: 'Media not found' }, { status: 404 });
    }
    const m = deleted.rows[0];

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1,'DELETE','media',$2,$3)`,
      [auth.userId, id, JSON.stringify({
        filename: m.original_filename || m.filename,
        public_id: m.public_id,
        storage_provider: m.storage_provider,
        file_size: m.file_size,
      })]
    ).catch(() => {});

    // The database row is gone; the bytes are still at the storage provider.
    // Say so rather than implying the file itself was purged.
    return NextResponse.json({
      success: true,
      message: 'Media record deleted.',
      storage_object_retained: !!m.public_id,
      note: m.public_id
        ? 'The file itself remains at the storage provider and must be removed there if required.'
        : undefined,
    });
  } catch (error) {
    console.error('[Media] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete media' }, { status: 500 });
  }
}
