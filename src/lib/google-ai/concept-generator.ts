/**
 * Concept Grid Generator
 *
 * Generates logo concept grids using Google AI's Gemini image generation.
 */

import { type GoogleGenAI, SafetyFilterLevel } from '@google/genai';
import { createGoogleAIClient } from './client';
import { buildConceptGridPrompt, buildQuickConceptPrompt } from './prompt-builder';
import type { SafetyFilterLevelOption } from './types';
import {
  GRID_CONFIGS,
  type ConceptGridInput,
  type ConceptGridResult,
  type ConceptGridConfig,
  type ConceptGenerationOptions,
  type ExtractedConcept,
  type StyleDirection,
  type GridSize,
} from './types';

/**
 * Model for image generation using Imagen
 */
const IMAGEN_MODEL = 'imagen-3.0-generate-002';

/**
 * Model for multimodal image generation using Gemini
 */
const GEMINI_IMAGE_MODEL = 'gemini-2.0-flash-exp';

/**
 * Generate a concept grid using detailed style directions
 */
export async function generateConceptGrid(
  apiKey: string,
  input: ConceptGridInput,
  options: ConceptGenerationOptions = {}
): Promise<ConceptGridResult> {
  const client = createGoogleAIClient(apiKey);
  const gridConfig = GRID_CONFIGS[input.gridSize];
  const prompt = buildConceptGridPrompt(input);

  const result = await generateGridImage(client, prompt, gridConfig, options);

  // Extract concept metadata from input
  const concepts = extractConceptsFromInput(input, gridConfig);

  return {
    ...result,
    concepts,
    generationPrompt: prompt,
  };
}

/**
 * Generate a quick concept grid with minimal input
 */
export async function generateQuickConceptGrid(
  apiKey: string,
  brandName: string,
  industry: string,
  gridSize: GridSize = 'medium',
  options: ConceptGenerationOptions = {}
): Promise<ConceptGridResult> {
  const client = createGoogleAIClient(apiKey);
  const gridConfig = GRID_CONFIGS[gridSize];
  const prompt = buildQuickConceptPrompt(brandName, industry, gridConfig);

  const result = await generateGridImage(client, prompt, gridConfig, options);

  // For quick generation, create generic concept descriptions
  const concepts = generateGenericConcepts(gridConfig, brandName);

  return {
    ...result,
    concepts,
    generationPrompt: prompt,
  };
}

/**
 * Map safety level string to SDK enum
 */
function mapSafetyLevel(level: SafetyFilterLevelOption): SafetyFilterLevel {
  return SafetyFilterLevel[level];
}

/**
 * Core function to generate grid image using Google AI Imagen
 */
