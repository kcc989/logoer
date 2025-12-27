/**
 * Judge Types and Evaluation Criteria
 *
 * This module defines types and constants for the AI judge evaluators
 * that assess logos at each phase of generation.
 */

import type { BrandDiscoveryData, ConceptStyleAttributes } from '../agent/types';

/**
 * Types of judges in the evaluation pipeline
 */
export type JudgeType =
  | 'concept_fidelity'    // How well SVG matches concept/brand
  | 'technical_quality'   // SVG structure, validity, optimization
  | 'scalability'         // Appearance at different sizes
  | 'production_readiness'; // Export compatibility, fonts, colors

/**
 * Input provided to all judges for evaluation
 */
export interface JudgeInput {
  /** The SVG string to evaluate */
  svg: string;

  /** Original brand discovery data */
  brandInfo: BrandDiscoveryData;

  /** Selected concept data if in refinement phase */
  conceptDescription?: string;
  conceptRationale?: string;
  styleAttributes?: ConceptStyleAttributes;

  /** Configuration used to generate the SVG */
  config?: {
    type: string;
    text?: string;
    tagline?: string;
    shape?: string;
    theme?: string;
    colors?: {
      primary: string;
      accent: string;
      background?: string;
    };
    typography?: {
      fontFamily: string;
      fontSize: number;
      fontWeight: string | number;
      letterSpacing: number;
    };
    width: number;
    height: number;
  };

  /** Previous iteration feedback to check if addressed */
  previousFeedback?: string[];

  /** Current iteration number */
  iterationNumber: number;
}

/**
 * Individual criterion score with detailed feedback
 */
export interface CriterionScore {
  /** Score from 0-10 */
  score: number;

  /** Maximum possible score (usually 10) */
  maxScore: number;

  /** Brief explanation for this score */
  reasoning: string;

  /** Specific issues found */
  issues: string[];

  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Concept Fidelity evaluation criteria
 */
export interface ConceptFidelityCriteria {
  /** Does the logo match the brand personality? */
  brandAlignment: CriterionScore;

  /** Are the specified colors used correctly? */
  colorAccuracy: CriterionScore;

  /** Does typography match brand style? */
  typographyMatch: CriterionScore;

  /** Does shape/style match the concept? */
  styleConsistency: CriterionScore;

  /** Is the concept's design rationale reflected? */
  rationaleAlignment: CriterionScore;
}

/**
 * Technical Quality evaluation criteria
 */
export interface TechnicalQualityCriteria {
  /** Is the SVG well-formed and valid? */
  validity: CriterionScore;

  /** Is the structure clean and optimized? */
  optimization: CriterionScore;

  /** Does it use appropriate elements for the design? */
  elementUsage: CriterionScore;

  /** Are there accessibility considerations (contrast, etc)? */
  accessibility: CriterionScore;

  /** Is the viewBox and sizing correct? */
  dimensionAccuracy: CriterionScore;
}

/**
 * Scalability evaluation criteria
 */
export interface ScalabilityCriteria {
  /** Is text readable at 16px height? */
  smallSizeReadability: CriterionScore;

  /** Does it look good at 256px? */
  mediumSizeAppearance: CriterionScore;

  /** Are details preserved at large sizes? */
  largeSizeQuality: CriterionScore;

  /** Are stroke widths proportional? */
  strokeScaling: CriterionScore;

  /** Is the aspect ratio appropriate? */
  aspectRatioBalance: CriterionScore;
}

/**
 * Production Readiness evaluation criteria
 */
export interface ProductionReadinessCriteria {
  /** Can it export cleanly to PNG? */
  rasterExportability: CriterionScore;

  /** Are fonts web-safe or embedded? */
  fontAvailability: CriterionScore;

  /** Are colors in standard format (hex, rgb)? */
  colorFormat: CriterionScore;

  /** Are there external dependencies? */
  selfContainment: CriterionScore;

  /** Is file size reasonable (<50KB)? */
  fileSize: CriterionScore;
}

/**
 * Combined criteria for different judge types
 */
export type JudgeCriteria =
  | ConceptFidelityCriteria
  | TechnicalQualityCriteria
  | ScalabilityCriteria
  | ProductionReadinessCriteria;

/**
 * Result from a single judge evaluation
 */
export interface SingleJudgeEvaluation {
  /** Judge type that performed evaluation */
  judgeType: JudgeType;

  /** Whether this judge passed the logo */
  passed: boolean;

