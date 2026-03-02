# Photo-a-Day Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal daily photo app with iOS Shortcut upload, AI captions, fallback system, horizontal scroll gallery, and admin panel.

**Architecture:** Next.js 15 App Router on Vercel. All server logic in API route handlers. Cloudflare R2 for image storage, Vercel Postgres for data, Anthropic API for captions. Simple password auth with JWT cookies for admin.

**Tech Stack:** Next.js 15, TypeScript, @vercel/postgres, @aws-sdk/client-s3 (R2), @anthropic-ai/sdk, jose (JWT), Vercel Cron

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vercel.json`, `.env.local`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`

**Step 1: Initialize Next.js project**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```
Expected: Project scaffolded with App Router structure.

**Step 2: Install dependencies**

Run:
```bash
npm install @vercel/postgres @aws-sdk/client-s3 @anthropic-ai/sdk jose
```

**Step 3: Create `.env.local`**

```env
# Auth
ADMIN_PASSWORD=changeme
JWT_SECRET=dev-secret-change-in-production
API_KEY=dev-api-key-change-in-production

# Database (Vercel Postgres provides this)
POSTGRES_URL=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Anthropic
ANTHROPIC_API_KEY=

# Vercel Cron
CRON_SECRET=dev-cron-secret
```

**Step 4: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/fallback",
      "schedule": "0 5 * * *"
    }
  ]
}
```

Note: `0 5 * * *` is midnight EST (UTC-5). Adjust for your timezone.

**Step 5: Verify dev server starts**

Run: `npm run dev`
Expected: Next.js dev server running at localhost:3000.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js project with dependencies"
```

---

### Task 2: Database Schema & Seed

**Files:**
- Create: `lib/db.ts`
- Create: `app/api/seed/route.ts`

**Step 1: Write `lib/db.ts`**

This re-exports the `sql` function and defines TypeScript types for our tables.

```typescript
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
```

**Step 2: Write the seed route**

```typescript
// app/api/seed/route.ts
import { sql } from '@/lib/db';

export async function GET() {
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
```

**Step 3: Test locally (requires POSTGRES_URL)**

If Vercel Postgres is connected, run: `curl http://localhost:3000/api/seed`
Expected: `{"message":"Tables created"}`

**Step 4: Commit**

```bash
git add lib/db.ts app/api/seed/route.ts && git commit -m "feat: add database schema and seed route"
```

---

### Task 3: R2 Storage Client

**Files:**
- Create: `lib/r2.ts`
- Create: `lib/r2.test.ts`

**Step 1: Write the failing test**

```typescript
// lib/r2.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @aws-sdk/client-s3 before importing r2
vi.mock('@aws-sdk/client-s3', () => {
  const send = vi.fn().mockResolvedValue({});
  return {
    S3Client: vi.fn(() => ({ send })),
    PutObjectCommand: vi.fn((input) => input),
    DeleteObjectCommand: vi.fn((input) => input),
  };
});

describe('r2', () => {
  beforeEach(() => {
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'test-bucket';
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com';
  });

  it('uploadImage uploads buffer and returns public URL', async () => {
    const { uploadImage } = await import('./r2');
    const buffer = Buffer.from('fake-image-data');
    const url = await uploadImage('photos/2026-03-02.jpg', buffer, 'image/jpeg');
    expect(url).toBe('https://cdn.example.com/photos/2026-03-02.jpg');
  });

  it('deleteImage sends delete command', async () => {
    const { deleteImage } = await import('./r2');
    await expect(deleteImage('photos/2026-03-02.jpg')).resolves.not.toThrow();
  });
});
```

**Step 2: Install vitest and run to verify failure**

Run:
```bash
npm install -D vitest @types/node
npx vitest run lib/r2.test.ts
```
Expected: FAIL — `lib/r2.ts` does not exist.

**Step 3: Write `lib/r2.ts`**

```typescript
// lib/r2.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export async function uploadImage(key: string, body: Buffer, contentType: string): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

export async function deleteImage(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    })
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/r2.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/r2.ts lib/r2.test.ts vitest.config.ts && git commit -m "feat: add R2 storage client with upload and delete"
```

Note: You may need to create a `vitest.config.ts` — if so:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
```

---

### Task 4: Anthropic Caption Generator

**Files:**
- Create: `lib/caption.ts`
- Create: `lib/caption.test.ts`

**Step 1: Write the failing test**

```typescript
// lib/caption.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

describe('generateCaption', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockReset();
  });

  it('returns a caption with the chosen style', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Golden light spills across the quiet morning road' }],
    });

    const { generateCaption } = await import('./caption');
    const result = await generateCaption(Buffer.from('fake'), 'image/jpeg', 'poetic');

    expect(result.caption).toBe('Golden light spills across the quiet morning road');
    expect(result.style).toBe('poetic');
  });

  it('returns placeholder on API failure after retry', async () => {
    mockCreate.mockRejectedValue(new Error('API down'));

    const { generateCaption } = await import('./caption');
    const result = await generateCaption(Buffer.from('fake'), 'image/jpeg', 'descriptive');

    expect(result.caption).toBe('—');
    expect(result.style).toBe('descriptive');
  });
});
```

**Step 2: Run to verify failure**

Run: `npx vitest run lib/caption.test.ts`
Expected: FAIL — module not found.

**Step 3: Write `lib/caption.ts`**

```typescript
// lib/caption.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

