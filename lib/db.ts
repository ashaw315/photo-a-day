// lib/db.ts
import { sql } from '@vercel/postgres';

export { sql };

export interface Post {
  id: string;
  image_url: string;
  caption: string;
  caption_style: 'poetic' | 'descriptive';
  date: string;
  is_fallback: boolean;
  created_at: string;
  updated_at: string;
}

export interface FallbackImage {
  id: string;
  image_url: string;
  file_hash: string;
  used: boolean;
  used_date: string | null;
  uploaded_at: string;
}
