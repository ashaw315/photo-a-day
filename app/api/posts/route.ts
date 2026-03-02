// app/api/posts/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor'); // ISO date string
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

  let result;
  if (cursor) {
    result = await sql`
      SELECT id, image_url, caption, caption_style, date, is_fallback, created_at
      FROM posts
      WHERE date < ${cursor}
      ORDER BY date DESC
      LIMIT ${limit}
    `;
  } else {
    result = await sql`
      SELECT id, image_url, caption, caption_style, date, is_fallback, created_at
      FROM posts
      ORDER BY date DESC
      LIMIT ${limit}
    `;
  }

  const posts = result.rows;
  const nextCursor = posts.length === limit ? posts[posts.length - 1].date : null;

  return NextResponse.json({ posts, nextCursor });
}