  /** Overall score for this judge (0-10) */
  score: number;

  /** Detailed criteria scores */
  criteria: JudgeCriteria;

  /** Key reasoning for the evaluation */
  reasoning: string;

  /** Critical issues that must be fixed */
  criticalIssues: string[];

  /** Suggestions for improvement */
  suggestions: string[];

  /** Evaluation timestamp */
  evaluatedAt: string;
}

/**
 * Aggregated evaluation from all judges
 */
export interface AggregatedEvaluation {
  /** Did all judges pass? */
  passed: boolean;

  /** Weighted overall score (0-10) */
  overallScore: number;

  /** Individual judge results */
  judgeResults: SingleJudgeEvaluation[];

  /** Combined critical issues from all judges */
  criticalIssues: string[];

  /** Prioritized suggestions (most impactful first) */
  prioritizedSuggestions: string[];

  /** Summary reasoning for the aggregate decision */
  summary: string;

  /** Which judges failed, if any */
  failedJudges: JudgeType[];

  /** Aggregation timestamp */
  aggregatedAt: string;
}

// ============================================================================
// Scoring Constants and Thresholds
// ============================================================================

/**
 * Minimum score required to pass for each judge type
 */
export const JUDGE_PASS_THRESHOLDS: Record<JudgeType, number> = {
  concept_fidelity: 7.0,    // Must align well with brand
  technical_quality: 8.0,   // Must be valid and well-structured
  scalability: 6.0,         // Some flexibility for artistic choices
  production_readiness: 7.5, // Must be production-ready
};

/**
 * Weight of each judge in the overall score calculation
 * Weights sum to 1.0
 */
export const JUDGE_WEIGHTS: Record<JudgeType, number> = {
  concept_fidelity: 0.35,    // Most important - must match brand
  technical_quality: 0.25,   // Must work correctly
  scalability: 0.15,         // Important but some flexibility
  production_readiness: 0.25, // Must be usable in production
};

/**
 * Minimum overall score required to pass
 */
export const OVERALL_PASS_THRESHOLD = 7.0;

/**
 * Maximum allowed critical issues before automatic failure
 */
export const MAX_CRITICAL_ISSUES = 0;

/**
 * Score descriptions for human readability
 */
export const SCORE_DESCRIPTIONS: Record<number, string> = {
  10: 'Exceptional - Exceeds all requirements',
  9: 'Excellent - Meets all requirements with distinction',
  8: 'Very Good - Meets all requirements',
  7: 'Good - Meets most requirements',
  6: 'Acceptable - Meets minimum requirements',
  5: 'Below Average - Missing some requirements',
  4: 'Poor - Missing multiple requirements',
  3: 'Very Poor - Major issues',
  2: 'Failing - Fundamental problems',
  1: 'Critical Failure - Unusable',
  0: 'Not Evaluated / Error',
};

// ============================================================================
// Evaluation Prompt Templates
// ============================================================================

/**
 * System prompt template for judge evaluations
 */
export const JUDGE_SYSTEM_PROMPT = `You are an expert logo design evaluator. Your role is to critically assess logos against specific criteria and provide actionable feedback.

Be rigorous but fair. Consider:
- Industry standards for logo design
- The specific brand requirements provided
- Technical best practices for SVG
- Real-world usability at various sizes

Provide specific, actionable feedback. Avoid vague criticism.
Always explain WHY something is an issue and HOW to fix it.`;

/**
 * Prompt template for concept fidelity evaluation
 */
export const CONCEPT_FIDELITY_PROMPT = `Evaluate this logo SVG for concept fidelity.

## Brand Information
Brand Name: {{brandName}}
Industry: {{industry}}
Target Audience: {{targetAudience}}
Brand Personality: {{brandPersonality}}
Style Preferences: {{stylePreferences}}
Color Preferences: {{colorPreferences}}

## Concept Details
Description: {{conceptDescription}}
Design Rationale: {{conceptRationale}}
Style Attributes: {{styleAttributes}}

## SVG to Evaluate
\`\`\`svg
{{svg}}
\`\`\`

Evaluate against these criteria (score each 0-10):
1. **Brand Alignment**: Does it communicate the brand personality?
2. **Color Accuracy**: Are the specified colors used correctly and harmoniously?
3. **Typography Match**: Does the typography reflect the brand style?
4. **Style Consistency**: Does the visual style match the concept?
5. **Rationale Alignment**: Is the concept's design rationale reflected?

Respond with a JSON object containing your evaluation.`;

/**
 * Prompt template for technical quality evaluation
 */
export const TECHNICAL_QUALITY_PROMPT = `Evaluate this logo SVG for technical quality.

## SVG to Evaluate
\`\`\`svg
{{svg}}
\`\`\`

## Expected Configuration
Type: {{type}}
Dimensions: {{width}}x{{height}}
Primary Color: {{primaryColor}}
Accent Color: {{accentColor}}

Evaluate against these criteria (score each 0-10):
1. **Validity**: Is the SVG well-formed with proper namespace and structure?
2. **Optimization**: Is the code clean, minimal, and well-organized?
3. **Element Usage**: Are appropriate SVG elements used (text for text, paths for shapes)?
4. **Accessibility**: Does it have good contrast? Could it work with a11y tools?
5. **Dimension Accuracy**: Is the viewBox correct? Are elements properly positioned?

Check for common issues:
- Missing xmlns attribute
- Improper nesting
- Unused elements or attributes
- Hardcoded styles that should be attributes
- Missing viewBox

Respond with a JSON object containing your evaluation.`;

/**
 * Prompt template for scalability evaluation
 */
export const SCALABILITY_PROMPT = `Evaluate this logo SVG for scalability across different sizes.

## SVG to Evaluate
\`\`\`svg
{{svg}}
\`\`\`

## Logo Type
{{type}} logo with text: "{{text}}"

Evaluate how this logo would appear at different sizes (score each 0-10):
1. **Small Size Readability** (16-32px height): Would text be readable? Would details be visible?
2. **Medium Size Appearance** (64-256px): Does it look balanced and professional?
3. **Large Size Quality** (512px+): Are there any artifacts? Do details hold up?
4. **Stroke Scaling**: Are stroke widths appropriate? Would thin strokes disappear at small sizes?
5. **Aspect Ratio Balance**: Is the aspect ratio appropriate for various use cases?

Consider:
- Minimum readable font sizes
- Line weight consistency
- Detail complexity vs size
- Whitespace at different scales

Respond with a JSON object containing your evaluation.`;

/**
 * Prompt template for production readiness evaluation
 */
export const PRODUCTION_READINESS_PROMPT = `Evaluate this logo SVG for production readiness.

## SVG to Evaluate
\`\`\`svg
{{svg}}
\`\`\`

## Expected Usage
This logo will be used for:
- Web (favicon, header logo, social media)
- Print (business cards, letterhead)
- Digital products (app icons, loading screens)

Evaluate against these criteria (score each 0-10):
1. **Raster Exportability**: Can it cleanly export to PNG at various resolutions?
2. **Font Availability**: Are fonts web-safe or properly embedded? Or using <path> for text?
3. **Color Format**: Are colors in standard formats (hex, rgb, hsl)?
4. **Self-Containment**: Are there any external dependencies (fonts, images, scripts)?
5. **File Size**: Is the SVG reasonably sized (aim for <50KB, flag if >100KB)?

Check for:
- External font references
- Linked images or resources
- Inline JavaScript
- Complex gradients that might not export cleanly
- Unusual color formats

Respond with a JSON object containing your evaluation.`;

// ============================================================================
// Helper Types for Judge Implementation
// ============================================================================

/**
 * Options for running a judge
 */
export interface JudgeOptions {
  /** Maximum tokens for the evaluation response */
  maxTokens?: number;

