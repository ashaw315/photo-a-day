// app/api/admin/posts/[id]/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { deleteImage } from '@/lib/r2';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { caption } = await request.json();

  const result = await sql`
    UPDATE posts SET caption = ${caption}, updated_at = now()
    WHERE id = ${id}
    RETURNING id, caption, caption_style, date
  `;

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  return NextResponse.json({ post: result.rows[0] });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch post to get image URL and fallback status
  const post = await sql`
    SELECT id, image_url, is_fallback FROM posts WHERE id = ${id}
  `;

  if (post.rows.length === 0) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const { image_url, is_fallback } = post.rows[0];

  // Delete from database
  await sql`DELETE FROM posts WHERE id = ${id}`;

  // Delete image from R2 (extract key from URL)
  const url = new URL(image_url);
  const key = url.pathname.slice(1); // remove leading /
  await deleteImage(key);

  // If this was a fallback post, mark the fallback image as unused again
  if (is_fallback) {
    await sql`
      UPDATE fallback_images SET used = false, used_date = null
      WHERE image_url = ${image_url}
    `;
  }

  return NextResponse.json({ success: true });
}
