/**
 * Google AI Concept Generation Types
 *
 * Types for generating logo concept grids using Google's Gemini image generation.
 */

import type { BrandDiscoveryData, ResearchResult } from '../agent/types';

/**
 * Grid layout configuration
 */
export interface ConceptGridConfig {
  rows: number;
  cols: number;
  cellSize: number; // pixels per cell
}

/**
 * Default grid configurations
 */
export const GRID_CONFIGS = {
  small: { rows: 2, cols: 2, cellSize: 512 } as ConceptGridConfig,
  medium: { rows: 2, cols: 3, cellSize: 512 } as ConceptGridConfig,
  large: { rows: 3, cols: 3, cellSize: 512 } as ConceptGridConfig,
} as const;

export type GridSize = keyof typeof GRID_CONFIGS;

/**
 * Style direction for concept generation
 */
export interface StyleDirection {
  type: 'wordmark' | 'lettermark' | 'icon' | 'combination' | 'emblem' | 'abstract';
  style: 'minimalist' | 'geometric' | 'organic' | 'bold' | 'elegant' | 'playful';
  mood: string;
  primaryColors: string[];
  accentColors: string[];
}

/**
 * Input for concept grid generation
 */
export interface ConceptGridInput {
  brandInfo: BrandDiscoveryData;
  researchInsights?: ResearchResult[];
  styleDirections: StyleDirection[];
  gridSize: GridSize;
  additionalGuidance?: string;
}

/**
 * Individual concept extracted from the grid
 */
export interface ExtractedConcept {
  position: { row: number; col: number };
  description: string;
  styleDirection: StyleDirection;
}

/**
 * Result of concept grid generation
 */
export interface ConceptGridResult {
  gridImageBase64: string;
  gridImageUrl?: string; // R2 URL after storage
  mimeType: string;
  gridConfig: ConceptGridConfig;
  concepts: ExtractedConcept[];
  generationPrompt: string;
  enhancedPrompt?: string;
  generatedAt: string;
}

/**
 * Safety filter level options (mirrors Google AI SDK enum)
 */
export type SafetyFilterLevelOption =
  | 'BLOCK_LOW_AND_ABOVE'
  | 'BLOCK_MEDIUM_AND_ABOVE'
  | 'BLOCK_ONLY_HIGH'
  | 'BLOCK_NONE';

/**
 * Options for concept generation
 */
export interface ConceptGenerationOptions {
  seed?: number;
  enhancePrompt?: boolean;
  safetyLevel?: SafetyFilterLevelOption;
}
