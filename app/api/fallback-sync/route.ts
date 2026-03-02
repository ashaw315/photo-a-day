// app/api/fallback-sync/route.ts
import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { uploadImage } from '@/lib/r2';
import { sql } from '@/lib/db';
import crypto from 'crypto';

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

  // Compute SHA-256 hash for dedup
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Check if already exists
  const existing = await sql`
    SELECT id FROM fallback_images WHERE file_hash = ${fileHash}
  `;

  if (existing.rows.length > 0) {
    return NextResponse.json({ success: true, skipped: true, message: 'Duplicate, already synced' });
  }

  // Upload to R2
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const key = `fallbacks/${fileHash.slice(0, 12)}.${ext}`;
  const imageUrl = await uploadImage(key, buffer, file.type);

  // Insert record
  await sql`
    INSERT INTO fallback_images (image_url, file_hash)
    VALUES (${imageUrl}, ${fileHash})
  `;

  return NextResponse.json({ success: true, skipped: false });
}
