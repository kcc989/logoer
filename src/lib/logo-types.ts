/**
 * Logo Configuration Types
 *
 * These types define the configuration options for logo generation.
 */

export type LogoType =
  | 'wordmark'
  | 'lettermark'
  | 'pictorial'
  | 'abstract'
  | 'mascot'
  | 'combination'
  | 'emblem';

export type LogoShape =
  | 'circle'
  | 'hexagon'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'shield';

export type LogoTheme =
  | 'modern'
  | 'minimal'
  | 'bold'
  | 'elegant'
  | 'playful'
  | 'tech'
  | 'vintage'
  | 'organic';

export interface ColorConfig {
  primary: string;
  accent: string;
}

export interface TypographyConfig {
  fontSize: number;
  letterSpacing: number;
  fontWeight: string;
  fontFamily: string;
}

export interface LogoConfig {
  type: LogoType;
  text: string;
  shape: LogoShape;
  theme?: LogoTheme;
  width: number;
  height: number;
  colors: ColorConfig;
  typography: TypographyConfig;
}

export interface GenerateLogoRequest {
  description?: string;
  config: Partial<LogoConfig>;
  referenceImages?: string[];
  previousFeedback?: string;
}

export interface GenerateLogoResponse {
  svg: string;
  iterations: number;
  reasoning?: string;
}

export interface LogoVersion {
  id: string;
  svg: string;
  config: LogoConfig;
  feedback?: string;
  reasoning?: string;
  iterations: number;
  createdAt: Date;
}

export interface SavedLogo {
  id: string;
  userId: string;
  name: string;
  description?: string;
  currentVersion: LogoVersion;
  versions: LogoVersion[];
  createdAt: Date;
  updatedAt: Date;
}
