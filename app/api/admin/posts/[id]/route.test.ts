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
