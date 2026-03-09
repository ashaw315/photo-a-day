// app/api/cron/fallback/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { generateCaption, pickRandomStyle } from '@/lib/caption';
import { getTodayEST } from '@/lib/date';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = getTodayEST();

  // Check if post already exists for today
  const existing = await sql`
    SELECT id FROM posts WHERE date = ${today}
  `;

  if (existing.rows.length > 0) {
    return NextResponse.json({ skipped: true, reason: 'Post already exists for today' });
  }

  // Pick a random unused fallback
  const fallback = await sql`
    SELECT id, image_url FROM fallback_images
    WHERE used = false
    ORDER BY random()
    LIMIT 1
  `;

  if (fallback.rows.length === 0) {
    console.warn('No unused fallback images available');
    return NextResponse.json({ skipped: true, reason: 'No fallback images available' });
  }

  const { id: fallbackId, image_url: imageUrl } = fallback.rows[0];

  // Fetch the image to generate a caption
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
  const mediaType = contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const style = pickRandomStyle();
  const { caption, style: usedStyle } = await generateCaption(imageBuffer, mediaType, style);

  // Insert post and mark fallback as used — in a transaction
  const client = await sql.connect();
  try {
    await client.sql`BEGIN`;
    await client.sql`
      INSERT INTO posts (image_url, caption, caption_style, date, is_fallback)
      VALUES (${imageUrl}, ${caption}, ${usedStyle}, ${today}, true)
    `;
    await client.sql`
      UPDATE fallback_images SET used = true, used_date = ${today}
      WHERE id = ${fallbackId}
    `;
    await client.sql`COMMIT`;
  } catch (error) {
    await client.sql`ROLLBACK`;
    throw error;
  } finally {
    client.release();
  }

  return NextResponse.json({ success: true, date: today, caption, fallback: true });
}