type CaptionStyle = 'poetic' | 'descriptive';

const prompts: Record<CaptionStyle, string> = {
  poetic: 'Write a poetic caption for this photo in 10 words or fewer. Be evocative and lyrical. Return only the caption, no quotes.',
  descriptive: 'Write a descriptive caption for this photo in 10 words or fewer. Be clear and observational. Return only the caption, no quotes.',
};

export function pickRandomStyle(): CaptionStyle {
  return Math.random() < 0.5 ? 'poetic' : 'descriptive';
}

export async function generateCaption(
  imageBuffer: Buffer,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  style: CaptionStyle
): Promise<{ caption: string; style: CaptionStyle }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBuffer.toString('base64'),
                },
              },
              { type: 'text', text: prompts[style] },
            ],
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        return { caption: textBlock.text.trim(), style };
      }
    } catch {
      if (attempt === 1) {
        return { caption: '—', style };
      }
    }
  }

  return { caption: '—', style };
}
```

**Step 4: Run tests**

Run: `npx vitest run lib/caption.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/caption.ts lib/caption.test.ts && git commit -m "feat: add AI caption generator with retry and fallback"
```

---

### Task 5: Auth Utilities (JWT + API Key)

**Files:**
- Create: `lib/auth.ts`
- Create: `lib/auth.test.ts`

**Step 1: Write the failing test**

```typescript
// lib/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('auth', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.API_KEY = 'test-api-key';
    process.env.ADMIN_PASSWORD = 'test-password';
  });

  it('signToken creates a verifiable token', async () => {
    const { signToken, verifyToken } = await import('./auth');
    const token = await signToken();
    const payload = await verifyToken(token);
    expect(payload.role).toBe('admin');
  });

  it('verifyToken rejects invalid tokens', async () => {
    const { verifyToken } = await import('./auth');
    await expect(verifyToken('garbage')).rejects.toThrow();
  });

  it('validateApiKey accepts correct key', async () => {
    const { validateApiKey } = await import('./auth');
    expect(validateApiKey('Bearer test-api-key')).toBe(true);
  });

  it('validateApiKey rejects wrong key', async () => {
    const { validateApiKey } = await import('./auth');
    expect(validateApiKey('Bearer wrong-key')).toBe(false);
  });

  it('validatePassword checks against env var', async () => {
    const { validatePassword } = await import('./auth');
    expect(validatePassword('test-password')).toBe(true);
    expect(validatePassword('wrong')).toBe(false);
  });
});
```

**Step 2: Run to verify failure**

Run: `npx vitest run lib/auth.test.ts`
Expected: FAIL

**Step 3: Write `lib/auth.ts`**

```typescript
// lib/auth.ts
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export interface AdminPayload extends JWTPayload {
  role: 'admin';
}

export async function signToken(): Promise<string> {
  return new SignJWT({ role: 'admin' } as AdminPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<AdminPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ['HS256'],
  });
  return payload as AdminPayload;
}

export function validateApiKey(authHeader: string | null): boolean {
  if (!authHeader) return false;
  const key = authHeader.replace('Bearer ', '');
  return key === process.env.API_KEY;
}

