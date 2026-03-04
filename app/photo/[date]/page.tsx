import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import type { Post } from '@/lib/db';
import type { Metadata } from 'next';
import { PhotoView } from './photo-view';

export const revalidate = 60;

type Props = {
  params: Promise<{ date: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  const result = await sql`
    SELECT caption FROM posts WHERE date = ${date} LIMIT 1
  `;
  if (result.rows.length === 0) {
    return { title: 'Photo not found' };
  }
  return {
    title: `${result.rows[0].caption} — Photo a Day`,
  };
}

export default async function PhotoPage({ params }: Props) {
  const { date } = await params;

  const result = await sql`
    WITH target AS (
      SELECT
        id, image_url, caption, caption_style, date, is_fallback, created_at,
        LAG(date) OVER (ORDER BY date) AS prev_date,
        LEAD(date) OVER (ORDER BY date) AS next_date
      FROM posts
    )
    SELECT * FROM target WHERE date = ${date} LIMIT 1
  `;

  if (result.rows.length === 0) {
    notFound();
  }

  const row = result.rows[0];

  const post: Post = {
    ...row,
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  } as Post;

  const prevDate = row.prev_date instanceof Date
    ? row.prev_date.toISOString().split('T')[0]
    : (row.prev_date as string | null);

  const nextDate = row.next_date instanceof Date
    ? row.next_date.toISOString().split('T')[0]
    : (row.next_date as string | null);

  return <PhotoView post={post} prevDate={prevDate} nextDate={nextDate} />;
}
