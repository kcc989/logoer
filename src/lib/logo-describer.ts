import { env } from 'cloudflare:workers';
import Anthropic from '@anthropic-ai/sdk';

export type LogoDescription = {
  description: string;
  style: string;
  colors: string[];
  elements: string[];
  mood: string;
  industry: string | null;
};

/**
 * Describe a logo image using Claude Vision.
 *
 * @param pngBuffer - The PNG image as a buffer
 * @returns Structured description of the logo
 */
export async function describeLogo(
  pngBuffer: Uint8Array
): Promise<LogoDescription> {
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });

  const base64Image = btoa(
    String.fromCharCode(...new Uint8Array(pngBuffer))
  );

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `Analyze this logo and provide a structured description. Return your response as valid JSON with these fields:

{
  "description": "A comprehensive 2-3 sentence description of the logo",
  "style": "The design style (e.g., minimalist, vintage, modern, playful, corporate, abstract, geometric)",
  "colors": ["Array of main colors used, as descriptive names"],
  "elements": ["Array of key visual elements or symbols in the logo"],
  "mood": "The overall mood or feeling the logo conveys",
  "industry": "The likely industry or type of business (null if unclear)"
}

Only respond with the JSON object, no other text.`,
          },
        ],
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    return JSON.parse(textContent.text) as LogoDescription;
  } catch {
    throw new Error(`Failed to parse Claude response: ${textContent.text}`);
  }
}
