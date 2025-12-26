/**
 * Concept Generation TanStack AI Tool
 *
 * Tool for generating logo concept grids using Google AI.
 */

import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import {
  generateConceptGrid,
  generateQuickConceptGrid,
  GRID_CONFIGS,
  type StyleDirection,
  type ConceptGridResult,
} from '@/lib/google-ai';
import type { BrandDiscoveryData } from '@/lib/agent/types';

/**
 * Style direction schema for concept generation
 */
const StyleDirectionSchema = z.object({
  type: z.enum(['wordmark', 'lettermark', 'icon', 'combination', 'emblem', 'abstract']),
  style: z.enum(['minimalist', 'geometric', 'organic', 'bold', 'elegant', 'playful']),
  mood: z.string().describe('The emotional mood of the design (e.g., "professional", "friendly", "energetic")'),
  primaryColors: z.array(z.string()).describe('Primary colors to use (e.g., ["#3b82f6", "#1e40af"])'),
  accentColors: z.array(z.string()).describe('Accent colors to use'),
});

/**
 * Input schema for detailed concept generation
 */
const GenerateConceptsInputSchema = z.object({
  brandName: z.string().describe('The brand name for the logo'),
  industry: z.string().describe('The industry or business niche'),
  targetAudience: z.string().optional().describe('Description of the target audience'),
  brandPersonality: z.array(z.string()).optional().describe('Brand personality traits (e.g., ["modern", "trustworthy"])'),
  styleDirections: z.array(StyleDirectionSchema).min(1).max(9).describe(
    'Array of style directions for each concept cell. Provide 1-9 directions. ' +
    'If fewer than grid cells, directions will cycle.'
  ),
  gridSize: z.enum(['small', 'medium', 'large']).default('medium').describe(
    'Grid size: small (2x2=4), medium (2x3=6), large (3x3=9)'
  ),
  additionalGuidance: z.string().optional().describe('Additional creative guidance for the AI'),
});

/**
 * Input schema for quick concept generation
 */
const QuickConceptsInputSchema = z.object({
  brandName: z.string().describe('The brand name for the logo'),
  industry: z.string().describe('The industry or business niche'),
  gridSize: z.enum(['small', 'medium', 'large']).default('medium').describe(
    'Grid size: small (2x2=4), medium (2x3=6), large (3x3=9)'
  ),
});

/**
 * Tool definition for generating concept grids
 */
export const generateConceptsDef = toolDefinition({
  name: 'generateConcepts',
  description:
    'Generate a grid of logo concept previews using Google AI. ' +
    'Use this tool in the CONCEPT phase to quickly explore multiple logo directions. ' +
    'The grid allows users to see and compare several concepts at once before selecting one for SVG generation. ' +
    'Provide detailed style directions for best results.',
  inputSchema: GenerateConceptsInputSchema,
});

/**
 * Tool definition for quick concept generation
 */
export const quickConceptsDef = toolDefinition({
  name: 'quickConcepts',
  description:
    'Quickly generate a grid of diverse logo concept previews with minimal input. ' +
    'Use this when you want to rapidly explore concepts without detailed style specifications. ' +
    'The AI will automatically vary logo types, styles, and moods across the grid.',
  inputSchema: QuickConceptsInputSchema,
});

/**
 * Type for generateConcepts input
 */
type GenerateConceptsInput = z.infer<typeof GenerateConceptsInputSchema>;

/**
 * Type for quickConcepts input
 */
type QuickConceptsInput = z.infer<typeof QuickConceptsInputSchema>;

/**
 * Store concept grid image in R2
 */