export function validatePassword(password: string): boolean {
  return password === process.env.ADMIN_PASSWORD;
}
```

**Step 4: Run tests**

Run: `npx vitest run lib/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts && git commit -m "feat: add auth utilities (JWT, API key, password validation)"
```

---

### Task 6: POST /api/upload Route

**Files:**
- Create: `app/api/upload/route.ts`
- Create: `app/api/upload/route.test.ts`

**Step 1: Write the failing test**

```typescript
// app/api/upload/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  validateApiKey: vi.fn((header: string) => header === 'Bearer valid-key'),
}));

vi.mock('@/lib/r2', () => ({
  uploadImage: vi.fn().mockResolvedValue('https://cdn.example.com/photos/2026-03-02.jpg'),
}));

vi.mock('@/lib/caption', () => ({
  pickRandomStyle: vi.fn().mockReturnValue('poetic'),
  generateCaption: vi.fn().mockResolvedValue({ caption: 'Light dances on still water', style: 'poetic' }),
}));

vi.mock('@/lib/db', () => ({
  sql: Object.assign(vi.fn().mockResolvedValue({ rows: [] }), {
    query: vi.fn(),
  }),
}));

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without valid API key', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid' },
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('rejects requests without a file', async () => {
    const { POST } = await import('./route');
    const formData = new FormData();
    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-key' },
      body: formData,
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

**Step 2: Run to verify failure**

Run: `npx vitest run app/api/upload/route.test.ts`
Expected: FAIL

**Step 3: Write the route handler**

```typescript
// app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { uploadImage } from '@/lib/r2';
import { generateCaption, pickRandomStyle } from '@/lib/caption';
import { sql } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!validateApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const today = new Date().toISOString().split('T')[0];
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const key = `photos/${today}.${ext}`;
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  // Upload image to R2 first
  const imageUrl = await uploadImage(key, buffer, file.type);

  // Generate AI caption
  const style = pickRandomStyle();
  const { caption, style: usedStyle } = await generateCaption(buffer, mediaType, style);

  // Insert into database
  await sql`
    INSERT INTO posts (image_url, caption, caption_style, date, is_fallback)
    VALUES (${imageUrl}, ${caption}, ${usedStyle}, ${today}, false)
  `;

  return NextResponse.json({ success: true, caption, style: usedStyle, date: today });
}
```

**Step 4: Run tests**

Run: `npx vitest run app/api/upload/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/upload/ && git commit -m "feat: add photo upload API route"
```

---

### Task 7: POST /api/fallback-sync Route

**Files:**
- Create: `app/api/fallback-sync/route.ts`
- Create: `app/api/fallback-sync/route.test.ts`

**Step 1: Write the failing test**

```typescript
// app/api/fallback-sync/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  validateApiKey: vi.fn((header: string) => header === 'Bearer valid-key'),
}));

vi.mock('@/lib/r2', () => ({
  uploadImage: vi.fn().mockResolvedValue('https://cdn.example.com/fallbacks/abc123.jpg'),
}));

vi.mock('@/lib/db', () => {
  const sql = vi.fn().mockResolvedValue({ rows: [] });
  return { sql };
});

describe('POST /api/fallback-sync', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects requests without valid API key', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/fallback-sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid' },
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('rejects requests without a file', async () => {
    const { POST } = await import('./route');
    const formData = new FormData();
    const request = new Request('http://localhost/api/fallback-sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-key' },
      body: formData,
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

**Step 2: Run to verify failure**

Run: `npx vitest run app/api/fallback-sync/route.test.ts`
Expected: FAIL

**Step 3: Write the route handler**

```typescript
// app/api/fallback-sync/route.ts
import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { uploadImage } from '@/lib/r2';
import { sql } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!validateApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Compute SHA-256 hash for dedup
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Check if already exists
  const existing = await sql`
    SELECT id FROM fallback_images WHERE file_hash = ${fileHash}
  `;

  if (existing.rows.length > 0) {
    return NextResponse.json({ success: true, skipped: true, message: 'Duplicate, already synced' });
  }

  // Upload to R2
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const key = `fallbacks/${fileHash.slice(0, 12)}.${ext}`;
  const imageUrl = await uploadImage(key, buffer, file.type);

  // Insert record
  await sql`
    INSERT INTO fallback_images (image_url, file_hash)
    VALUES (${imageUrl}, ${fileHash})
  `;

  return NextResponse.json({ success: true, skipped: false });
}
```

**Step 4: Run tests**

Run: `npx vitest run app/api/fallback-sync/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/fallback-sync/ && git commit -m "feat: add fallback image sync route with dedup"
```

---

### Task 8: GET /api/cron/fallback Route

**Files:**
- Create: `app/api/cron/fallback/route.ts`
- Create: `app/api/cron/fallback/route.test.ts`

**Step 1: Write the failing test**

```typescript
// app/api/cron/fallback/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
vi.mock('@/lib/db', () => ({ sql: mockSql }));

vi.mock('@/lib/caption', () => ({
  pickRandomStyle: vi.fn().mockReturnValue('descriptive'),
  generateCaption: vi.fn().mockResolvedValue({ caption: 'A quiet street at dusk', style: 'descriptive' }),
}));

vi.mock('@/lib/r2', () => ({}));

describe('GET /api/cron/fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  it('rejects requests without valid cron secret', async () => {
    const { GET } = await import('./route');
    const request = new Request('http://localhost/api/cron/fallback', {
      headers: { authorization: 'Bearer wrong' },
    });
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('does nothing if a post already exists for today', async () => {
    mockSql.mockResolvedValueOnce({ rows: [{ id: 'existing-post' }] });

    const { GET } = await import('./route');
    const request = new Request('http://localhost/api/cron/fallback', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const response = await GET(request);
    const body = await response.json();
    expect(body.skipped).toBe(true);
  });
});
```

**Step 2: Run to verify failure**

Run: `npx vitest run app/api/cron/fallback/route.test.ts`
Expected: FAIL

**Step 3: Write the route handler**

```typescript
// app/api/cron/fallback/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { generateCaption, pickRandomStyle } from '@/lib/caption';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];

  // Check if post already exists for today
  const existing = await sql`
    SELECT id FROM posts WHERE date = ${today}
  `;

  if (existing.rows.length > 0) {
    return NextResponse.json({ skipped: true, reason: 'Post already exists for today' });
  }

  // Pick a random unused fallback
  const fallback = await sql`
    SELECT id, image_url FROM fallback_images
    WHERE used = false
    ORDER BY random()
    LIMIT 1
  `;

  if (fallback.rows.length === 0) {
    console.warn('No unused fallback images available');
    return NextResponse.json({ skipped: true, reason: 'No fallback images available' });
  }

  const { id: fallbackId, image_url: imageUrl } = fallback.rows[0];

  // Fetch the image to generate a caption
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
  const mediaType = contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const style = pickRandomStyle();
  const { caption, style: usedStyle } = await generateCaption(imageBuffer, mediaType, style);

  // Insert post and mark fallback as used — in a transaction
  const client = await sql.connect();
  try {
    await client.sql`BEGIN`;
    await client.sql`
      INSERT INTO posts (image_url, caption, caption_style, date, is_fallback)
      VALUES (${imageUrl}, ${caption}, ${usedStyle}, ${today}, true)
    `;
    await client.sql`
      UPDATE fallback_images SET used = true, used_date = ${today}
      WHERE id = ${fallbackId}
    `;
    await client.sql`COMMIT`;
  } catch (error) {
    await client.sql`ROLLBACK`;
    throw error;
  } finally {
    client.release();
  }

  return NextResponse.json({ success: true, date: today, caption, fallback: true });
}
```

**Step 4: Run tests**

Run: `npx vitest run app/api/cron/fallback/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/cron/ && git commit -m "feat: add midnight fallback cron job"
```

---

### Task 9: GET /api/posts Route (Paginated)

**Files:**
- Create: `app/api/posts/route.ts`
- Create: `app/api/posts/route.test.ts`

**Step 1: Write the failing test**

```typescript
// app/api/posts/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
vi.mock('@/lib/db', () => ({ sql: mockSql }));

