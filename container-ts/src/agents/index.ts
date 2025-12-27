/**
 * Logo Evaluation Judge Subagents
 *
 * Exports all judge subagent configurations for use with the Agent SDK.
 * Each judge evaluates specific criteria and can run in parallel.
 *
 * Usage:
 * ```typescript
 * import { judgeAgents, OVERALL_PASS_THRESHOLD } from "./agents";
 *
 * const response = query({
 *   prompt: "Evaluate this logo...",
 *   options: {
 *     agents: judgeAgents,
 *     // ... other options
 *   }
 * });
 * ```
 */

// Export individual judges
export {
  conceptFidelityJudge,
  CONCEPT_FIDELITY_WEIGHT,
  CONCEPT_FIDELITY_THRESHOLD,
} from "./concept-fidelity-judge.js";

export {
  technicalQualityJudge,
  TECHNICAL_QUALITY_WEIGHT,
  TECHNICAL_QUALITY_THRESHOLD,
} from "./technical-quality-judge.js";

export {
  scalabilityJudge,
  SCALABILITY_WEIGHT,
  SCALABILITY_THRESHOLD,
} from "./scalability-judge.js";

export {
  productionReadinessJudge,
  PRODUCTION_READINESS_WEIGHT,
  PRODUCTION_READINESS_THRESHOLD,
} from "./production-readiness-judge.js";

// Export types
export type {
  AgentConfig,
  CriterionScore,
  SingleJudgeEvaluation,
  AggregatedEvaluation,
  JudgeEvaluationInput,
} from "./types.js";

// Re-import for combined exports
import { conceptFidelityJudge, CONCEPT_FIDELITY_WEIGHT } from "./concept-fidelity-judge.js";
import { technicalQualityJudge, TECHNICAL_QUALITY_WEIGHT } from "./technical-quality-judge.js";
import { scalabilityJudge, SCALABILITY_WEIGHT } from "./scalability-judge.js";
import { productionReadinessJudge, PRODUCTION_READINESS_WEIGHT } from "./production-readiness-judge.js";
import type { AgentConfig } from "./types.js";

/**
 * All judge agents combined for the Agent SDK's agents option.
 * Format: { [agentName]: AgentConfig }
 */
export const judgeAgents: Record<string, Omit<AgentConfig, "name">> = {
  [conceptFidelityJudge.name]: {
    description: conceptFidelityJudge.description,
    prompt: conceptFidelityJudge.prompt,
    tools: conceptFidelityJudge.tools,
    model: conceptFidelityJudge.model,
  },
  [technicalQualityJudge.name]: {
    description: technicalQualityJudge.description,
    prompt: technicalQualityJudge.prompt,
    tools: technicalQualityJudge.tools,
    model: technicalQualityJudge.model,
  },
  [scalabilityJudge.name]: {
    description: scalabilityJudge.description,
    prompt: scalabilityJudge.prompt,
    tools: scalabilityJudge.tools,
    model: scalabilityJudge.model,
  },
  [productionReadinessJudge.name]: {
    description: productionReadinessJudge.description,
    prompt: productionReadinessJudge.prompt,
    tools: productionReadinessJudge.tools,
    model: productionReadinessJudge.model,
  },
};

/**
 * Judge weights for calculating overall score.
 */
export const JUDGE_WEIGHTS: Record<string, number> = {
  concept_fidelity: CONCEPT_FIDELITY_WEIGHT,
  technical_quality: TECHNICAL_QUALITY_WEIGHT,
  scalability: SCALABILITY_WEIGHT,
  production_readiness: PRODUCTION_READINESS_WEIGHT,
};

/**
 * Overall pass threshold for aggregated evaluation.
 */
export const OVERALL_PASS_THRESHOLD = 7.0;

/**
 * List of all judge agent names.
 */
export const JUDGE_AGENT_NAMES = [
  conceptFidelityJudge.name,
  technicalQualityJudge.name,
  scalabilityJudge.name,
  productionReadinessJudge.name,
] as const;
