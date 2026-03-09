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
    } catch (error) {
      console.error(`[caption] Attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : error);
      if (attempt === 1) {
        return { caption: '—', style };
      }
    }
  }

  return { caption: '—', style };
}
