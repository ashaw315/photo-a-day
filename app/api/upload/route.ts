// app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { uploadImage } from '@/lib/r2';
import { generateCaption, pickRandomStyle } from '@/lib/caption';
import { sql } from '@/lib/db';
import { getTodayEST } from '@/lib/date';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!validateApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const today = getTodayEST();

  // Check if a post already exists for today
  const existing = await sql`SELECT id FROM posts WHERE date = ${today}`;
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'A photo has already been posted today' }, { status: 409 });
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const key = `photos/${today}.${ext}`;
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  // Upload image to R2 first
  const imageUrl = await uploadImage(key, buffer, file.type);

  // Generate AI caption
  const style = pickRandomStyle();
  const { caption, style: usedStyle } = await generateCaption(buffer, mediaType, style);

  // Insert into database
  await sql`
    INSERT INTO posts (image_url, caption, caption_style, date, is_fallback)
    VALUES (${imageUrl}, ${caption}, ${usedStyle}, ${today}, false)
  `;

  return NextResponse.json({ success: true, caption, style: usedStyle, date: today });
}
