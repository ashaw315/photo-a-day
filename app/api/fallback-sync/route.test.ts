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
