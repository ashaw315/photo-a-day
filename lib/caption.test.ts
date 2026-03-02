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
