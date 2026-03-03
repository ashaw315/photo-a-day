// app/api/seed/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      image_url TEXT NOT NULL,
      caption TEXT NOT NULL,
      caption_style TEXT NOT NULL,
      date DATE UNIQUE NOT NULL,
      is_fallback BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS fallback_images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      image_url TEXT NOT NULL,
      file_hash TEXT UNIQUE NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      used_date DATE,
      uploaded_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  return Response.json({ message: 'Tables created' });
}
