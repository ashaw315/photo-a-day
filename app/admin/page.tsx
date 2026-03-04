import { sql } from '@/lib/db';
import { AdminDashboard } from './admin-dashboard';
import type { Post, FallbackImage } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [postsResult, fallbackCountResult, fallbackImagesResult] = await Promise.all([
    sql`
      SELECT id, image_url, caption, caption_style, date, is_fallback, created_at
      FROM posts ORDER BY date DESC
    `,
    sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE used = false) as unused
      FROM fallback_images
    `,
    sql`
      SELECT id, image_url, file_hash, used, used_date, uploaded_at
      FROM fallback_images
      ORDER BY uploaded_at DESC
    `,
  ]);

  const { total, unused } = fallbackCountResult.rows[0];

  const posts = postsResult.rows.map((row) => ({
    ...row,
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  })) as Post[];

  const fallbackImages = fallbackImagesResult.rows.map((row) => ({
    ...row,
    used_date: row.used_date instanceof Date ? row.used_date.toISOString().split('T')[0] : row.used_date,
    uploaded_at: row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : row.uploaded_at,
  })) as FallbackImage[];

  return (
    <AdminDashboard
      initialPosts={posts}
      fallbackCount={parseInt(total)}
      unusedFallbackCount={parseInt(unused)}
      fallbackImages={fallbackImages}
    />
  );
}
