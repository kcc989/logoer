/**
 * Judge Evaluator Functions (Direct API)
 *
 * Pure functions for logo evaluation using direct Anthropic API calls.
 * These serve as a fallback/testing alternative to the subagent-based
 * evaluation in src/agents/.
 *
 * Primary workflow uses subagents (src/agents/*-judge.ts) spawned via
 * the Agent SDK's Task tool for parallel evaluation.
 *
 * These functions can be used for:
 * - Testing evaluation logic without the full Agent SDK
 * - Direct API calls when subagents aren't available
 * - Programmatic evaluation from other services
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

/**
 * Criterion score from evaluation
 */
interface CriterionScore {
  score: number;
  maxScore: number;
  reasoning: string;
  issues: string[];
  suggestions: string[];
}

/**
 * Single judge evaluation result
 */
interface SingleJudgeEvaluation {
  judgeType: string;
  passed: boolean;
  score: number;
  criteria: Record<string, CriterionScore>;
  reasoning: string;
  criticalIssues: string[];
  suggestions: string[];
  evaluatedAt: string;
}

// ============================================================================
// Zod Schemas for Tool Input Validation
// ============================================================================

export const BrandInfoSchema = z.object({
  brandName: z.string(),
  industry: z.string(),
  targetAudience: z.string(),
  brandPersonality: z.array(z.string()).optional(),
  stylePreferences: z.array(z.string()).optional(),
  colorPreferences: z.array(z.string()).optional(),
});

export const ConceptInfoSchema = z.object({
  description: z.string().optional(),
  rationale: z.string().optional(),
  styleAttributes: z
    .object({
      type: z.string().optional(),
      shapes: z.array(z.string()).optional(),
      colors: z.array(z.string()).optional(),
      mood: z.string().optional(),
    })
    .optional(),
});

export const ConfigSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
  tagline: z.string().optional(),
  shape: z.string().optional(),
  theme: z.string().optional(),
  colors: z
    .object({
      primary: z.string(),
      accent: z.string(),
      background: z.string().optional(),
    })
    .optional(),
  typography: z
    .object({
      fontFamily: z.string(),
      fontSize: z.number(),
      fontWeight: z.union([z.string(), z.number()]),
      letterSpacing: z.number(),
    })
    .optional(),
  width: z.number(),
  height: z.number(),
});

export const JudgeInputSchema = z.object({
  svg: z.string().describe("The SVG string to evaluate"),
  brandInfo: BrandInfoSchema.describe("Brand discovery information"),
  conceptInfo: ConceptInfoSchema.optional().describe("Selected concept details"),
  config: ConfigSchema.optional().describe("Logo configuration"),
  previousFeedback: z.array(z.string()).optional().describe("Previous iteration feedback"),
  iterationNumber: z.number().default(1).describe("Current iteration number"),
});

export type JudgeInput = z.infer<typeof JudgeInputSchema>;

// ============================================================================
// Thresholds
// ============================================================================

const PASS_THRESHOLDS = {
  concept_fidelity: 7.0,
  technical_quality: 8.0,
  scalability: 6.0,
  production_readiness: 7.5,
};

// ============================================================================
// Anthropic Client
// ============================================================================

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }
  return new Anthropic({ apiKey });
}

// ============================================================================
// Helper Functions
// ============================================================================

function createDefaultCriterionScore(): CriterionScore {
  return {
    score: 0,
    maxScore: 10,
    reasoning: "Not evaluated",
    issues: [],
    suggestions: [],
  };
}

