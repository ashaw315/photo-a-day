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