describe('GET /api/posts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns posts with default limit', async () => {
    mockSql.mockResolvedValueOnce({
      rows: [
        { id: '1', image_url: 'https://cdn.example.com/photos/2026-03-02.jpg', caption: 'Test', caption_style: 'poetic', date: '2026-03-02', is_fallback: false },
      ],
    });

    const { GET } = await import('./route');
    const request = new Request('http://localhost/api/posts');
    const response = await GET(request);
    const body = await response.json();
    expect(body.posts).toHaveLength(1);
  });
});
```

**Step 2: Run to verify failure**

Run: `npx vitest run app/api/posts/route.test.ts`
Expected: FAIL

**Step 3: Write the route handler**

```typescript
// app/api/posts/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor'); // ISO date string
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

  let result;
  if (cursor) {
    result = await sql`
      SELECT id, image_url, caption, caption_style, date, is_fallback, created_at
      FROM posts
      WHERE date < ${cursor}
      ORDER BY date DESC
      LIMIT ${limit}
    `;
  } else {
    result = await sql`
      SELECT id, image_url, caption, caption_style, date, is_fallback, created_at
      FROM posts
      ORDER BY date DESC
      LIMIT ${limit}
    `;
  }

  const posts = result.rows;
  const nextCursor = posts.length === limit ? posts[posts.length - 1].date : null;

  return NextResponse.json({ posts, nextCursor });
}
```

**Step 4: Run tests**

Run: `npx vitest run app/api/posts/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/posts/ && git commit -m "feat: add paginated posts API"
```

---

### Task 10: Auth Routes (Login / Logout)

**Files:**
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/auth/login/route.test.ts`

