/**
 * Logo Generation Agent
 *
 * Uses Claude Agent SDK with subagents for parallel judge evaluation.
 * Direct function calls for SVG generation (no MCP wrapper overhead).
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage, SDKAssistantMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type {
  GenerateRequest,
  GenerateResponse,
  AgentMessage,
  PhaseUpdate,
  LogoConfig,
} from "./types.js";
import { LogoConfigSchema } from "./types.js";
import { generateSvg, validateSvg, analyzeLogo } from "./tools/svg-generator.js";
import { SYSTEM_PROMPT, buildJudgeContext } from "./prompts.js";
import {
  judgeAgents,
  JUDGE_WEIGHTS,
  OVERALL_PASS_THRESHOLD,
  CONCEPT_FIDELITY_THRESHOLD,
  TECHNICAL_QUALITY_THRESHOLD,
  SCALABILITY_THRESHOLD,
  PRODUCTION_READINESS_THRESHOLD,
} from "./agents/index.js";
import type { SingleJudgeEvaluation, AggregatedEvaluation } from "./agents/index.js";

interface AgentCallbacks {
  onMessage?: (message: AgentMessage) => void;
  onPhase?: (phase: PhaseUpdate) => void;
  onProgress?: (svg: string, iteration: number) => void;
}

// Type guards for SDK messages
function isAssistantMessage(message: SDKMessage): message is SDKAssistantMessage {
  return message.type === "assistant";
}

function isResultMessage(message: SDKMessage): message is SDKResultMessage {
  return message.type === "result";
}

/**
 * Thresholds for each judge type
 */
const PASS_THRESHOLDS: Record<string, number> = {
  concept_fidelity: CONCEPT_FIDELITY_THRESHOLD,
  technical_quality: TECHNICAL_QUALITY_THRESHOLD,
  scalability: SCALABILITY_THRESHOLD,
  production_readiness: PRODUCTION_READINESS_THRESHOLD,
};

/**
 * Parse judge evaluation from response text.
 */
