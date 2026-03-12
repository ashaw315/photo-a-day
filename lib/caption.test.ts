// lib/caption.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function () { return { messages: { create: mockCreate } }; }),
}));

describe('generateCaption', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockReset();
  });

  it('returns a descriptive caption', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'A quiet street lined with autumn trees' }],
    });

    const { generateCaption } = await import('./caption');
    const result = await generateCaption(Buffer.from('fake'), 'image/jpeg');

    expect(result.caption).toBe('A quiet street lined with autumn trees');
    expect(result.style).toBe('descriptive');
  });

  it('returns placeholder on API failure after retry', async () => {
    mockCreate.mockRejectedValue(new Error('API down'));

    const { generateCaption } = await import('./caption');
    const result = await generateCaption(Buffer.from('fake'), 'image/jpeg');

    expect(result.caption).toBe('—');
    expect(result.style).toBe('descriptive');
  });
});
