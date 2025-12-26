/**
 * Concept Grid Prompt Builder
 *
 * Builds optimized prompts for generating logo concept grids with Google AI.
 */

import {
  GRID_CONFIGS,
  type ConceptGridInput,
  type StyleDirection,
  type ConceptGridConfig,
} from './types';

/**
 * Map logo type to descriptive text
 */
function describeLogoType(type: StyleDirection['type']): string {
  const descriptions: Record<StyleDirection['type'], string> = {
    wordmark: 'text-based logo using stylized typography of the brand name',
    lettermark: 'logo using initials or monogram of the brand',
    icon: 'symbolic icon or pictorial mark without text',
    combination: 'icon combined with brand name text',
    emblem: 'text enclosed within a badge, seal, or crest shape',
    abstract: 'abstract geometric or organic shape representing the brand essence',
  };
  return descriptions[type];
}

/**
 * Map style to descriptive text
 */
function describeStyle(style: StyleDirection['style']): string {
  const descriptions: Record<StyleDirection['style'], string> = {
    minimalist: 'clean, simple lines with maximum negative space',
    geometric: 'precise geometric shapes and mathematical proportions',
    organic: 'flowing, natural curves and hand-drawn feel',
    bold: 'heavy weight, strong presence, impactful',
    elegant: 'refined, sophisticated, graceful details',
    playful: 'fun, whimsical, energetic character',
  };
  return descriptions[style];
}

/**
 * Format colors for prompt
 */
function formatColors(primary: string[], accent: string[]): string {
  const allColors = [...primary, ...accent].filter(Boolean);
  if (allColors.length === 0) return 'professional color palette';
  if (allColors.length === 1) return `${allColors[0]} as the dominant color`;
  return `${primary.join(' and ')} as primary colors${accent.length > 0 ? `, with ${accent.join(' and ')} as accents` : ''}`;
}

/**
 * Build description for a single concept cell
 */
function buildConceptDescription(
  direction: StyleDirection,
  brandName: string,
  index: number
): string {
  const typeDesc = describeLogoType(direction.type);
  const styleDesc = describeStyle(direction.style);
  const colorDesc = formatColors(direction.primaryColors, direction.accentColors);

  return `Cell ${index + 1}: ${typeDesc}, ${styleDesc}, ${direction.mood} mood, using ${colorDesc}`;
}

/**
 * Build the main grid generation prompt
 */
export function buildConceptGridPrompt(input: ConceptGridInput): string {
  const { brandInfo, styleDirections, gridSize, additionalGuidance } = input;
  const gridConfig = GRID_CONFIGS[gridSize];
  const totalCells = gridConfig.rows * gridConfig.cols;

  // Ensure we have enough style directions for all cells
  const directions = styleDirections.slice(0, totalCells);
  while (directions.length < totalCells) {
    // Cycle through provided directions if not enough
    directions.push(styleDirections[directions.length % styleDirections.length]);
  }

  // Build individual concept descriptions
  const conceptDescriptions = directions
    .map((dir, i) => buildConceptDescription(dir, brandInfo.brandName, i))
    .join('\n');

  // Build industry context
  const industryContext = brandInfo.industry
    ? `for a ${brandInfo.industry} brand`
    : '';

  // Build personality context
  const personalityContext =
    brandInfo.brandPersonality.length > 0
      ? `Brand personality: ${brandInfo.brandPersonality.join(', ')}.`
      : '';

  // Build target audience context
  const audienceContext = brandInfo.targetAudience
    ? `Target audience: ${brandInfo.targetAudience}.`
    : '';

  const prompt = `Create a ${gridConfig.rows}x${gridConfig.cols} grid of distinct logo concepts for "${brandInfo.brandName}" ${industryContext}.

CRITICAL REQUIREMENTS:
- Generate exactly ${totalCells} unique logo designs arranged in a clean grid
- Each cell should be clearly separated with thin dividing lines
- All logos should be on a pure white background
- Each logo should be centered within its cell
- Logos should be vector-style, crisp, and professional
- NO text labels or annotations outside the logos themselves

${personalityContext}
${audienceContext}

CONCEPT VARIATIONS:
${conceptDescriptions}

STYLE GUIDELINES:
- Maintain consistent quality across all concepts
- Each concept should be distinctly different from others
- Logos should work at small sizes (favicons) and large (billboards)
- Use clean, professional design language
- Ensure high contrast and readability

${additionalGuidance ? `ADDITIONAL GUIDANCE:\n${additionalGuidance}` : ''}

Generate a single image containing all ${totalCells} logo concepts in a neat grid layout.`;

  return prompt;
}

/**
 * Build a simpler prompt for quick concept exploration
 */
export function buildQuickConceptPrompt(
  brandName: string,
  industry: string,
  gridConfig: ConceptGridConfig
): string {
  const totalCells = gridConfig.rows * gridConfig.cols;

  return `Create a ${gridConfig.rows}x${gridConfig.cols} grid of ${totalCells} distinct logo concepts for "${brandName}" (${industry}).

Requirements:
- ${totalCells} unique, professional logo designs
- Clean grid layout with thin dividers
- White background for each cell
- Mix of styles: wordmarks, icons, combination marks
- Vector-style, crisp graphics
- No annotations or labels

Each logo should be distinctly different, exploring various approaches to represent the brand.`;
}