function calculateOverallScore(criteria: Record<string, CriterionScore>): number {
  const scores = Object.values(criteria).map((c) => c.score);
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

function parseCriterionFromResponse(
  data: Record<string, unknown>,
  key: string
): CriterionScore {
  const criterion = data[key] as Record<string, unknown> | undefined;
  if (!criterion) return createDefaultCriterionScore();

  return {
    score: typeof criterion.score === "number" ? criterion.score : 0,
    maxScore: 10,
    reasoning: typeof criterion.reasoning === "string" ? criterion.reasoning : "",
    issues: Array.isArray(criterion.issues) ? criterion.issues : [],
    suggestions: Array.isArray(criterion.suggestions) ? criterion.suggestions : [],
  };
}

// ============================================================================
// Concept Fidelity Judge
// ============================================================================

const CONCEPT_FIDELITY_SYSTEM_PROMPT = `You are an expert logo design evaluator specializing in brand alignment and concept fidelity.
Your role is to assess how well a logo SVG matches the intended brand identity and concept.

Be rigorous but fair. Consider:
- How well the visual elements communicate the brand personality
- Whether colors, typography, and style match the concept
- If the design rationale is reflected in the final output

Provide specific, actionable feedback. Avoid vague criticism.
Always explain WHY something is an issue and HOW to fix it.

Respond with valid JSON only.`;

export async function evaluateConceptFidelity(
  input: JudgeInput
): Promise<SingleJudgeEvaluation> {
  const client = getAnthropicClient();

  const prompt = `Evaluate this logo SVG for concept fidelity.

## Brand Information
Brand Name: ${input.brandInfo.brandName}
Industry: ${input.brandInfo.industry}
Target Audience: ${input.brandInfo.targetAudience}
Brand Personality: ${input.brandInfo.brandPersonality?.join(", ") || "Not specified"}
Style Preferences: ${input.brandInfo.stylePreferences?.join(", ") || "Not specified"}
Color Preferences: ${input.brandInfo.colorPreferences?.join(", ") || "Not specified"}

## Concept Details
Description: ${input.conceptInfo?.description || "Not specified"}
Design Rationale: ${input.conceptInfo?.rationale || "Not specified"}
Style Type: ${input.conceptInfo?.styleAttributes?.type || "Not specified"}
Mood: ${input.conceptInfo?.styleAttributes?.mood || "Not specified"}

## Configuration
Logo Type: ${input.config?.type || "Not specified"}
Text: ${input.config?.text || "Not specified"}
Primary Color: ${input.config?.colors?.primary || "Not specified"}
Accent Color: ${input.config?.colors?.accent || "Not specified"}

## SVG to Evaluate
\`\`\`svg
${input.svg}
\`\`\`

Evaluate against these criteria (score each 0-10):
1. **brandAlignment**: Does it communicate the brand personality effectively?
2. **colorAccuracy**: Are the specified colors used correctly and harmoniously?
3. **typographyMatch**: Does the typography reflect the brand style?
4. **styleConsistency**: Does the visual style match the concept?
5. **rationaleAlignment**: Is the concept's design rationale reflected?

Respond with a JSON object in this exact format:
{
  "brandAlignment": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "colorAccuracy": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "typographyMatch": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "styleConsistency": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "rationaleAlignment": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "overallReasoning": "Overall assessment summary",
  "criticalIssues": ["Any issues that must be fixed before approval"]
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      temperature: 0.2,
      system: CONCEPT_FIDELITY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    // Extract text content
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from evaluation");
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from response");
    }

    const data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const criteria: Record<string, CriterionScore> = {
      brandAlignment: parseCriterionFromResponse(data, "brandAlignment"),
      colorAccuracy: parseCriterionFromResponse(data, "colorAccuracy"),
      typographyMatch: parseCriterionFromResponse(data, "typographyMatch"),
      styleConsistency: parseCriterionFromResponse(data, "styleConsistency"),
      rationaleAlignment: parseCriterionFromResponse(data, "rationaleAlignment"),
    };

    const overallScore = calculateOverallScore(criteria);
    const criticalIssues = Array.isArray(data.criticalIssues)
      ? (data.criticalIssues as string[])
      : [];
    const allSuggestions = Object.values(criteria).flatMap((c) => c.suggestions);

    return {
      judgeType: "concept_fidelity",
      passed:
        overallScore >= PASS_THRESHOLDS.concept_fidelity &&
        criticalIssues.length === 0,
      score: overallScore,
      criteria,
      reasoning:
        typeof data.overallReasoning === "string"
          ? data.overallReasoning
          : "Evaluation complete",
      criticalIssues,
      suggestions: [...new Set(allSuggestions)],
      evaluatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Concept fidelity evaluation error:", error);
    return {
      judgeType: "concept_fidelity",
      passed: false,
      score: 0,
      criteria: {
        brandAlignment: createDefaultCriterionScore(),
        colorAccuracy: createDefaultCriterionScore(),
        typographyMatch: createDefaultCriterionScore(),
        styleConsistency: createDefaultCriterionScore(),
        rationaleAlignment: createDefaultCriterionScore(),
      },
      reasoning: `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      criticalIssues: ["Evaluation could not be completed"],
      suggestions: [],
      evaluatedAt: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Technical Quality Judge
// ============================================================================

const TECHNICAL_QUALITY_SYSTEM_PROMPT = `You are an expert SVG technical evaluator.
Your role is to assess the technical quality, validity, and optimization of SVG logos.

Be rigorous about technical standards. Check for:
- Proper SVG structure and namespace
- Efficient use of elements and attributes
- Accessibility considerations
- Correct dimensions and viewBox

Provide specific technical feedback with exact fixes.
Respond with valid JSON only.`;

export async function evaluateTechnicalQuality(
  input: JudgeInput
): Promise<SingleJudgeEvaluation> {
  const client = getAnthropicClient();

  const prompt = `Evaluate this logo SVG for technical quality.

## SVG to Evaluate
\`\`\`svg
${input.svg}
\`\`\`

## Expected Configuration
Type: ${input.config?.type || "Not specified"}
Dimensions: ${input.config?.width || 400}x${input.config?.height || 200}
Primary Color: ${input.config?.colors?.primary || "Not specified"}
Accent Color: ${input.config?.colors?.accent || "Not specified"}
Text: ${input.config?.text || "Not specified"}

Evaluate against these criteria (score each 0-10):
1. **validity**: Is the SVG well-formed with proper xmlns, no syntax errors, properly nested?
2. **optimization**: Is the code clean, minimal, no redundant elements or attributes?
3. **elementUsage**: Are appropriate SVG elements used (text for text, path for shapes)?
4. **accessibility**: Good contrast ratio? Alt text possible? Works without color?
5. **dimensionAccuracy**: Correct viewBox? Elements properly positioned within bounds?

Check for these common issues:
- Missing xmlns="http://www.w3.org/2000/svg" attribute
- Missing or incorrect viewBox
- Improper element nesting
- Unused/redundant attributes
- Hardcoded inline styles vs attributes
- Text outside visible bounds
- Elements extending beyond viewBox

Respond with a JSON object in this exact format:
{
  "validity": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "optimization": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "elementUsage": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "accessibility": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "dimensionAccuracy": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "overallReasoning": "Technical assessment summary",
  "criticalIssues": ["Any issues that prevent the SVG from rendering correctly"]
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      temperature: 0.2,
      system: TECHNICAL_QUALITY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from evaluation");
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from response");
    }

    const data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const criteria: Record<string, CriterionScore> = {
      validity: parseCriterionFromResponse(data, "validity"),
      optimization: parseCriterionFromResponse(data, "optimization"),
      elementUsage: parseCriterionFromResponse(data, "elementUsage"),
      accessibility: parseCriterionFromResponse(data, "accessibility"),
      dimensionAccuracy: parseCriterionFromResponse(data, "dimensionAccuracy"),
    };

    const overallScore = calculateOverallScore(criteria);
    const criticalIssues = Array.isArray(data.criticalIssues)
      ? (data.criticalIssues as string[])
      : [];
    const allSuggestions = Object.values(criteria).flatMap((c) => c.suggestions);

    return {
      judgeType: "technical_quality",
      passed:
        overallScore >= PASS_THRESHOLDS.technical_quality &&
        criticalIssues.length === 0,
      score: overallScore,
      criteria,
      reasoning:
        typeof data.overallReasoning === "string"
          ? data.overallReasoning
          : "Evaluation complete",
      criticalIssues,
      suggestions: [...new Set(allSuggestions)],
      evaluatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Technical quality evaluation error:", error);
    return {
      judgeType: "technical_quality",
      passed: false,
      score: 0,
      criteria: {
        validity: createDefaultCriterionScore(),
        optimization: createDefaultCriterionScore(),
        elementUsage: createDefaultCriterionScore(),
        accessibility: createDefaultCriterionScore(),
        dimensionAccuracy: createDefaultCriterionScore(),
      },
      reasoning: `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      criticalIssues: ["Evaluation could not be completed"],
      suggestions: [],
      evaluatedAt: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Scalability Judge
// ============================================================================

const SCALABILITY_SYSTEM_PROMPT = `You are an expert logo scalability evaluator.
Your role is to assess how well a logo will appear at different sizes.

Consider practical usage scenarios:
- Favicons (16x16 to 32x32 pixels)
- Social media icons (64x64 to 256x256 pixels)
- Website headers (200-500 pixels)
- Print materials (large format)

Evaluate whether elements will be visible and readable at each size.
Respond with valid JSON only.`;

export async function evaluateScalability(
  input: JudgeInput
): Promise<SingleJudgeEvaluation> {
  const client = getAnthropicClient();

  const prompt = `Evaluate this logo SVG for scalability across different sizes.

## SVG to Evaluate
\`\`\`svg
${input.svg}
\`\`\`

## Logo Details
Type: ${input.config?.type || "Not specified"}
Text: ${input.config?.text || "Not specified"}
Dimensions: ${input.config?.width || 400}x${input.config?.height || 200}
Font Size: ${input.config?.typography?.fontSize || "Not specified"}px
Font Family: ${input.config?.typography?.fontFamily || "Not specified"}

Evaluate how this logo would appear at different sizes (score each 0-10):
1. **smallSizeReadability** (16-32px height): Would text be legible? Would details disappear?
2. **mediumSizeAppearance** (64-256px): Does it look balanced and professional?
3. **largeSizeQuality** (512px+): Do details hold up? Any pixelation issues?
4. **strokeScaling**: Are stroke widths appropriate? Will thin lines disappear at small sizes?
5. **aspectRatioBalance**: Is the aspect ratio suitable for various placements?

Consider these scenarios:
- Browser favicon (16x16)
- Mobile app icon (48x48 to 144x144)
- Social media avatar (128x128 to 512x512)
- Email signature (100px wide)
- Business card print (300 DPI)
- Billboard/large format

Respond with a JSON object in this exact format:
{
  "smallSizeReadability": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "mediumSizeAppearance": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "largeSizeQuality": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "strokeScaling": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "aspectRatioBalance": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "overallReasoning": "Scalability assessment summary",
  "criticalIssues": ["Any issues that make the logo unusable at common sizes"]
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      temperature: 0.2,
      system: SCALABILITY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from evaluation");
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from response");
    }

    const data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const criteria: Record<string, CriterionScore> = {
      smallSizeReadability: parseCriterionFromResponse(data, "smallSizeReadability"),
      mediumSizeAppearance: parseCriterionFromResponse(data, "mediumSizeAppearance"),
      largeSizeQuality: parseCriterionFromResponse(data, "largeSizeQuality"),
      strokeScaling: parseCriterionFromResponse(data, "strokeScaling"),
      aspectRatioBalance: parseCriterionFromResponse(data, "aspectRatioBalance"),
    };

    const overallScore = calculateOverallScore(criteria);
    const criticalIssues = Array.isArray(data.criticalIssues)
      ? (data.criticalIssues as string[])
      : [];
    const allSuggestions = Object.values(criteria).flatMap((c) => c.suggestions);

    return {
      judgeType: "scalability",
      passed:
        overallScore >= PASS_THRESHOLDS.scalability && criticalIssues.length === 0,
      score: overallScore,
      criteria,
      reasoning:
        typeof data.overallReasoning === "string"
          ? data.overallReasoning
          : "Evaluation complete",
      criticalIssues,
      suggestions: [...new Set(allSuggestions)],
      evaluatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Scalability evaluation error:", error);
    return {
      judgeType: "scalability",
      passed: false,
      score: 0,
      criteria: {
        smallSizeReadability: createDefaultCriterionScore(),
        mediumSizeAppearance: createDefaultCriterionScore(),
        largeSizeQuality: createDefaultCriterionScore(),
        strokeScaling: createDefaultCriterionScore(),
        aspectRatioBalance: createDefaultCriterionScore(),
      },
      reasoning: `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      criticalIssues: ["Evaluation could not be completed"],
      suggestions: [],
      evaluatedAt: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Production Readiness Judge
// ============================================================================

const PRODUCTION_READINESS_SYSTEM_PROMPT = `You are an expert production readiness evaluator for logo assets.
Your role is to assess whether a logo SVG is ready for production use.

Consider real-world deployment requirements:
- Web usage (browsers, email clients)
- Print production (CMYK conversion, resolution)
- Digital products (app stores, social platforms)
- File size and loading performance

Identify any dependencies or compatibility issues.
Respond with valid JSON only.`;

export async function evaluateProductionReadiness(
  input: JudgeInput
): Promise<SingleJudgeEvaluation> {
  const client = getAnthropicClient();

  // Calculate approximate file size
  const svgSize = new Blob([input.svg]).size;
  const svgSizeKB = (svgSize / 1024).toFixed(2);

  const prompt = `Evaluate this logo SVG for production readiness.

## SVG to Evaluate
\`\`\`svg
${input.svg}
\`\`\`

## File Information
File Size: ${svgSizeKB} KB
Dimensions: ${input.config?.width || 400}x${input.config?.height || 200}
Font Family: ${input.config?.typography?.fontFamily || "Not specified"}

## Expected Usage
This logo will be used for:
- Web (favicon, header logo, social media profiles)
- Email (signatures, newsletters)
- Print (business cards, letterhead, promotional materials)
- Digital products (app icons, loading screens)
- Brand guidelines documentation

Evaluate against these criteria (score each 0-10):
1. **rasterExportability**: Can it cleanly export to PNG/JPG at various resolutions?
2. **fontAvailability**: Are fonts web-safe, system fonts, or properly embedded as paths?
3. **colorFormat**: Are colors in standard formats (hex, rgb)? Compatible with print (no transparency issues)?
4. **selfContainment**: No external dependencies (linked fonts, images, scripts)?
5. **fileSize**: Is the SVG reasonably sized? (<50KB ideal, <100KB acceptable, flag if larger)

Check for these production issues:
- External font references (url(), @import)
- Linked or embedded base64 images
- Inline JavaScript or event handlers
- Complex filters that may not export cleanly
- Very small stroke widths that disappear in rasterization
- Unusual color formats or color profiles
- Missing or incorrect encoding declarations

Respond with a JSON object in this exact format:
{
  "rasterExportability": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "fontAvailability": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "colorFormat": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "selfContainment": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "fileSize": { "score": 0-10, "reasoning": "...", "issues": [], "suggestions": [] },
  "overallReasoning": "Production readiness assessment summary",
  "criticalIssues": ["Any issues that prevent production deployment"]
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      temperature: 0.2,
      system: PRODUCTION_READINESS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from evaluation");
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from response");
    }

    const data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const criteria: Record<string, CriterionScore> = {
      rasterExportability: parseCriterionFromResponse(data, "rasterExportability"),
      fontAvailability: parseCriterionFromResponse(data, "fontAvailability"),
      colorFormat: parseCriterionFromResponse(data, "colorFormat"),
      selfContainment: parseCriterionFromResponse(data, "selfContainment"),
      fileSize: parseCriterionFromResponse(data, "fileSize"),
    };

    const overallScore = calculateOverallScore(criteria);
    const criticalIssues = Array.isArray(data.criticalIssues)
      ? (data.criticalIssues as string[])
      : [];
    const allSuggestions = Object.values(criteria).flatMap((c) => c.suggestions);

    return {
      judgeType: "production_readiness",
      passed:
        overallScore >= PASS_THRESHOLDS.production_readiness &&
        criticalIssues.length === 0,
      score: overallScore,
      criteria,
      reasoning:
        typeof data.overallReasoning === "string"
          ? data.overallReasoning
          : "Evaluation complete",
      criticalIssues,
      suggestions: [...new Set(allSuggestions)],
      evaluatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Production readiness evaluation error:", error);
    return {
      judgeType: "production_readiness",
      passed: false,
      score: 0,
      criteria: {
        rasterExportability: createDefaultCriterionScore(),
        fontAvailability: createDefaultCriterionScore(),
        colorFormat: createDefaultCriterionScore(),
        selfContainment: createDefaultCriterionScore(),
        fileSize: createDefaultCriterionScore(),
      },
      reasoning: `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      criticalIssues: ["Evaluation could not be completed"],
      suggestions: [],
      evaluatedAt: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Aggregation
// ============================================================================

const JUDGE_WEIGHTS: Record<string, number> = {
  concept_fidelity: 0.35,
  technical_quality: 0.25,
  scalability: 0.15,
  production_readiness: 0.25,
};

const OVERALL_PASS_THRESHOLD = 7.0;

export interface AggregatedEvaluation {
  passed: boolean;
  overallScore: number;
  judgeResults: SingleJudgeEvaluation[];
  criticalIssues: string[];
  prioritizedSuggestions: string[];
  summary: string;
  failedJudges: string[];
  aggregatedAt: string;
}

/**
 * Run all judges and aggregate results
 */
export async function runAllJudges(input: JudgeInput): Promise<AggregatedEvaluation> {
  // Run all judges in parallel
  const [conceptFidelity, technicalQuality, scalability, productionReadiness] =
    await Promise.all([
      evaluateConceptFidelity(input),
      evaluateTechnicalQuality(input),
      evaluateScalability(input),
      evaluateProductionReadiness(input),
    ]);

  const evaluations = [
    conceptFidelity,
    technicalQuality,
    scalability,
    productionReadiness,
  ];

  // Calculate weighted overall score
  let weightedSum = 0;
  let totalWeight = 0;

  for (const evaluation of evaluations) {
    const weight = JUDGE_WEIGHTS[evaluation.judgeType] || 0;
    weightedSum += evaluation.score * weight;
    totalWeight += weight;
  }

  const overallScore =
    totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;

  // Collect all critical issues
  const criticalIssues = evaluations.flatMap((e) => e.criticalIssues);

  // Collect and prioritize suggestions
  const allSuggestions = evaluations.flatMap((e) =>
    e.suggestions.map((s) => ({ suggestion: s, score: e.score }))
  );
  allSuggestions.sort((a, b) => a.score - b.score);
  const prioritizedSuggestions = [
    ...new Set(allSuggestions.map((s) => s.suggestion)),
  ].slice(0, 10);

  // Determine which judges failed
  const failedJudges = evaluations.filter((e) => !e.passed).map((e) => e.judgeType);

  // Overall pass only if all judges pass and no critical issues
  const passed =
    failedJudges.length === 0 &&
    criticalIssues.length === 0 &&
    overallScore >= OVERALL_PASS_THRESHOLD;

  // Generate summary
  let summary: string;
  if (passed) {
    summary = `Logo passed all evaluations with an overall score of ${overallScore}/10.`;
  } else if (failedJudges.length > 0) {
    summary = `Logo failed ${failedJudges.length} judge(s): ${failedJudges.join(", ")}. Overall score: ${overallScore}/10.`;
  } else {
    summary = `Logo has ${criticalIssues.length} critical issue(s) that must be addressed. Overall score: ${overallScore}/10.`;
  }

  return {
    passed,
    overallScore,
    judgeResults: evaluations,
    criticalIssues,
    prioritizedSuggestions,
    summary,
    failedJudges,
    aggregatedAt: new Date().toISOString(),
  };
}
