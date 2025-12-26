/**
 * Logo Generator Constants
 *
 * Preset values and configuration options for logo generation.
 */

import type { LogoType, LogoShape, LogoTheme, LogoConfig } from './logo-types';

/**
 * Theme presets with predefined colors and typography settings
 */
export const THEME_PRESETS: Record<
  LogoTheme,
  {
    primary: string;
    accent: string;
    letterSpacing: number;
    fontWeight: string;
    description: string;
  }
> = {
  modern: {
    primary: '#0f172a',
    accent: '#3b82f6',
    letterSpacing: 4,
    fontWeight: 'bold',
    description: 'Clean lines with bold blue accents',
  },
  minimal: {
    primary: '#18181b',
    accent: '#18181b',
    letterSpacing: 8,
    fontWeight: '300',
    description: 'Simple, elegant, monochromatic',
  },
  bold: {
    primary: '#dc2626',
    accent: '#fbbf24',
    letterSpacing: 0,
    fontWeight: '900',
    description: 'Striking red and gold combination',
  },
  elegant: {
    primary: '#1c1917',
    accent: '#a8a29e',
    letterSpacing: 12,
    fontWeight: '300',
    description: 'Sophisticated with generous spacing',
  },
  playful: {
    primary: '#7c3aed',
    accent: '#f472b6',
    letterSpacing: 2,
    fontWeight: 'bold',
    description: 'Fun purple and pink tones',
  },
  tech: {
    primary: '#06b6d4',
    accent: '#22d3ee',
    letterSpacing: 3,
    fontWeight: '600',
    description: 'Futuristic cyan palette',
  },
  vintage: {
    primary: '#78350f',
    accent: '#d97706',
    letterSpacing: 6,
    fontWeight: 'normal',
    description: 'Warm browns and amber',
  },
  organic: {
    primary: '#166534',
    accent: '#4ade80',
    letterSpacing: 2,
    fontWeight: 'normal',
    description: 'Natural greens, eco-friendly feel',
  },
};

/**
 * Logo type options with descriptions
 */
export const LOGO_TYPES: {
  value: LogoType;
  label: string;
  description: string;
}[] = [
  {
    value: 'wordmark',
    label: 'Wordmark',
    description: 'Text-only logo using stylized typography',
  },
  {
    value: 'lettermark',
    label: 'Lettermark',
    description: 'Initials or abbreviated letters',
  },
  {
    value: 'pictorial',
    label: 'Pictorial',
    description: 'Icon or symbol representing the brand',
  },
  {
    value: 'abstract',
    label: 'Abstract',
    description: 'Geometric or abstract shapes',
  },
  {
    value: 'mascot',
    label: 'Mascot',
    description: 'Character or illustrated figure',
  },
  {
    value: 'combination',
    label: 'Combination',
    description: 'Icon combined with text',
  },
  {
    value: 'emblem',
    label: 'Emblem',
    description: 'Text enclosed in a badge or seal',
  },
];

/**
 * Shape options for abstract/pictorial logos
 */
export const LOGO_SHAPES: {
  value: LogoShape;
  label: string;
}[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'star', label: 'Star' },
  { value: 'shield', label: 'Shield' },
];

/**
 * Theme options for quick styling
 */
export const LOGO_THEMES: {
  value: LogoTheme;
  label: string;
}[] = [
  { value: 'modern', label: 'Modern' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'bold', label: 'Bold' },
  { value: 'elegant', label: 'Elegant' },
  { value: 'playful', label: 'Playful' },
  { value: 'tech', label: 'Tech' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'organic', label: 'Organic' },
];

/**
 * Default logo configuration
 */
export const DEFAULT_LOGO_CONFIG: LogoConfig = {
  type: 'wordmark',
  text: 'BRAND',
  shape: 'circle',
  width: 400,
  height: 200,
  colors: {
    primary: '#0f172a',
    accent: '#3b82f6',
  },
  typography: {
    fontSize: 48,
    letterSpacing: 4,
    fontWeight: 'bold',
    fontFamily: 'Arial, sans-serif',
  },
};

/**
 * Suggested prompts for user inspiration
 */
export const SUGGESTED_PROMPTS = [
  'Create a modern tech logo with geometric shapes',
  'Make a playful mascot for a kids brand',
  'Design an elegant wordmark with thin typography',
  'Generate a bold abstract logo with bright colors',
  'Create a vintage emblem with a shield shape',
];

/**
 * Feedback suggestions for iterating on logos
 */
export const FEEDBACK_SUGGESTIONS = [
  'Make it more minimal',
  'Use bolder colors',
  'Add more detail',
  'Try a different layout',
  'Make the text larger',
  'Simplify the shape',
];
