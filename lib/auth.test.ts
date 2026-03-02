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
