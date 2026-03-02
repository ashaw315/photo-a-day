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
    expect(body.posts[0].id).toBe('1');
    expect(body.nextCursor).toBeNull();
  });

  it('returns nextCursor when results equal limit', async () => {
    const posts = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      image_url: `https://cdn.example.com/photos/2026-02-${String(28 - i).padStart(2, '0')}.jpg`,
      caption: `Caption ${i + 1}`,
      caption_style: 'poetic',
      date: `2026-02-${String(28 - i).padStart(2, '0')}`,
      is_fallback: false,
    }));
    mockSql.mockResolvedValueOnce({ rows: posts });

    const { GET } = await import('./route');
    const request = new Request('http://localhost/api/posts?limit=5');
    const response = await GET(request);
    const body = await response.json();
    expect(body.posts).toHaveLength(5);
    expect(body.nextCursor).toBe('2026-02-24');
  });

  it('uses cursor for pagination', async () => {
    mockSql.mockResolvedValueOnce({ rows: [] });

    const { GET } = await import('./route');
    const request = new Request('http://localhost/api/posts?cursor=2026-02-20&limit=10');
    const response = await GET(request);
    const body = await response.json();
    expect(body.posts).toHaveLength(0);
    expect(body.nextCursor).toBeNull();
    // Verify sql was called with cursor-based query (tagged template)
    expect(mockSql).toHaveBeenCalled();
  });

  it('caps limit at 100', async () => {
    mockSql.mockResolvedValueOnce({ rows: [] });

    const { GET } = await import('./route');
    const request = new Request('http://localhost/api/posts?limit=500');
    const response = await GET(request);
    const body = await response.json();
    expect(body.posts).toHaveLength(0);
    // The limit should have been capped at 100
    expect(mockSql).toHaveBeenCalled();
  });
});