**Step 1: Write the failing test**

```typescript
// app/api/auth/login/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  validatePassword: vi.fn((pw: string) => pw === 'correct-password'),
  signToken: vi.fn().mockResolvedValue('mock-jwt-token'),
}));

// Mock next/headers cookies()
const mockSet = vi.fn();
const mockDelete = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: mockSet,
    delete: mockDelete,
  }),
}));

describe('POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 for wrong password', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('sets cookie and returns 200 for correct password', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith('session', 'mock-jwt-token', expect.any(Object));
  });
});
```

**Step 2: Run to verify failure**

Run: `npx vitest run app/api/auth/login/route.test.ts`
Expected: FAIL

**Step 3: Write login route**

```typescript
// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validatePassword, signToken } from '@/lib/auth';

export async function POST(request: Request) {
  const { password } = await request.json();

  if (!validatePassword(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = await signToken();
  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return NextResponse.json({ success: true });
}
```

**Step 4: Write logout route**

```typescript
// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
  return NextResponse.json({ success: true });
}
```

**Step 5: Run tests**

Run: `npx vitest run app/api/auth/login/route.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add app/api/auth/ && git commit -m "feat: add login and logout routes"
```

---

### Task 11: Middleware (Admin Route Protection)

**Files:**
- Create: `middleware.ts`

**Step 1: Write `middleware.ts`**

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  // Protect admin API routes
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    const token = request.cookies.get('session')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      await jwtVerify(token, secret, { algorithms: ['HS256'] });
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Protect admin pages
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const token = request.cookies.get('session')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      await jwtVerify(token, secret, { algorithms: ['HS256'] });
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('session');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
```

**Step 2: Verify manually**

Run: `npm run dev`, then `curl http://localhost:3000/api/admin/posts/test`
Expected: `{"error":"Unauthorized"}` with 401 status.

**Step 3: Commit**

```bash
git add middleware.ts && git commit -m "feat: add middleware to protect admin routes"
```

---

### Task 12: Admin API Routes (Edit / Delete Posts)

**Files:**
- Create: `app/api/admin/posts/[id]/route.ts`
- Create: `app/api/admin/posts/[id]/route.test.ts`

**Step 1: Write the failing test**

