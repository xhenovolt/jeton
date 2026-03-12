import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { verifyAuth } from '@/lib/auth-utils.js';

// GET /api/knowledge — List articles
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let sql = `SELECT id, title, category, author_name, tags, is_published, view_count, created_at, updated_at,
               LEFT(content, 200) as excerpt
               FROM knowledge_articles WHERE is_published = true`;
    const params = [];
    if (category) { params.push(category); sql += ` AND category = $${params.length}`; }
    if (search) { params.push(`%${search}%`); sql += ` AND (title ILIKE $${params.length} OR content ILIKE $${params.length})`; }
    sql += ` ORDER BY updated_at DESC`;

    const result = await query(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch articles' }, { status: 500 });
  }
}

// POST /api/knowledge — Create article
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const { title, content, category, tags } = body;
    if (!title || !content) return NextResponse.json({ success: false, error: 'title and content required' }, { status: 400 });

    // Get author name
    let authorName = '';
    try {
      const u = await query(`SELECT name, full_name FROM users WHERE id = $1`, [auth.userId]);
      if (u.rows[0]) authorName = u.rows[0].full_name || u.rows[0].name;
    } catch {}

    const result = await query(
      `INSERT INTO knowledge_articles (title, content, category, author_id, author_name, tags) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, content, category || 'general', auth.userId, authorName, tags || null]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create article' }, { status: 500 });
  }
}
