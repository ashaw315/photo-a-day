# Photo-a-Day Design

## Overview

A personal "one photo a day" app. Every day at a random time (8am-10pm), an iOS notification prompts the user to take a photo. That photo is uploaded to a public-facing website with an AI-generated caption (max 10 words, randomly poetic or descriptive). If the notification is dismissed, a midnight cron picks a random unused image from a pre-filled fallback album.

## Tech Stack

- **Frontend/Backend:** Next.js on Vercel (API routes for all server logic)
- **Database:** Vercel Postgres (Neon)
- **Image Storage:** Cloudflare R2
- **AI Captions:** Anthropic API
- **Mobile Trigger:** iOS Shortcuts
- **Auth:** Simple password (JWT cookie) for admin, API key for Shortcut requests

## System Architecture

```
iOS Shortcut (camera)  ──POST /api/upload──▶  Next.js API Routes (Vercel)
iOS Shortcut (fallback) ──POST /api/fallback-sync──▶       │
Vercel Cron (midnight) ──GET /api/cron/fallback──▶          │
                                                    ┌───────┴───────┐
                                                    ▼               ▼
                                              Cloudflare R2   Vercel Postgres
                                              (images)        (posts, fallbacks)

                                              Anthropic API ◀── called during
                                                               upload & cron
```

### Key Flows

1. **Daily photo:** iOS Shortcut fires at random time within 8am-10pm, prompts camera, uploads image to `POST /api/upload`. API stores image in R2, calls Anthropic for caption, writes post to Postgres.
2. **Fallback sync:** Separate iOS Shortcut syncs the "Fallback" iPhone album to `POST /api/fallback-sync`. Images stored in R2, records added to `fallback_images` table. Deduplication via SHA-256 file hash.
3. **Midnight cron:** Vercel Cron hits `/api/cron/fallback`. Checks if today has a post. If not, picks a random unused fallback image, generates caption, creates post.
4. **Public gallery:** Next.js SSR/ISR page fetches posts, renders horizontal scroll gallery.
5. **Admin panel:** Password-protected routes for editing/deleting posts.

## Database Schema

```sql
CREATE TABLE posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url   TEXT NOT NULL,
    caption     TEXT NOT NULL,
    caption_style TEXT NOT NULL,  -- 'poetic' or 'descriptive'
    date        DATE UNIQUE NOT NULL,
    is_fallback BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fallback_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url   TEXT NOT NULL,
    file_hash   TEXT UNIQUE NOT NULL,  -- SHA-256 for dedup on sync
    used        BOOLEAN DEFAULT FALSE,
    used_date   DATE,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);
```

**Key constraints:**
- `posts.date` unique index enforces one photo per day.
- `fallback_images.file_hash` unique index prevents duplicate fallback uploads.
- `fallback_images.used` enables duplicate detection; cron queries `WHERE used = false ORDER BY random() LIMIT 1`.
- Fallback selection and post insert happen in the same transaction.

## API Routes

### Public
- `GET /` — Gallery page (SSR/ISR)
- `GET /api/posts?cursor=<date>&limit=<n>` — Paginated post list (cursor-based on date)

### Upload (API key protected)
- `POST /api/upload` — Daily photo upload from iOS Shortcut
- `POST /api/fallback-sync` — Batch upload fallback images from iOS Shortcut

### Cron
- `GET /api/cron/fallback` — Midnight fallback check (Vercel Cron, CRON_SECRET protected)

### Admin (JWT cookie auth)
- `POST /api/auth/login` — Returns signed JWT in httpOnly cookie (7-day expiry)
- `POST /api/auth/logout` — Clears cookie
- `GET /admin` — Admin dashboard (list posts, fallback pool status)
- `PUT /api/admin/posts/[id]` — Edit post (caption, replace image)
- `DELETE /api/admin/posts/[id]` — Delete post

## Upload Flow (POST /api/upload)

1. Validate API key (Bearer token).
2. Accept image (multipart form data).
3. Upload to R2 under `photos/YYYY-MM-DD.{ext}`.
4. Call Anthropic API — randomly pick "poetic" or "descriptive" style, generate caption (max 10 words).
5. Insert into `posts` table.
6. Return success + caption.

## Public Gallery

- Full-viewport horizontal scroll. Each photo is full screen height with caption and date.
- Scroll right = forward in time, left = backward. Most recent photo loads first.
- `scroll-snap-type: x mandatory` with `scroll-snap-align: center` for native-feeling snap behavior.
- Lazy loading via `loading="lazy"` + paginated API fetch as user scrolls toward edges.
- Keyboard navigation with left/right arrow keys.
- **Typography:** Lightweight serif, small size, bottom-left aligned caption. Understated, restrained. Date shown small and subtle (e.g., "Mar 2, 2026").
- Minimal chrome — no nav bar, no header, just photos edge to edge.

## iOS Shortcuts

### Shortcut 1: Daily Photo Capture
- **Trigger:** Random time between 8am-10pm (helper automation picks time at midnight).
- **Flow:** Notification → open camera → capture → resize to max 2048px wide → `POST /api/upload` with multipart image + Bearer token.
- **If dismissed:** No action — midnight cron handles fallback.

### Shortcut 2: Fallback Album Sync
- **Trigger:** Manual or scheduled (e.g., weekly).
- **Flow:** Get all photos from "Fallback" album → for each, `POST /api/fallback-sync` with image. API deduplicates by SHA-256 hash; re-uploads silently skipped.

## Error Handling

- **R2 upload failure:** Return error to Shortcut, no DB row created (image-first, then DB).
- **Anthropic API failure:** Retry once, then store post with placeholder caption (`"—"`). Editable in admin.
- **No unused fallbacks left:** Cron logs warning, no post created. Admin panel shows "fallback pool empty" indicator.
- **Post already exists for today:** Cron is a no-op.
- **R2 temporarily unavailable:** Gallery shows subtle placeholder frame with date.
- **Delete a post:** Also deletes image from R2.
- **Delete a fallback post:** Fallback image marked `used = false`, re-enters pool.
- **Edit caption:** Postgres update only — no Anthropic call unless regeneration explicitly requested.

## Environment Variables

```
# Auth
ADMIN_PASSWORD=...
JWT_SECRET=...
API_KEY=...

# Database
POSTGRES_URL=...

# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=...

# Anthropic
ANTHROPIC_API_KEY=...

# Vercel Cron
CRON_SECRET=...
```