```typescript
// app/api/admin/posts/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
vi.mock('@/lib/db', () => ({ sql: mockSql }));
vi.mock('@/lib/r2', () => ({
  deleteImage: vi.fn().mockResolvedValue(undefined),
}));

describe('Admin posts API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PUT updates caption', async () => {
    mockSql.mockResolvedValueOnce({
      rows: [{ id: 'test-id', caption: 'New caption', caption_style: 'poetic', date: '2026-03-02' }],
    });

    const { PUT } = await import('./route');
    const request = new Request('http://localhost/api/admin/posts/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: 'New caption' }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: 'test-id' }) });
    expect(response.status).toBe(200);
  });

  it('DELETE removes post and image', async () => {
    mockSql
      .mockResolvedValueOnce({ rows: [{ id: 'test-id', image_url: 'https://cdn.example.com/photos/2026-03-02.jpg', is_fallback: false }] })
      .mockResolvedValueOnce({ rows: [] });

    const { DELETE } = await import('./route');
    const request = new Request('http://localhost/api/admin/posts/test-id', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'test-id' }) });
    expect(response.status).toBe(200);
  });
});
```

**Step 2: Run to verify failure**

Run: `npx vitest run app/api/admin/posts/\\[id\\]/route.test.ts`
Expected: FAIL

**Step 3: Write the route handler**

```typescript
// app/api/admin/posts/[id]/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { deleteImage } from '@/lib/r2';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { caption } = await request.json();

  const result = await sql`
    UPDATE posts SET caption = ${caption}, updated_at = now()
    WHERE id = ${id}
    RETURNING id, caption, caption_style, date
  `;

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  return NextResponse.json({ post: result.rows[0] });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch post to get image URL and fallback status
  const post = await sql`
    SELECT id, image_url, is_fallback FROM posts WHERE id = ${id}
  `;

  if (post.rows.length === 0) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const { image_url, is_fallback } = post.rows[0];

  // Delete from database
  await sql`DELETE FROM posts WHERE id = ${id}`;

  // Delete image from R2 (extract key from URL)
  const url = new URL(image_url);
  const key = url.pathname.slice(1); // remove leading /
  await deleteImage(key);

  // If this was a fallback post, mark the fallback image as unused again
  if (is_fallback) {
    await sql`
      UPDATE fallback_images SET used = false, used_date = null
      WHERE image_url = ${image_url}
    `;
  }

  return NextResponse.json({ success: true });
}
```

**Step 4: Run tests**

Run: `npx vitest run app/api/admin/posts/\\[id\\]/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/admin/ && git commit -m "feat: add admin edit and delete post routes"
```

---

### Task 13: Public Gallery Page

**Files:**
- Create: `app/page.tsx`
- Create: `app/gallery.tsx` (client component)
- Create: `app/globals.css` (modify existing)

**Step 1: Write the gallery client component**

```typescript
// app/gallery.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Post } from '@/lib/db';

export function Gallery({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialPosts.length === 20 ? initialPosts[initialPosts.length - 1].date : null
  );
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !nextCursor) return;
    setLoading(true);
    const res = await fetch(`/api/posts?cursor=${nextCursor}&limit=20`);
    const data = await res.json();
    setPosts((prev) => [...prev, ...data.posts]);
    setNextCursor(data.nextCursor);
    setLoading(false);
  }, [loading, nextCursor]);

  // Infinite scroll — load more when sentinel becomes visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { root: containerRef.current, rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const container = containerRef.current;
      if (!container) return;

      if (e.key === 'ArrowRight') {
        container.scrollBy({ left: container.clientWidth, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        container.scrollBy({ left: -container.clientWidth, behavior: 'smooth' });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll to the end (most recent) on load
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollLeft = container.scrollWidth;
    }
  }, []);

  if (posts.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="font-serif text-sm text-neutral-400">No photos yet.</p>
      </div>
    );
  }

  // Reverse so oldest is on the left, newest on the right
  const ordered = [...posts].reverse();

  return (
    <div
      ref={containerRef}
      className="flex h-screen snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
    >
      <div ref={sentinelRef} className="h-full w-px flex-shrink-0" />
      {ordered.map((post) => (
        <article
          key={post.id}
          className="relative flex h-full w-screen flex-shrink-0 snap-center items-center justify-center bg-black"
        >
          <img
            src={post.image_url}
            alt={post.caption}
            loading="lazy"
            className="h-full w-full object-contain"
          />
          <div className="absolute bottom-0 left-0 p-6">
            <p className="font-serif text-sm font-light text-white/90">
              {post.caption}
            </p>
            <time className="mt-1 block font-serif text-xs text-white/50">
              {new Date(post.date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </time>
          </div>
        </article>
      ))}
    </div>
  );
}
```

