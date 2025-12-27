import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage, SDKAssistantMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type {
  GenerateRequest,
  GenerateResponse,
  AgentMessage,
  PhaseUpdate,
  LogoConfig,
} from "./types.js";
import { LogoConfigSchema } from "./types.js";
import { generateSvg, validateSvg, analyzeLogo } from "./tools/svg-generator.js";
import {
  evaluateConceptFidelity,
  evaluateTechnicalQuality,
  evaluateScalability,
  evaluateProductionReadiness,
  runAllJudges,
  JudgeInputSchema,
} from "./tools/judges.js";
import { SYSTEM_PROMPT } from "./prompts.js";

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

// Create the custom MCP server with logo tools
const logoToolsServer = createSdkMcpServer({
  name: "logo-tools",
  version: "1.0.0",
  tools: [
    tool(
      "generate_svg",
      "Generate an SVG logo based on the provided configuration. Returns the SVG string.",
      {
        config: z
          .object({
            type: z.string().describe("Logo type: wordmark, lettermark, abstract, etc."),
            text: z.string().describe("Brand text to display"),
            tagline: z.string().optional().describe("Optional tagline"),
            shape: z.string().describe("Shape: circle, hexagon, triangle, etc."),
            theme: z.string().describe("Theme: modern, minimal, bold, etc."),
            colors: z
              .object({
                primary: z.string(),
                accent: z.string(),
                background: z.string().optional(),
              })
              .describe("Color palette"),
            typography: z
              .object({
                fontFamily: z.string(),
                fontSize: z.number(),
                fontWeight: z.union([z.string(), z.number()]),
                letterSpacing: z.number(),
              })
              .describe("Typography settings"),
            width: z.number().describe("SVG width"),
            height: z.number().describe("SVG height"),
          })
          .describe("Logo configuration"),
        customCode: z
          .string()
          .optional()
          .describe(
            "Optional custom Paper.js code to execute for advanced patterns"
          ),
      },
      async (args) => {
        try {
          const config = LogoConfigSchema.parse(args.config);
          const svg = await generateSvg(config, args.customCode);
          return {
            content: [
              {
                type: "text" as const,
                text: svg,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error generating SVG: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
            isError: true,
          };
        }
      }
    ),

    tool(
      "validate_svg",
      "Validate that an SVG string is well-formed and renderable. Returns validation results.",
      {
        svg: z.string().describe("The SVG string to validate"),
      },
      async (args) => {
        const result = validateSvg(args.svg);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    ),

    tool(
      "analyze_logo",
      "Analyze a logo SVG against design principles and the original configuration. Returns quality score and suggestions.",
      {
        svg: z.string().describe("The SVG string to analyze"),
        config: z
          .object({
            type: z.string(),
            text: z.string().optional(),
            colors: z
              .object({
                primary: z.string(),
                accent: z.string(),
              })
              .optional(),
          })
          .describe("Original configuration to compare against"),
      },
      async (args) => {
        const result = analyzeLogo(args.svg, args.config as Partial<LogoConfig>);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    ),

    tool(
      "refine_svg",
      "Apply specific refinements to an existing SVG. Use this for targeted improvements.",
      {
        svg: z.string().describe("The current SVG to refine"),
        refinements: z
          .array(z.string())
          .describe("List of specific refinements to apply"),
      },
      async (args) => {
        // For now, return the original SVG - refinement logic to be implemented
        return {
          content: [
            {
              type: "text" as const,
              text: `Refinement requested: ${args.refinements.join(", ")}. Implement using generate_svg with adjusted parameters.`,
            },
          ],
        };
      }
    ),

    // ========================================================================
    // Judge Evaluator Tools
    // ========================================================================

    tool(
      "judge_concept_fidelity",
      "Evaluate how well an SVG logo matches the brand identity and concept. Checks brand alignment, color accuracy, typography, and style consistency. Returns detailed scores and feedback.",
      {
        svg: z.string().describe("The SVG string to evaluate"),
        brandInfo: z
          .object({
            brandName: z.string(),
            industry: z.string(),
            targetAudience: z.string(),
            brandPersonality: z.array(z.string()).optional(),
            stylePreferences: z.array(z.string()).optional(),
            colorPreferences: z.array(z.string()).optional(),
          })
          .describe("Brand discovery information"),
        conceptInfo: z
          .object({
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
          })
          .optional()
          .describe("Selected concept details"),
        config: z
          .object({
            type: z.string().optional(),
            text: z.string().optional(),
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
          })
          .optional()
          .describe("Logo configuration"),
        iterationNumber: z.number().default(1).describe("Current iteration number"),
      },
      async (args) => {
        try {
          const input = JudgeInputSchema.parse(args);
          const result = await evaluateConceptFidelity(input);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error evaluating concept fidelity: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
            isError: true,
          };
        }
      }
    ),

    tool(
      "judge_technical_quality",
      "Evaluate the technical quality of an SVG logo. Checks validity, optimization, element usage, accessibility, and dimension accuracy. Returns detailed scores and feedback.",
      {
        svg: z.string().describe("The SVG string to evaluate"),
        brandInfo: z
          .object({
            brandName: z.string(),
            industry: z.string(),
            targetAudience: z.string(),
            brandPersonality: z.array(z.string()).optional(),
            stylePreferences: z.array(z.string()).optional(),
            colorPreferences: z.array(z.string()).optional(),
          })
          .describe("Brand discovery information"),
        config: z
          .object({
            type: z.string().optional(),
            text: z.string().optional(),
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
          })
          .optional()
          .describe("Logo configuration"),
        iterationNumber: z.number().default(1).describe("Current iteration number"),
      },
      async (args) => {
        try {
          const input = JudgeInputSchema.parse(args);
          const result = await evaluateTechnicalQuality(input);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error evaluating technical quality: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
            isError: true,
          };
        }
      }
    ),

    tool(
      "judge_scalability",
      "Evaluate how well a logo SVG scales across different sizes. Checks readability at small sizes, appearance at medium sizes, quality at large sizes, stroke scaling, and aspect ratio. Returns detailed scores and feedback.",
      {
        svg: z.string().describe("The SVG string to evaluate"),
        brandInfo: z
          .object({
            brandName: z.string(),
            industry: z.string(),
            targetAudience: z.string(),
            brandPersonality: z.array(z.string()).optional(),
            stylePreferences: z.array(z.string()).optional(),
            colorPreferences: z.array(z.string()).optional(),
          })
          .describe("Brand discovery information"),
        config: z
          .object({
            type: z.string().optional(),
            text: z.string().optional(),
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
          })
          .optional()
          .describe("Logo configuration"),
        iterationNumber: z.number().default(1).describe("Current iteration number"),
      },
      async (args) => {
        try {
          const input = JudgeInputSchema.parse(args);
          const result = await evaluateScalability(input);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error evaluating scalability: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
            isError: true,
          };
        }
      }
    ),

    tool(
      "judge_production_readiness",
      "Evaluate whether a logo SVG is ready for production use. Checks raster exportability, font availability, color format, self-containment, and file size. Returns detailed scores and feedback.",
      {
        svg: z.string().describe("The SVG string to evaluate"),
        brandInfo: z
          .object({
            brandName: z.string(),
            industry: z.string(),
            targetAudience: z.string(),
            brandPersonality: z.array(z.string()).optional(),
            stylePreferences: z.array(z.string()).optional(),
            colorPreferences: z.array(z.string()).optional(),
          })
          .describe("Brand discovery information"),
        config: z
          .object({
            type: z.string().optional(),
            text: z.string().optional(),
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
          })
          .optional()
          .describe("Logo configuration"),
        iterationNumber: z.number().default(1).describe("Current iteration number"),
      },
      async (args) => {
        try {
          const input = JudgeInputSchema.parse(args);
          const result = await evaluateProductionReadiness(input);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error evaluating production readiness: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
            isError: true,
          };
        }
      }
    ),

    tool(
      "judge_all",
      "Run all four judge evaluators (concept fidelity, technical quality, scalability, production readiness) in parallel and return aggregated results with pass/fail decision.",
      {
        svg: z.string().describe("The SVG string to evaluate"),
        brandInfo: z
          .object({
            brandName: z.string(),
            industry: z.string(),
            targetAudience: z.string(),
            brandPersonality: z.array(z.string()).optional(),
            stylePreferences: z.array(z.string()).optional(),
            colorPreferences: z.array(z.string()).optional(),
          })
          .describe("Brand discovery information"),
        conceptInfo: z
          .object({
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
          })
          .optional()
          .describe("Selected concept details"),
        config: z
          .object({
            type: z.string().optional(),
            text: z.string().optional(),
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
          })
          .optional()
          .describe("Logo configuration"),
        previousFeedback: z
          .array(z.string())
          .optional()
          .describe("Previous iteration feedback to check if addressed"),
        iterationNumber: z.number().default(1).describe("Current iteration number"),
      },
      async (args) => {
        try {
          const input = JudgeInputSchema.parse(args);
          const result = await runAllJudges(input);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error running all judges: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
            isError: true,
          };
        }
      }
    ),
  ],
});

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
        mcpServers: {
          "logo-tools": logoToolsServer,
        },
        allowedTools: [
          "mcp__logo-tools__generate_svg",
          "mcp__logo-tools__validate_svg",
          "mcp__logo-tools__analyze_logo",
          "mcp__logo-tools__refine_svg",
          "mcp__logo-tools__judge_concept_fidelity",
          "mcp__logo-tools__judge_technical_quality",
          "mcp__logo-tools__judge_scalability",
          "mcp__logo-tools__judge_production_readiness",
          "mcp__logo-tools__judge_all",
        ],
        maxTurns: maxIterations * 2, // Allow for tool calls and responses
        permissionMode: "bypassPermissions", // Container is sandboxed
      },
    });

    for await (const message of response) {
      iterations++;

      // Handle different message types
      if (isAssistantMessage(message)) {
        // Extract reasoning from assistant messages
        const content = message.message.content;
        if (typeof content === "string") {
          reasoningParts.push(content);
          callbacks.onMessage?.({
            type: "text",
            content: content,
            timestamp: Date.now(),
          });
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              reasoningParts.push(block.text);
              callbacks.onMessage?.({
                type: "text",
                content: block.text,
                timestamp: Date.now(),
              });
            } else if (block.type === "tool_use") {
              callbacks.onMessage?.({
                type: "tool_call",
                content: `Calling ${block.name}`,
                toolName: block.name,
                timestamp: Date.now(),
              });

              // Check tool result in the input for SVG content
              const inputStr = JSON.stringify(block.input);
              if (inputStr.includes("<svg")) {
                finalSvg = extractSvg(inputStr);
                callbacks.onProgress?.(finalSvg, iterations);
              }
            }
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
        // Result messages contain the final result
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
    "1. Use generate_svg to create the initial logo",
    "2. Use validate_svg to ensure it's well-formed",
    "3. Use analyze_logo to evaluate quality",
    "4. If quality score is below 7, iterate with improvements",
    "5. Return the final SVG once satisfied with quality"
  );

  return parts.join("\n");
}

function extractSvg(text: string): string {
  const start = text.indexOf("<svg");
  const end = text.indexOf("</svg>") + 6;
  if (start !== -1 && end > start) {
    return text.substring(start, end);
  }
  return "";
}
