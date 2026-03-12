// app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { uploadImage } from '@/lib/r2';
import { generateCaption } from '@/lib/caption';
import { sql } from '@/lib/db';
import { getTodayEST } from '@/lib/date';

const REQUIRED_ENV_VARS = [
  'R2_PUBLIC_URL',
  'R2_BUCKET_NAME',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'ANTHROPIC_API_KEY',
] as const;

export async function POST(request: Request) {
  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error('Missing environment variables:', missing.join(', '));
    return NextResponse.json(
      { error: `Server misconfiguration: missing env vars: ${missing.join(', ')}` },
      { status: 500 }
    );
  }

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
  console.log('[upload] imageUrl:', imageUrl, '| key:', key, '| R2_PUBLIC_URL:', process.env.R2_PUBLIC_URL);

  if (!imageUrl || !imageUrl.startsWith('http')) {
    console.error('[upload] Invalid imageUrl after R2 upload:', imageUrl);
    return NextResponse.json(
      { error: 'Upload failed: invalid image URL returned from storage' },
      { status: 500 }
    );
  }

  // Generate AI caption
  const { caption } = await generateCaption(buffer, mediaType);

  // Insert into database
  await sql`
    INSERT INTO posts (image_url, caption, caption_style, date, is_fallback)
    VALUES (${imageUrl}, ${caption}, ${'descriptive'}, ${today}, false)
  `;

  return NextResponse.json({ success: true, caption, style: 'descriptive', date: today });
}