async function storeConceptGridInR2(
  result: ConceptGridResult,
  brandName: string
): Promise<string> {
  const bucket = env.LOGOS_BUCKET;
  const timestamp = Date.now();
  const sanitizedBrand = brandName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const key = `concepts/${sanitizedBrand}/${timestamp}-grid.png`;

  // Convert base64 to ArrayBuffer
  const binaryString = atob(result.gridImageBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  await bucket.put(key, bytes.buffer, {
    httpMetadata: {
      contentType: result.mimeType,
    },
    customMetadata: {
      brandName,
      gridRows: String(result.gridConfig.rows),
      gridCols: String(result.gridConfig.cols),
      generatedAt: result.generatedAt,
    },
  });

  // Return the public URL path
  return `/api/logos/${key}`;
}

/**
 * Create server implementation for generateConcepts
 */
export function createGenerateConceptsTool() {
  return generateConceptsDef.server(async (rawInput) => {
    console.log('[generateConcepts] ====== TOOL INVOKED ======');
    console.log('[generateConcepts] Raw input:', JSON.stringify(rawInput, null, 2));

    // Check if Google AI API key is configured
    if (!env.GOOGLE_AI_API_KEY) {
      console.log('[generateConcepts] GOOGLE_AI_API_KEY not configured');
      return {
        success: false,
        error: 'GOOGLE_AI_API_KEY not configured',
        gridImageUrl: null,
        concepts: [],
      };
    }

    const input = rawInput as GenerateConceptsInput;

    try {
      // Build brand info from input
      const brandInfo: BrandDiscoveryData = {
        brandName: input.brandName,
        industry: input.industry,
        targetAudience: input.targetAudience || '',
        brandPersonality: input.brandPersonality || [],
        competitors: [],
        colorPreferences: [],
        stylePreferences: [],
        additionalNotes: input.additionalGuidance || '',
        completenessScore: 0,
      };

      // Convert schema style directions to our type
      const styleDirections: StyleDirection[] = input.styleDirections.map((sd) => ({
        type: sd.type,
        style: sd.style,
        mood: sd.mood,
        primaryColors: sd.primaryColors,
        accentColors: sd.accentColors,
      }));

      // Generate concept grid
      const result = await generateConceptGrid(
        env.GOOGLE_AI_API_KEY,
        {
          brandInfo,
          styleDirections,
          gridSize: input.gridSize,
          additionalGuidance: input.additionalGuidance,
        },
        {
          enhancePrompt: true,
        }
      );

      // Store in R2
      const gridImageUrl = await storeConceptGridInR2(result, input.brandName);

      console.log(`[generateConcepts] Generated ${result.concepts.length} concepts`);
      console.log(`[generateConcepts] Stored at: ${gridImageUrl}`);

      return {
        success: true,
        gridImageUrl,
        gridImageBase64: result.gridImageBase64,
        mimeType: result.mimeType,
        gridConfig: {
          rows: result.gridConfig.rows,
          cols: result.gridConfig.cols,
          cellSize: result.gridConfig.cellSize,
        },
        concepts: result.concepts.map((c) => ({
          position: c.position,
          description: c.description,
          type: c.styleDirection.type,
          style: c.styleDirection.style,
          mood: c.styleDirection.mood,
        })),
        enhancedPrompt: result.enhancedPrompt,
        totalConcepts: result.concepts.length,
      };
    } catch (error) {
      console.error('[generateConcepts] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Concept generation failed',
        gridImageUrl: null,
        concepts: [],
      };
    }
  });
}

/**
 * Create server implementation for quickConcepts
 */
export function createQuickConceptsTool() {
  return quickConceptsDef.server(async (rawInput) => {
    console.log('[quickConcepts] ====== TOOL INVOKED ======');
    console.log('[quickConcepts] Raw input:', JSON.stringify(rawInput, null, 2));

    // Check if Google AI API key is configured
    if (!env.GOOGLE_AI_API_KEY) {
      console.log('[quickConcepts] GOOGLE_AI_API_KEY not configured');
      return {
        success: false,
        error: 'GOOGLE_AI_API_KEY not configured',
        gridImageUrl: null,
        concepts: [],
      };
    }

    const input = rawInput as QuickConceptsInput;

    try {
      // Generate quick concept grid
      const result = await generateQuickConceptGrid(
        env.GOOGLE_AI_API_KEY,
        input.brandName,
        input.industry,
        input.gridSize,
        {
          enhancePrompt: true,
        }
      );

      // Store in R2
      const gridImageUrl = await storeConceptGridInR2(result, input.brandName);

      console.log(`[quickConcepts] Generated ${result.concepts.length} concepts`);
      console.log(`[quickConcepts] Stored at: ${gridImageUrl}`);

      return {
        success: true,
        gridImageUrl,
        gridImageBase64: result.gridImageBase64,
        mimeType: result.mimeType,
        gridConfig: {
          rows: result.gridConfig.rows,
          cols: result.gridConfig.cols,
          cellSize: result.gridConfig.cellSize,
        },
        concepts: result.concepts.map((c) => ({
          position: c.position,
          description: c.description,
          type: c.styleDirection.type,
          style: c.styleDirection.style,
        })),
        enhancedPrompt: result.enhancedPrompt,
        totalConcepts: result.concepts.length,
      };
    } catch (error) {
      console.error('[quickConcepts] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Quick concept generation failed',
        gridImageUrl: null,
        concepts: [],
      };
    }
  });
}