**Step 2: Write the server page**

```typescript
// app/page.tsx
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
```

**Step 3: Update `app/globals.css`** — ensure the body has no margin/padding and Tailwind base is included:

Add to globals.css (after the Tailwind directives):
```css
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: black;
}
```

**Step 4: Add serif font to `app/layout.tsx`**

Update `layout.tsx` to include a serif font (e.g., `Playfair Display` or system serif). At minimum, ensure `font-serif` maps to a real serif via Tailwind config or a Google Font import. A simple approach:

```typescript
// In app/layout.tsx, add to the <head> or use next/font:
import { Crimson_Text } from 'next/font/google';

const serif = Crimson_Text({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-serif',
});
```

Then in `tailwind.config.ts`:
```typescript
fontFamily: {
  serif: ['var(--font-serif)', 'Georgia', 'serif'],
}
```

**Step 5: Verify manually**

Run: `npm run dev`, visit `http://localhost:3000`
Expected: Black page with "No photos yet." (or gallery if seeded).

**Step 6: Commit**

```bash
git add app/page.tsx app/gallery.tsx app/globals.css app/layout.tsx tailwind.config.ts && git commit -m "feat: add horizontal scroll gallery with lazy loading"
```

---

### Task 14: Login Page

**Files:**
- Create: `app/login/page.tsx`

**Step 1: Write the login page**

```typescript
// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/admin');
    } else {
      setError('Wrong password');
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-black">
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full border-b border-neutral-700 bg-transparent px-0 py-2 font-serif text-sm text-white outline-none placeholder:text-neutral-600 focus:border-white"
          autoFocus
        />
        {error && <p className="mt-2 font-serif text-xs text-red-400">{error}</p>}
      </form>
    </div>
  );
}
```

**Step 2: Verify manually**

Run: `npm run dev`, visit `http://localhost:3000/login`
Expected: Minimal password input on black background.

**Step 3: Commit**

```bash
git add app/login/ && git commit -m "feat: add login page"
```

---

### Task 15: Admin Dashboard

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/admin-dashboard.tsx` (client component)

**Step 1: Write the admin dashboard client component**

```typescript
// app/admin/admin-dashboard.tsx
'use client';

import { useState } from 'react';
import type { Post } from '@/lib/db';

interface AdminProps {
  initialPosts: Post[];
  fallbackCount: number;
  unusedFallbackCount: number;
}

