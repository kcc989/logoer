import { env } from 'cloudflare:workers';
import type { RequestInfo } from 'rwsdk/worker';

import { UnauthorizedError, ValidationError } from '@/lib/errors';

// Types for Workers AI responses
interface ImageToTextResult {
  description: string;
}

interface ImageAnalysis {
  description: string;
  suggestedColors: string[];
  suggestedTheme: string;
  suggestedType: string;
}

const UPLOAD_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Analyze an uploaded image using Workers AI
 * Extracts colors, style suggestions, and descriptions
 */
export async function analyzeImage({
  ctx,
  request,
}: RequestInfo): Promise<Response> {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  const contentType = request.headers.get('content-type') || '';

  if (!contentType.includes('multipart/form-data')) {
    throw new ValidationError('Expected multipart/form-data');
  }

  const formData = await request.formData();
  const file = formData.get('image');

  if (!file || !(file instanceof File)) {
    throw new ValidationError('No image file provided');
  }

  // Validate file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new ValidationError(
      `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
    );
  }

  // Validate file size
  if (file.size > UPLOAD_MAX_SIZE_BYTES) {
    throw new ValidationError(
      `File too large. Maximum size is ${UPLOAD_MAX_SIZE_BYTES / 1024 / 1024}MB`
    );
  }

  // Convert file to array buffer for AI processing
  const arrayBuffer = await file.arrayBuffer();
  const imageData = [...new Uint8Array(arrayBuffer)];

  // Use Workers AI for image-to-text analysis
  const aiResult = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
    image: imageData,
    prompt:
      'Analyze this image for logo design inspiration. Describe the main colors, style (modern, vintage, minimal, bold, etc.), and any shapes or symbols that could inspire a logo design. Be concise and specific.',
    max_tokens: 256,
  });

  const description =
    typeof aiResult === 'object' && 'description' in aiResult
      ? (aiResult as ImageToTextResult).description
      : String(aiResult);

  // Parse the AI response to extract useful information
  const analysis = parseAIResponse(description);

  // Store the uploaded image in R2 for reference
  const imageId = crypto.randomUUID();
  const extension = file.type.split('/')[1] || 'png';
  const key = `uploads/${ctx.user.id}/${imageId}.${extension}`;

  await env.UPLOADS_BUCKET.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type,
    },
  });

  return Response.json({
    id: imageId,
    url: `/api/uploads/${imageId}.${extension}`,
    analysis,
  });
}

/**
 * Parse AI response to extract structured information
 */
function parseAIResponse(description: string): ImageAnalysis {
  const colorPatterns = [
    /\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|gold|silver|navy|teal|coral|maroon|burgundy|cyan|magenta|indigo|violet|brown|beige|cream|olive)\b/gi,
  ];

  const themePatterns: Record<string, RegExp> = {
    modern: /\b(modern|contemporary|sleek|clean|minimalist)\b/i,
    vintage: /\b(vintage|retro|classic|old|traditional|nostalgic)\b/i,
    minimal: /\b(minimal|simple|basic|understated)\b/i,
    bold: /\b(bold|strong|powerful|impactful|vibrant)\b/i,
    elegant: /\b(elegant|sophisticated|luxurious|refined|classy)\b/i,
    playful: /\b(playful|fun|whimsical|cheerful|bright)\b/i,
    tech: /\b(tech|digital|futuristic|cyber|electronic)\b/i,
    organic: /\b(organic|natural|earthy|eco|green)\b/i,
  };

  const typePatterns: Record<string, RegExp> = {
    wordmark: /\b(text|word|typography|lettering|font)\b/i,
    lettermark: /\b(initial|letter|monogram|abbreviation)\b/i,
    pictorial: /\b(icon|symbol|image|picture|illustration)\b/i,
    abstract: /\b(abstract|geometric|shape|pattern)\b/i,
    mascot: /\b(mascot|character|figure|person|animal)\b/i,
    combination: /\b(combination|combo|mixed|both)\b/i,
    emblem: /\b(emblem|badge|crest|seal|stamp)\b/i,
  };

  // Extract colors
  const colors: string[] = [];
  for (const pattern of colorPatterns) {
    const matches = description.match(pattern);
    if (matches) {
      colors.push(...matches.map((c) => c.toLowerCase()));
    }
  }
  const uniqueColors = [...new Set(colors)].slice(0, 5);

  // Detect theme
  let suggestedTheme = 'modern';
  for (const [theme, pattern] of Object.entries(themePatterns)) {
    if (pattern.test(description)) {
      suggestedTheme = theme;
      break;
    }
  }

  // Detect type
  let suggestedType = 'combination';
  for (const [type, pattern] of Object.entries(typePatterns)) {
    if (pattern.test(description)) {
      suggestedType = type;
      break;
    }
  }

  return {
    description,
    suggestedColors: uniqueColors.length > 0 ? uniqueColors : ['blue', 'gray'],
    suggestedTheme,
    suggestedType,
  };
}

/**
 * Serve an uploaded image from R2
 */
export async function serveUpload({ params }: RequestInfo): Promise<Response> {
  const path = params['*'];

  if (!path) {
    return new Response('Not found', { status: 404 });
  }

  // Extract user ID from the path
  const object = await env.UPLOADS_BUCKET.get(`uploads/${path}`);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

  return new Response(object.body, { headers });
}
