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

  return (
    <AdminDashboard
      initialPosts={postsResult.rows as Post[]}
      fallbackCount={parseInt(total)}
      unusedFallbackCount={parseInt(unused)}
    />
  );
}
