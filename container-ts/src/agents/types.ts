/**
 * Agent Configuration Types
 *
 * Type definitions for subagent configurations used by the Agent SDK.
 */

/**
 * Agent configuration for subagent definitions.
 * Maps to the Agent SDK's agents option structure.
 */
export interface AgentConfig {
  /**
   * Unique identifier for the agent.
   */
  name: string;

  /**
   * Description of the agent's purpose and when to use it.
   * The main agent uses this to decide when to spawn this subagent.
   */
  description: string;

  /**
   * System prompt that defines the agent's behavior and expertise.
   */
  prompt: string;

  /**
   * Tools the agent can use.
   * Can include built-in tools (Read, Grep, etc.) and MCP tools.
   */
  tools: string[];

  /**
   * Model to use for this agent.
   * Options: "sonnet", "haiku", "opus"
   */
  model: "sonnet" | "haiku" | "opus";
}

/**
 * Criterion score from a judge evaluation.
 */
export interface CriterionScore {
  score: number;
  maxScore: number;
  reasoning: string;
  issues: string[];
  suggestions: string[];
}

/**
 * Result from a single judge evaluation.
 */
export interface SingleJudgeEvaluation {
  judgeType: string;
  passed: boolean;
  score: number;
  criteria: Record<string, CriterionScore>;
  reasoning: string;
  criticalIssues: string[];
  suggestions: string[];
  evaluatedAt: string;
}

/**
 * Aggregated results from all judges.
 */
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
 * Input for judge evaluations.
 */
export interface JudgeEvaluationInput {
  svg: string;
  brandInfo: {
    brandName: string;
    industry: string;
    targetAudience: string;
    brandPersonality?: string[];
    stylePreferences?: string[];
    colorPreferences?: string[];
  };
  conceptInfo?: {
    description?: string;
    rationale?: string;
    styleAttributes?: {
      type?: string;
      shapes?: string[];
      colors?: string[];
      mood?: string;
    };
  };
  config?: {
    type?: string;
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
  previousFeedback?: string[];
  iterationNumber?: number;
}