  /** Temperature for the evaluation (lower = more consistent) */
  temperature?: number;

  /** Whether to include detailed reasoning */
  verbose?: boolean;
}

/**
 * Default options for judge evaluations
 */
export const DEFAULT_JUDGE_OPTIONS: Required<JudgeOptions> = {
  maxTokens: 2048,
  temperature: 0.2, // Low temperature for consistent evaluations
  verbose: true,
};

/**
 * Response schema for concept fidelity judge
 */
export const ConceptFidelityResponseSchema = {
  type: 'object' as const,
  properties: {
    brandAlignment: {
      type: 'object' as const,
      properties: {
        score: { type: 'number' as const },
        reasoning: { type: 'string' as const },
        issues: { type: 'array' as const, items: { type: 'string' as const } },
        suggestions: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['score', 'reasoning', 'issues', 'suggestions'],
    },
    colorAccuracy: {
      type: 'object' as const,
      properties: {
        score: { type: 'number' as const },
        reasoning: { type: 'string' as const },
        issues: { type: 'array' as const, items: { type: 'string' as const } },
        suggestions: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['score', 'reasoning', 'issues', 'suggestions'],
    },
    typographyMatch: {
      type: 'object' as const,
      properties: {
        score: { type: 'number' as const },
        reasoning: { type: 'string' as const },
        issues: { type: 'array' as const, items: { type: 'string' as const } },
        suggestions: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['score', 'reasoning', 'issues', 'suggestions'],
    },
    styleConsistency: {
      type: 'object' as const,
      properties: {
        score: { type: 'number' as const },
        reasoning: { type: 'string' as const },
        issues: { type: 'array' as const, items: { type: 'string' as const } },
        suggestions: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['score', 'reasoning', 'issues', 'suggestions'],
    },
    rationaleAlignment: {
      type: 'object' as const,
      properties: {
        score: { type: 'number' as const },
        reasoning: { type: 'string' as const },
        issues: { type: 'array' as const, items: { type: 'string' as const } },
        suggestions: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['score', 'reasoning', 'issues', 'suggestions'],
    },
    overallReasoning: { type: 'string' as const },
    criticalIssues: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: [
    'brandAlignment',
    'colorAccuracy',
    'typographyMatch',
    'styleConsistency',
    'rationaleAlignment',
    'overallReasoning',
    'criticalIssues',
  ],
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate overall score from criteria scores
 */
export function calculateOverallScore(criteria: JudgeCriteria): number {
  const scores = Object.values(criteria).map(c => c.score);
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

/**
 * Determine if evaluation passed based on score and issues
 */
export function didPass(
  score: number,
  criticalIssues: string[],
  judgeType: JudgeType
): boolean {
  if (criticalIssues.length > MAX_CRITICAL_ISSUES) {
    return false;
  }
  return score >= JUDGE_PASS_THRESHOLDS[judgeType];
}

/**
 * Get score description for display
 */
export function getScoreDescription(score: number): string {
  const rounded = Math.round(score);
  return SCORE_DESCRIPTIONS[rounded] || SCORE_DESCRIPTIONS[0];
}

/**
 * Create a default criterion score (for error cases)
 */
export function createDefaultCriterionScore(): CriterionScore {
  return {
    score: 0,
    maxScore: 10,
    reasoning: 'Not evaluated',
    issues: [],
    suggestions: [],
  };
}

/**
 * Aggregate multiple judge evaluations into a final result
 */
export function aggregateEvaluations(
  evaluations: SingleJudgeEvaluation[]
): AggregatedEvaluation {
  // Calculate weighted overall score
  let weightedSum = 0;
  let totalWeight = 0;

  for (const evaluation of evaluations) {
    const weight = JUDGE_WEIGHTS[evaluation.judgeType];
    weightedSum += evaluation.score * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 10) / 10
    : 0;

  // Collect all critical issues
  const criticalIssues = evaluations.flatMap(e => e.criticalIssues);

  // Collect and dedupe suggestions, prioritize by score impact
  const allSuggestions = evaluations.flatMap(e =>
    e.suggestions.map(s => ({ suggestion: s, score: e.score, judgeType: e.judgeType }))
  );

  // Sort by lowest scoring judges first (most impactful improvements)
  allSuggestions.sort((a, b) => a.score - b.score);

  const prioritizedSuggestions = [...new Set(allSuggestions.map(s => s.suggestion))];

  // Determine which judges failed
  const failedJudges = evaluations
    .filter(e => !e.passed)
    .map(e => e.judgeType);

  // Overall pass only if all judges pass and no critical issues
  const passed = failedJudges.length === 0 &&
    criticalIssues.length === 0 &&
    overallScore >= OVERALL_PASS_THRESHOLD;

  // Generate summary
  let summary: string;
  if (passed) {
    summary = `Logo passed all evaluations with an overall score of ${overallScore}/10. ${getScoreDescription(overallScore)}.`;
  } else if (failedJudges.length > 0) {
    summary = `Logo failed ${failedJudges.length} judge(s): ${failedJudges.join(', ')}. Overall score: ${overallScore}/10.`;
  } else {
    summary = `Logo has ${criticalIssues.length} critical issue(s) that must be addressed. Overall score: ${overallScore}/10.`;
  }

  return {
    passed,
    overallScore,
    judgeResults: evaluations,
    criticalIssues,
    prioritizedSuggestions: prioritizedSuggestions.slice(0, 10), // Top 10 suggestions
    summary,
    failedJudges,
    aggregatedAt: new Date().toISOString(),
  };
}
