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
    process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev';
    process.env.R2_BUCKET_NAME = 'test-bucket';
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
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
