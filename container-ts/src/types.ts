import { z } from "zod";

// Logo configuration schemas
export const LogoTypeSchema = z.enum([
  "wordmark",
  "lettermark",
  "abstract",
  "pictorial",
  "mascot",
  "combination",
  "emblem",
]);

export const LogoShapeSchema = z.enum([
  "circle",
  "hexagon",
  "triangle",
  "diamond",
  "star",
  "shield",
  "square",
  "pill",
  "custom",
]);

export const LogoThemeSchema = z.enum([
  "modern",
  "minimal",
  "bold",
  "elegant",
  "playful",
  "tech",
  "vintage",
  "organic",
]);

export const ColorsSchema = z.object({
  primary: z.string().default("#0f172a"),
  accent: z.string().default("#3b82f6"),
  background: z.string().optional(),
});

export const TypographySchema = z.object({
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().default(48),
  fontWeight: z.union([z.string(), z.number()]).default("bold"),
  letterSpacing: z.number().default(2),
});

export const LogoConfigSchema = z.object({
  type: LogoTypeSchema.default("wordmark"),
  text: z.string().default("BRAND"),
  tagline: z.string().optional(),
  shape: LogoShapeSchema.default("circle"),
  theme: LogoThemeSchema.default("modern"),
  colors: ColorsSchema.default({}),
  typography: TypographySchema.default({}),
  width: z.number().default(400),
  height: z.number().default(200),
});

export type LogoType = z.infer<typeof LogoTypeSchema>;
export type LogoShape = z.infer<typeof LogoShapeSchema>;
export type LogoTheme = z.infer<typeof LogoThemeSchema>;
export type Colors = z.infer<typeof ColorsSchema>;
export type Typography = z.infer<typeof TypographySchema>;
export type LogoConfig = z.infer<typeof LogoConfigSchema>;

// API request/response types
export const GenerateRequestSchema = z.object({
  prompt: z.string().describe("Natural language description of the logo"),
  config: LogoConfigSchema.optional(),
  feedback: z.string().optional().describe("Feedback on previous iteration"),
  maxIterations: z.number().default(5).describe("Maximum agent iterations"),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export interface GenerateResponse {
  svg: string;
  iterations: number;
  reasoning: string;
  version: number;
}

export interface AgentMessage {
  type: "thinking" | "tool_call" | "tool_result" | "text" | "error";
  content: string;
  toolName?: string;
  timestamp: number;
}

// Phase tracking for multi-phase generation
export type GenerationPhase =
  | "research"
  | "concepting"
  | "generation"
  | "evaluation"
  | "refinement"
  | "complete";

export interface PhaseUpdate {
  phase: GenerationPhase;
  progress: number; // 0-100
  message: string;
}