export function AdminDashboard({ initialPosts, fallbackCount, unusedFallbackCount }: AdminProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');

  async function handleDelete(id: string) {
    if (!confirm('Delete this post?')) return;
    const res = await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    }
  }

  async function handleSave(id: string) {
    const res = await fetch(`/api/admin/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: editCaption }),
    });
    if (res.ok) {
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, caption: editCaption } : p))
      );
      setEditingId(null);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-serif text-lg">Admin</h1>
          <button onClick={handleLogout} className="font-serif text-xs text-neutral-500 hover:text-white">
            Logout
          </button>
        </div>

        <div className="mb-8 flex gap-6 font-serif text-xs text-neutral-500">
          <span>{posts.length} posts</span>
          <span>{fallbackCount} fallback images</span>
          <span>{unusedFallbackCount} unused</span>
          {unusedFallbackCount === 0 && (
            <span className="text-red-400">Fallback pool empty</span>
          )}
        </div>

        <div className="space-y-6">
          {posts.map((post) => (
            <div key={post.id} className="flex gap-4 border-b border-neutral-900 pb-6">
              <img
                src={post.image_url}
                alt={post.caption}
                className="h-20 w-20 flex-shrink-0 object-cover"
              />
              <div className="flex-1">
                <time className="font-serif text-xs text-neutral-500">
                  {post.date}
                  {post.is_fallback && ' (fallback)'}
                </time>
                {editingId === post.id ? (
                  <div className="mt-1">
                    <input
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      className="w-full border-b border-neutral-700 bg-transparent py-1 font-serif text-sm text-white outline-none focus:border-white"
                      autoFocus
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleSave(post.id)}
                        className="font-serif text-xs text-white hover:underline"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="font-serif text-xs text-neutral-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 font-serif text-sm font-light">{post.caption}</p>
                )}
              </div>
              <div className="flex flex-shrink-0 gap-2">
                {editingId !== post.id && (
                  <button
                    onClick={() => {
                      setEditingId(post.id);
                      setEditCaption(post.caption);
                    }}
                    className="font-serif text-xs text-neutral-500 hover:text-white"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleDelete(post.id)}
                  className="font-serif text-xs text-neutral-500 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Write the server page**

```typescript
// app/admin/page.tsx
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
```

**Step 3: Verify manually**

Run: `npm run dev`, log in at `/login`, expect redirect to `/admin`.
Expected: Admin dashboard with post list and fallback pool stats.

**Step 4: Commit**

```bash
git add app/admin/ && git commit -m "feat: add admin dashboard with edit and delete"
```

---

### Task 16: End-to-End Manual Testing

**Step 1: Set up environment**

- Create a Vercel Postgres database and add `POSTGRES_URL` to `.env.local`
- Create a Cloudflare R2 bucket with public access, add R2 env vars
- Add an `ANTHROPIC_API_KEY`
- Set `ADMIN_PASSWORD`, `JWT_SECRET`, `API_KEY`, `CRON_SECRET`

**Step 2: Seed database**

Run: `curl http://localhost:3000/api/seed`

**Step 3: Test upload flow**

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@/path/to/test-photo.jpg"
```

Expected: JSON with `success: true`, a caption, and today's date.

**Step 4: Test gallery**

Visit `http://localhost:3000`. Expected: Photo visible with caption and date.

**Step 5: Test fallback sync**

```bash
curl -X POST http://localhost:3000/api/fallback-sync \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@/path/to/fallback-photo.jpg"
```

**Step 6: Test cron fallback** (for a day without a photo)

```bash
curl http://localhost:3000/api/cron/fallback \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Step 7: Test admin**

- Login at `/login`
- Edit a caption
- Delete a post
- Verify gallery updates

**Step 8: Commit any fixes**

```bash
git add -A && git commit -m "fix: address issues found during e2e testing"
```

---

### Task 17: Deploy to Vercel

**Step 1: Push to GitHub**

```bash
git remote add origin <your-github-repo-url>  # if not already set
git push -u origin main
```

**Step 2: Connect to Vercel**

- Import the repo in the Vercel dashboard
- Add all environment variables from `.env.local` to Vercel project settings
- Deploy

**Step 3: Seed production database**

Run: `curl https://your-domain.vercel.app/api/seed`

**Step 4: Remove seed route**

Delete `app/api/seed/route.ts` and commit — you don't want this exposed in production.

```bash
git rm app/api/seed/route.ts && git commit -m "chore: remove seed route after production setup"
git push
```

**Step 5: Verify cron is registered**

Check the Vercel dashboard under Settings → Cron Jobs. Confirm the midnight fallback job is listed.

**Step 6: Test iOS Shortcut against production URL**

Update the Shortcut to point at `https://your-domain.vercel.app/api/upload` and test a photo upload.

---

### Task 18: iOS Shortcut Setup (Documentation)

This is not code — it's a manual setup on your iPhone. Instructions:

**Shortcut 1: Daily Photo**
1. Create a new Shortcut
2. Add "Take Photo" action (front/back camera)
3. Add "Resize Image" action — max width 2048
4. Add "Get Contents of URL" action:
   - URL: `https://your-domain.vercel.app/api/upload`
   - Method: POST
   - Headers: `Authorization: Bearer YOUR_API_KEY`
   - Request Body: Form, add file field named `file` with the resized image
5. Create a Personal Automation → Time of Day
   - Use a helper shortcut that runs at midnight to pick a random minute between 480 (8am) and 1320 (10pm), saves it to a file/note, then schedules the real shortcut. (iOS limitations may require creative workarounds — a simpler alternative is to set a fixed time and use the "run daily" trigger.)

**Shortcut 2: Fallback Sync**
1. Create a new Shortcut
2. Add "Find Photos" action — Album: Fallback
3. Add "Repeat with Each" loop:
   - "Resize Image" — max width 2048
   - "Get Contents of URL" — POST to `/api/fallback-sync` with Bearer token and file
4. Run manually whenever you add new photos to the Fallback album