function parseJudgeEvaluation(
  judgeType: string,
  responseText: string
): SingleJudgeEvaluation {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from response");
    }

    const data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Calculate score from criteria
    const criteriaKeys = Object.keys(data).filter(
      (k) => typeof data[k] === "object" && data[k] !== null && "score" in (data[k] as object)
    );

    const criteria: Record<string, { score: number; reasoning: string; issues: string[]; suggestions: string[] }> = {};
    let totalScore = 0;

    for (const key of criteriaKeys) {
      const criterion = data[key] as Record<string, unknown>;
      criteria[key] = {
        score: typeof criterion.score === "number" ? criterion.score : 0,
        reasoning: typeof criterion.reasoning === "string" ? criterion.reasoning : "",
        issues: Array.isArray(criterion.issues) ? criterion.issues : [],
        suggestions: Array.isArray(criterion.suggestions) ? criterion.suggestions : [],
      };
      totalScore += criteria[key].score;
    }

    const score = criteriaKeys.length > 0 ? Math.round((totalScore / criteriaKeys.length) * 10) / 10 : 0;
    const threshold = PASS_THRESHOLDS[judgeType] || 7.0;
    const criticalIssues = Array.isArray(data.criticalIssues) ? (data.criticalIssues as string[]) : [];
    const allSuggestions = Object.values(criteria).flatMap((c) => c.suggestions);

    return {
      judgeType,
      passed: score >= threshold && criticalIssues.length === 0,
      score,
      criteria: criteria as Record<string, { score: number; maxScore: number; reasoning: string; issues: string[]; suggestions: string[] }>,
      reasoning: typeof data.overallReasoning === "string" ? data.overallReasoning : "Evaluation complete",
      criticalIssues,
      suggestions: [...new Set(allSuggestions)],
      evaluatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      judgeType,
      passed: false,
      score: 0,
      criteria: {},
      reasoning: `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      criticalIssues: ["Evaluation could not be completed"],
      suggestions: [],
      evaluatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Aggregate multiple judge evaluations into a single result.
 */
function aggregateEvaluations(evaluations: SingleJudgeEvaluation[]): AggregatedEvaluation {
  // Calculate weighted overall score
  let weightedSum = 0;
  let totalWeight = 0;

  for (const evaluation of evaluations) {
    const weight = JUDGE_WEIGHTS[evaluation.judgeType] || 0;
    weightedSum += evaluation.score * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;

  // Collect all critical issues
  const criticalIssues = evaluations.flatMap((e) => e.criticalIssues);

  // Collect and prioritize suggestions
  const allSuggestions = evaluations.flatMap((e) =>
    e.suggestions.map((s) => ({ suggestion: s, score: e.score }))
  );
  allSuggestions.sort((a, b) => a.score - b.score);
  const prioritizedSuggestions = [...new Set(allSuggestions.map((s) => s.suggestion))].slice(0, 10);

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

/**
 * Run the logo generation agent with subagent-based evaluation.
 */
export async function runLogoAgent(
  request: GenerateRequest,
  callbacks: AgentCallbacks
): Promise<GenerateResponse> {
  const { prompt, config, feedback, maxIterations = 5 } = request;

  // Build the agent prompt
  const agentPrompt = buildAgentPrompt(prompt, config, feedback);

  // Track iterations and results
  let iterations = 0;
  let finalSvg = "";
  const reasoningParts: string[] = [];

  // Notify phase start
  callbacks.onPhase?.({
    phase: "generation",
    progress: 0,
    message: "Starting logo generation...",
  });

  try {
    const response = query({
      prompt: agentPrompt,
      options: {
        model: "claude-sonnet-4-5",
        systemPrompt: SYSTEM_PROMPT,
        // Configure judge subagents
        agents: judgeAgents,
        // Allow Task tool for spawning subagents
        allowedTools: ["Task", "Read"],
        maxTurns: maxIterations * 3, // Allow for generation + evaluation turns
        permissionMode: "bypassPermissions", // Container is sandboxed
      },
    });

    for await (const message of response) {
      iterations++;

      // Handle different message types
      if (isAssistantMessage(message)) {
        // Extract reasoning from assistant messages
        const content = message.message.content;
        // Content is always an array of content blocks in the SDK
        for (const block of content) {
          if (block.type === "text") {
            reasoningParts.push(block.text);
            callbacks.onMessage?.({
              type: "text",
              content: block.text,
              timestamp: Date.now(),
            });

            // Check for SVG in text
            if (block.text.includes("<svg")) {
              finalSvg = extractSvg(block.text);
              callbacks.onProgress?.(finalSvg, iterations);
            }
          } else if (block.type === "tool_use") {
            callbacks.onMessage?.({
              type: "tool_call",
              content: `Spawning ${block.name}`,
              toolName: block.name,
              timestamp: Date.now(),
            });
          }
        }

        // Update phase progress
        const progress = Math.min((iterations / maxIterations) * 100, 90);
        callbacks.onPhase?.({
          phase: iterations > maxIterations / 2 ? "refinement" : "generation",
          progress,
          message: `Iteration ${iterations}...`,
        });
      }

      if (isResultMessage(message)) {
        // Result messages contain subagent results
        if (message.subtype === "success" && message.result) {
          // Check if the result contains SVG
          if (message.result.includes("<svg")) {
            finalSvg = extractSvg(message.result);
            callbacks.onProgress?.(finalSvg, iterations);
          }
        }

        callbacks.onMessage?.({
          type: "tool_result",
          content: message.subtype === "success" ? message.result.substring(0, 500) : "Error",
          timestamp: Date.now(),
        });
      }
    }

    // Notify completion
    callbacks.onPhase?.({
      phase: "complete",
      progress: 100,
      message: "Logo generation complete",
    });

    return {
      svg: finalSvg,
      iterations,
      reasoning: reasoningParts.slice(-3).join("\n\n"), // Last 3 reasoning blocks
      version: 1,
    };
  } catch (error) {
    callbacks.onMessage?.({
      type: "error",
      content: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    });

    throw error;
  }
}

/**
 * Build the prompt for the logo generation agent.
 */
function buildAgentPrompt(
  prompt: string,
  config?: Partial<LogoConfig> | undefined,
  feedback?: string
): string {
  const parts: string[] = [
    `Create a professional logo based on this description: ${prompt}`,
  ];

  if (config) {
    parts.push("\nConfiguration provided:");
    if (config.type) parts.push(`- Logo type: ${config.type}`);
    if (config.text) parts.push(`- Brand text: ${config.text}`);
    if (config.tagline) parts.push(`- Tagline: ${config.tagline}`);
    if (config.shape) parts.push(`- Shape: ${config.shape}`);
    if (config.theme) parts.push(`- Theme: ${config.theme}`);
    if (config.colors) {
      parts.push(`- Primary color: ${config.colors.primary}`);
      parts.push(`- Accent color: ${config.colors.accent}`);
    }
  }

  if (feedback) {
    parts.push(`\nUser feedback to address: ${feedback}`);
  }

  parts.push(
    "\nWorkflow:",
    "1. Generate an SVG logo following the logo-design skill guidelines",
    "2. Spawn all 4 judge subagents in parallel using Task tool",
    "3. Wait for all judges to complete and aggregate results",
    "4. If any judge fails, iterate with improvements",
    "5. Return the final SVG once all judges pass (or max iterations reached)"
  );

  return parts.join("\n");
}

/**
 * Extract SVG from text content.
 */
function extractSvg(text: string): string {
  const start = text.indexOf("<svg");
  const end = text.indexOf("</svg>") + 6;
  if (start !== -1 && end > start) {
    return text.substring(start, end);
  }
  return "";
}

// Re-export utility functions for direct usage
export { generateSvg, validateSvg, analyzeLogo };
export { parseJudgeEvaluation, aggregateEvaluations };
export type { SingleJudgeEvaluation, AggregatedEvaluation };
