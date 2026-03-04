import { sql } from '@/lib/db';
import { Gallery } from './gallery';
import type { Post } from '@/lib/db';

export const revalidate = 60; // ISR: revalidate every 60 seconds

export default async function Home() {
  const [postsResult, yearsResult] = await Promise.all([
    sql`
      SELECT id, image_url, caption, caption_style, date, is_fallback, created_at
      FROM posts
      ORDER BY date DESC
      LIMIT 20
    `,
    sql`
      SELECT DISTINCT EXTRACT(YEAR FROM date)::int AS year
      FROM posts
      ORDER BY year DESC
    `,
  ]);

  const posts = postsResult.rows.map((row) => ({
    ...row,
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  })) as Post[];

  const years = yearsResult.rows.map((row) => row.year as number);

  return <Gallery initialPosts={posts} years={years} />;
}
