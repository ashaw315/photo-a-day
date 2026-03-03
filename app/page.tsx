import { sql } from '@/lib/db';
import { Gallery } from './gallery';
import type { Post } from '@/lib/db';

export const revalidate = 60; // ISR: revalidate every 60 seconds

export default async function Home() {
  const result = await sql`
    SELECT id, image_url, caption, caption_style, date, is_fallback, created_at
    FROM posts
    ORDER BY date DESC
    LIMIT 20
  `;

  return <Gallery initialPosts={result.rows as Post[]} />;
}
