// app/api/cron/fallback/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
vi.mock('@/lib/db', () => ({ sql: mockSql }));

vi.mock('@/lib/caption', () => ({
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
