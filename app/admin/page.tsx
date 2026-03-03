import { sql } from '@/lib/db';
import { AdminDashboard } from './admin-dashboard';
import type { Post } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const postsResult = await sql`
    SELECT id, image_url, caption, caption_style, date, is_fallback, created_at
    FROM posts ORDER BY date DESC
  `;

  const fallbackResult = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE used = false) as unused
    FROM fallback_images
  `;

  const { total, unused } = fallbackResult.rows[0];

  const posts = postsResult.rows.map((row) => ({
    ...row,
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  })) as Post[];

  return (
    <AdminDashboard
      initialPosts={posts}
      fallbackCount={parseInt(total)}
      unusedFallbackCount={parseInt(unused)}
    />
  );
}
