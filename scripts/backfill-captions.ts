// scripts/backfill-captions.ts
// One-time script to backfill poetic captions with descriptive ones.
// Usage: npx tsx --env-file=.env --env-file=.env.local scripts/backfill-captions.ts

import { sql } from '@vercel/postgres';
import { generateCaption } from '../lib/caption';

async function main() {
  const result = await sql`
    SELECT id, date, image_url, caption FROM posts
    WHERE caption_style = 'poetic'
    ORDER BY date
  `;

  const posts = result.rows;
  console.log(`Found ${posts.length} poetic post(s) to backfill.\n`);

  if (posts.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  for (const post of posts) {
    try {
      console.log(`Processing ${post.date}...`);

      const imageResponse = await fetch(post.image_url);
      if (!imageResponse.ok) {
        console.error(`  Failed to fetch image for ${post.date}: ${imageResponse.status}`);
        continue;
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const mediaType = contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      const { caption } = await generateCaption(imageBuffer, mediaType);

      await sql`
        UPDATE posts
        SET caption = ${caption}, caption_style = 'descriptive', updated_at = now()
        WHERE id = ${post.id}
      `;

      console.log(`  ${post.date}: "${caption}"`);
    } catch (error) {
      console.error(`  Error processing ${post.date}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log('\nBackfill complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