async function generateGridImage(
  client: GoogleGenAI,
  prompt: string,
  gridConfig: ConceptGridConfig,
  options: ConceptGenerationOptions
): Promise<Omit<ConceptGridResult, 'concepts' | 'generationPrompt'>> {
  // Use Imagen for dedicated image generation
  const response = await client.models.generateImages({
    model: IMAGEN_MODEL,
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: gridConfig.cols === gridConfig.rows ? '1:1' : '16:9',
      enhancePrompt: options.enhancePrompt ?? true,
      includeRaiReason: true,
      ...(options.seed !== undefined && { seed: options.seed }),
      ...(options.safetyLevel && { safetyFilterLevel: mapSafetyLevel(options.safetyLevel) }),
    },
  });

  // Extract image from response
  const generatedImage = response.generatedImages?.[0];
  if (!generatedImage?.image?.imageBytes) {
    const reason = generatedImage?.raiFilteredReason;
    throw new Error(
      reason
        ? `Image generation blocked: ${reason}`
        : 'No image data in response'
    );
  }

  return {
    gridImageBase64: generatedImage.image.imageBytes,
    mimeType: 'image/png',
    gridConfig,
    enhancedPrompt: generatedImage.enhancedPrompt,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Alternative: Generate grid image using Gemini multimodal output
 * Use this for more creative/experimental image generation
 */
async function generateGridImageWithGemini(
  client: GoogleGenAI,
  prompt: string,
  gridConfig: ConceptGridConfig,
  options: ConceptGenerationOptions
): Promise<Omit<ConceptGridResult, 'concepts' | 'generationPrompt'>> {
  // Use Gemini's multimodal generation for image output
  const response = await client.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: prompt,
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
      ...(options.seed !== undefined && { seed: options.seed }),
    },
  });

  // Extract image from response
  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) {
    throw new Error('No content in response');
  }

  let imageData: string | null = null;
  let mimeType = 'image/png';
  let enhancedPrompt: string | undefined;

  for (const part of candidate.content.parts) {
    if (part.inlineData?.data) {
      imageData = part.inlineData.data;
      mimeType = part.inlineData.mimeType || 'image/png';
    }
    if (part.text) {
      enhancedPrompt = part.text;
    }
  }

  if (!imageData) {
    throw new Error('No image data in response');
  }

  return {
    gridImageBase64: imageData,
    mimeType,
    gridConfig,
    enhancedPrompt,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Extract concept metadata from the input configuration
 */
function extractConceptsFromInput(
  input: ConceptGridInput,
  gridConfig: ConceptGridConfig
): ExtractedConcept[] {
  const concepts: ExtractedConcept[] = [];
  const totalCells = gridConfig.rows * gridConfig.cols;

  for (let i = 0; i < totalCells; i++) {
    const row = Math.floor(i / gridConfig.cols);
    const col = i % gridConfig.cols;
    const direction = input.styleDirections[i % input.styleDirections.length];

    concepts.push({
      position: { row, col },
      description: buildConceptDescription(direction, input.brandInfo.brandName),
      styleDirection: direction,
    });
  }

  return concepts;
}

/**
 * Generate generic concept descriptions for quick mode
 */
function generateGenericConcepts(
  gridConfig: ConceptGridConfig,
  brandName: string
): ExtractedConcept[] {
  const concepts: ExtractedConcept[] = [];
  const totalCells = gridConfig.rows * gridConfig.cols;

  const defaultStyles: StyleDirection[] = [
    { type: 'wordmark', style: 'minimalist', mood: 'modern', primaryColors: [], accentColors: [] },
    { type: 'icon', style: 'geometric', mood: 'professional', primaryColors: [], accentColors: [] },
    { type: 'combination', style: 'bold', mood: 'confident', primaryColors: [], accentColors: [] },
    { type: 'lettermark', style: 'elegant', mood: 'refined', primaryColors: [], accentColors: [] },
    { type: 'abstract', style: 'organic', mood: 'friendly', primaryColors: [], accentColors: [] },
    { type: 'emblem', style: 'playful', mood: 'energetic', primaryColors: [], accentColors: [] },
  ];

  for (let i = 0; i < totalCells; i++) {
    const row = Math.floor(i / gridConfig.cols);
    const col = i % gridConfig.cols;
    const direction = defaultStyles[i % defaultStyles.length];

    concepts.push({
      position: { row, col },
      description: `${direction.type} logo with ${direction.style} style`,
      styleDirection: direction,
    });
  }

  return concepts;
}

/**
 * Build a description string for a concept
 */
function buildConceptDescription(direction: StyleDirection, brandName: string): string {
  const colorInfo =
    direction.primaryColors.length > 0
      ? ` using ${direction.primaryColors.join(', ')}`
      : '';

  return `${direction.type} logo for ${brandName} with ${direction.style} style and ${direction.mood} mood${colorInfo}`;
}

/**
 * Utility to calculate grid cell coordinates from pixel position
 */
export function getCellFromPosition(
  x: number,
  y: number,
  gridConfig: ConceptGridConfig
): { row: number; col: number } | null {
  const col = Math.floor(x / gridConfig.cellSize);
  const row = Math.floor(y / gridConfig.cellSize);

  if (col >= 0 && col < gridConfig.cols && row >= 0 && row < gridConfig.rows) {
    return { row, col };
  }
  return null;
}

/**
 * Get the pixel bounds for a specific grid cell
 */
export function getCellBounds(
  row: number,
  col: number,
  gridConfig: ConceptGridConfig
): { x: number; y: number; width: number; height: number } {
  return {
    x: col * gridConfig.cellSize,
    y: row * gridConfig.cellSize,
    width: gridConfig.cellSize,
    height: gridConfig.cellSize,
  };
}
