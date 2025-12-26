import {
  chat,
  convertMessagesToModelMessages,
  maxIterations,
  toServerSentEventsStream,
  toolDefinition,
} from '@tanstack/ai';
import { anthropicText } from '@tanstack/ai-anthropic';
import { getContainer } from '@cloudflare/containers';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import {
  createResearchService,
  summarizeResearchResults,
  type ResearchResult,
} from '@/lib/firecrawl';

/**
 * Zod schemas for logo configuration
 */
const LogoTypeSchema = z.enum([
  'wordmark',
  'lettermark',
  'pictorial',
  'abstract',
  'mascot',
  'combination',
  'emblem',
]);

const LogoShapeSchema = z.enum([
  'circle',
  'hexagon',
  'triangle',
  'diamond',
  'star',
  'shield',
]);

const LogoThemeSchema = z.enum([
  'modern',
  'minimal',
  'bold',
  'elegant',
  'playful',
  'tech',
  'vintage',
  'organic',
]);

const ColorConfigSchema = z.object({
  primary: z
    .string()
    .default('#0f172a')
    .describe('Primary color in hex format (e.g., #0f172a)'),
  accent: z
    .string()
    .default('#3b82f6')
    .describe('Accent color in hex format (e.g., #3b82f6)'),
});

const LogoConfigSchema = z.object({
  type: LogoTypeSchema.default('abstract').describe(
    'The type of logo to generate'
  ),
  text: z
    .string()
    .default('BRAND')
    .describe('The brand name or text to include in the logo'),
  shape: LogoShapeSchema.default('circle').describe(
    'The shape to use for abstract/pictorial elements'
  ),
  theme: LogoThemeSchema.optional().describe(
    'The visual theme/style for the logo'
  ),
  colors: ColorConfigSchema.default({
    primary: '#0f172a',
    accent: '#3b82f6',
  }).describe('Color palette for the logo'),
  width: z.number().default(400).describe('Width of the logo in pixels'),
  height: z.number().default(200).describe('Height of the logo in pixels'),
});

/**
 * Simple test tool to verify tool execution works
 */
const echoTestDef = toolDefinition({
  name: 'echoTest',
  description:
    'A simple test tool that echoes back a message. Use this for testing.',
  inputSchema: z.object({
    message: z.string(),
  }),
});

/**
 * Simplified tool input schema for LLM compatibility
 */
const SimpleLogoInputSchema = z.object({
  description: z
    .string()
    .describe(
      'REQUIRED: The full natural language description of what the user wants. ' +
        'Include ALL details from the user request: colors, shapes, symbols, text, style, etc. ' +
        'Example: "a red lightning bolt logo alongside a letter R"'
    ),
  brandName: z
    .string()
    .optional()
    .describe('The brand name or text to include'),
  logoType: z
    .string()
    .optional()
    .describe(
      'Type: wordmark, lettermark, pictorial, abstract, mascot, combination, or emblem'
    ),
  theme: z
    .string()
    .optional()
    .describe(
      'Style: modern, minimal, bold, elegant, playful, tech, vintage, or organic'
    ),
  shape: z
    .string()
    .optional()
    .describe(
      'Shape hint: circle, hexagon, triangle, diamond, star, shield, or any shape'
    ),
  primaryColor: z
    .string()
    .optional()
    .describe(
      'Primary color in hex format (e.g., #dc2626 for red, #3b82f6 for blue)'
    ),
  accentColor: z.string().optional().describe('Accent color in hex format'),
});

/**
 * Tool definition for generating logos via the Container
 */
const generateLogoDef = toolDefinition({
  name: 'generateLogo',
  description:
    "Generate an SVG logo using AI. IMPORTANT: Always pass the user's FULL description " +
    'in the description field - this is what the AI uses to create the logo. ' +
    'Include all details about colors, shapes, symbols, and style.',
  inputSchema: SimpleLogoInputSchema,
});

/**
 * Schema for similar logo results
 */
const SimilarLogoSchema = z.object({
  id: z.string(),
  score: z.number(),
  metadata: z.object({
    logo_id: z.string(),
    name: z.string().nullable(),
    description: z.string(),
    logo_type: z.string(),
    theme: z.string().nullable(),
    shape: z.string().nullable(),
    primary_color: z.string().nullable(),
    accent_color: z.string().nullable(),
    text: z.string().nullable(),
  }),
});

/**
 * Tool definition for finding similar logos via RAG
 */
const findSimilarLogosDef = toolDefinition({
  name: 'findSimilarLogos',
  description:
    'Search for similar logos in the database to use as inspiration. ' +
    'Use this tool BEFORE generating a logo to find relevant examples that can inform the design. ' +
    'This helps create logos that follow proven design patterns.',
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe('Natural language description of the desired logo style'),
    logoType: LogoTypeSchema.optional().describe('Filter by logo type'),
    theme: LogoThemeSchema.optional().describe('Filter by visual theme'),
    shape: LogoShapeSchema.optional().describe('Filter by shape'),
    nResults: z
      .number()
      .default(3)
      .describe('Number of similar logos to return (default 3)'),
  }),
});

/**
 * Tool definition for researching competitors and industry trends via Firecrawl
 */
const researchCompetitorsDef = toolDefinition({
  name: 'researchCompetitors',
  description:
    'Research competitor logos and industry design trends using web search. ' +
    'Use this tool in the RESEARCH phase to gather inspiration and understand the competitive landscape. ' +
    'This helps inform concept generation with real-world examples.',
  inputSchema: z.object({
    industry: z.string().describe('The industry or business niche (e.g., "fintech", "healthcare", "fitness")'),
    competitors: z
      .array(z.string())
      .describe('List of competitor brand names to research (max 5)'),
    styleKeywords: z
      .array(z.string())
      .describe('Design style keywords to search for (e.g., ["minimalist", "modern", "geometric"])'),
  }),
});

/**
 * System prompt for the conversational Claude
 */
const SYSTEM_PROMPT = `You are a helpful logo design assistant. Your role is to help users create professional logos by understanding their needs and using the available tools.

CRITICAL: When calling generateLogo, you MUST pass the user's FULL request in the "description" field.
The description is what the AI uses to create the logo. Example:
- User says: "Create a red lightning bolt logo alongside a letter R"
- You call generateLogo with description: "a red lightning bolt logo alongside a letter R"

WORKFLOW:
1. When a user describes a logo they want, immediately use generateLogo with their full description.
   Also extract and pass:
   - brandName: any text/letters they want in the logo
   - primaryColor: convert color names to hex (red=#dc2626, blue=#3b82f6, green=#22c55e)
   - logoType, theme, shape: if they mention these

2. Optionally use findSimilarLogos first to get design inspiration.

3. After generating, ask for feedback and iterate if needed.

IMPORTANT TOOL USAGE:
- The "description" field is REQUIRED and should contain the user's full request
- Convert color names to hex codes: red=#dc2626, blue=#3b82f6, green=#22c55e, yellow=#eab308, purple=#7c3aed, orange=#f97316
- Pass all relevant details to generateLogo - the AI in the container uses these to create the SVG

GUIDELINES:
- Be conversational but efficient - generate quickly, then discuss
- Always use the generateLogo tool to create logos - never try to describe SVG code directly
- If the RAG search returns no results, don't mention it - just proceed with generation

Remember: The description field drives the logo generation. Always pass the user's full request.`;

/**
 * Type definitions for tool inputs
 */
type GenerateLogoInput = {
  description: string;
  config: z.infer<typeof LogoConfigSchema>;
  referenceImages?: string[];
  previousFeedback?: string;
};

type FindSimilarLogosInput = {
  query?: string;
  logoType?: z.infer<typeof LogoTypeSchema>;
  theme?: z.infer<typeof LogoThemeSchema>;
  shape?: z.infer<typeof LogoShapeSchema>;
  nResults?: number;
};

/**
 * TanStack AI UIMessage schema - supports both formats:
 * 1. Full UIMessage: { id, role, parts: [...] }
 * 2. Simple format: { role, content: "..." }
 * @see https://github.com/tanstack/ai/blob/main/packages/ai/src/types.ts
 */
const TextPartSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
  metadata: z.unknown().optional(),
});

const ToolCallPartSchema = z.object({
  type: z.literal('tool-call'),
  id: z.string(),
  name: z.string(),
  arguments: z.string(),
  state: z.string(),
  approval: z
    .object({
      id: z.string(),
      needsApproval: z.boolean(),
      approved: z.boolean().optional(),
    })
    .optional(),
  output: z.unknown().optional(),
});

const ToolResultPartSchema = z.object({
  type: z.literal('tool-result'),
  toolCallId: z.string(),
  content: z.string(),
  state: z.string(),
  error: z.string().optional(),
});

const ThinkingPartSchema = z.object({
  type: z.literal('thinking'),
  content: z.string(),
});

const MessagePartSchema = z.union([
  TextPartSchema,
  ToolCallPartSchema,
  ToolResultPartSchema,
  ThinkingPartSchema,
]);

/**
 * Flexible message schema that accepts both formats and normalizes to UIMessage
 */
const FlexibleMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    // Full UIMessage format
    parts: z.array(MessagePartSchema).optional(),
    // Simple format
    content: z.string().optional(),
    createdAt: z.string().optional(),
  })
  .transform((msg) => {
    // Normalize to UIMessage format with parts
    if (msg.parts) {
      return {
        id: msg.id || crypto.randomUUID(),
        role: msg.role,
        parts: msg.parts,
        createdAt: msg.createdAt,
      };
    }
    // Convert simple content to parts format
    return {
      id: msg.id || crypto.randomUUID(),
      role: msg.role,
      parts: msg.content
        ? [{ type: 'text' as const, content: msg.content }]
        : [],
      createdAt: msg.createdAt,
    };
  });

/**
 * Request body schema for chat handler
 */
const ChatRequestSchema = z.object({
  messages: z.array(FlexibleMessageSchema),
  conversationId: z.string().optional(),
});

/**
 * Helper to wait for a specified time
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for container to be ready by polling the health endpoint
 */
async function waitForContainer(
  container: ReturnType<typeof getContainer>,
  maxWaitMs: number = 30000
): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 1000;

  console.log('[waitForContainer] Waiting for container to be ready...');

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await container.fetch(
        new Request('http://container/health', {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        })
      );

      if (response.ok) {
        console.log('[waitForContainer] Container is ready!');
        return;
      }
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.log(
        `[waitForContainer] Not ready yet (${elapsed}ms elapsed): ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    await sleep(pollInterval);
  }

  throw new Error(`Container failed to become ready within ${maxWaitMs}ms`);
}

/**
 * Invoke the logo generation container with startup wait
 */
async function invokeLogoContainer(input: {
  description: string;
  config: z.infer<typeof LogoConfigSchema>;
  referenceImages?: string[];
  previousFeedback?: string;
}): Promise<{ svg: string; iterations: number; reasoning: string }> {
  // Get a singleton container instance
  const container = getContainer(env.LOGO_AGENT);
  await container.startAndWaitForPorts({
    startOptions: {
      envVars: {
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      },
    },
  });

  // Wait for container to be ready first

  console.log('[invokeLogoContainer] Making generate request...');

  // Make request to the container's /generate endpoint
  const response = await container.fetch(
    new Request('http://container/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Container error: ${error}`);
  }

  return response.json();
}

/**
 * Query the RAG system for similar logos with startup wait
 */
async function querySimilarLogos(input: {
  query?: string;
  logoType?: string;
  theme?: string;
  shape?: string;
  nResults?: number;
}): Promise<{
  success: boolean;
  results: Array<{
    id: string;
    score: number;
    metadata: {
      logo_id: string;
      name: string | null;
      description: string;
      logo_type: string;
      theme: string | null;
      shape: string | null;
      primary_color: string | null;
      accent_color: string | null;
      text: string | null;
    };
  }>;
  degraded: boolean;
  error?: string;
}> {
  const container = getContainer(env.LOGO_AGENT);
  await container.startAndWaitForPorts({
    startOptions: {
      envVars: {
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      },
    },
  });

  try {
    // Wait for container to be ready first

    console.log('[querySimilarLogos] Making RAG query...');

    const response = await container.fetch(
      new Request('http://container/rag/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: input.query,
          logo_type: input.logoType,
          theme: input.theme,
          shape: input.shape,
          n_results: input.nResults ?? 3,
        }),
      })
    );

    if (!response.ok) {
      return {
        success: true,
        results: [],
        degraded: true,
        error: 'RAG query failed',
      };
    }

    return response.json();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.log(`[querySimilarLogos] Error: ${errorMessage}`);

    // Return graceful degradation on error
    return {
      success: true,
      results: [],
      degraded: true,
      error: errorMessage,
    };
  }
}

/**
 * Chat handler for logo generation
 */
export async function chatHandler({ request }: { request: Request }) {
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = (await request.json()) as { messages?: Array<{ role: string }> };

  // Debug: log what roles are being sent
  console.log(
    '[chatHandler] Received message roles:',
    body.messages?.map((m) => m.role)
  );

  const { messages: parsedMessages, conversationId } =
    ChatRequestSchema.parse(body);

  // Filter out 'tool' role messages as they're handled internally by TanStack AI
  const messages = parsedMessages.filter(
    (m): m is typeof m & { role: 'user' | 'assistant' | 'system' } =>
      m.role !== 'tool'
  );

  // Simple echo test tool
  const echoTest = echoTestDef.server(async (rawInput) => {
    const input = rawInput as { message: string };
    console.log('[echoTest] Tool executed with message:', input.message);
    return {
      echo: `You said: ${input.message}`,
      timestamp: new Date().toISOString(),
    };
  });

  // Create the generateLogo tool with server implementation
  const generateLogo = generateLogoDef.server(async (rawInput) => {
    console.log('[generateLogo] ====== TOOL INVOKED ======');
    console.log('[generateLogo] Raw input type:', typeof rawInput);
    console.log('[generateLogo] Raw input:', JSON.stringify(rawInput, null, 2));

    const simpleInput = rawInput as z.infer<typeof SimpleLogoInputSchema>;
    console.log(
      '[generateLogo] Tool function entered with:',
      JSON.stringify(simpleInput, null, 2)
    );

    // Build description from fields if not provided
    let description = simpleInput.description || '';
    if (!description) {
      const parts = [];
      if (simpleInput.brandName) parts.push(`Brand: ${simpleInput.brandName}`);
      if (simpleInput.logoType) parts.push(`Type: ${simpleInput.logoType}`);
      if (simpleInput.theme) parts.push(`Theme: ${simpleInput.theme}`);
      if (simpleInput.shape) parts.push(`Shape: ${simpleInput.shape}`);
      if (simpleInput.primaryColor)
        parts.push(`Primary color: ${simpleInput.primaryColor}`);
      if (simpleInput.accentColor)
        parts.push(`Accent color: ${simpleInput.accentColor}`);
      description = parts.join(', ') || 'Generate a logo';
    }

    // Convert simple input to container format
    const containerInput = {
      description,
      config: {
        type:
          (simpleInput.logoType as z.infer<typeof LogoTypeSchema>) ||
          'abstract',
        text: simpleInput.brandName || 'BRAND',
        shape:
          (simpleInput.shape as z.infer<typeof LogoShapeSchema>) || 'circle',
        theme: simpleInput.theme as z.infer<typeof LogoThemeSchema> | undefined,
        colors: {
          primary: simpleInput.primaryColor || '#0f172a',
          accent: simpleInput.accentColor || '#3b82f6',
        },
        width: 400,
        height: 200,
      },
    };

    console.log(
      '[generateLogo] Converted to container input:',
      JSON.stringify(containerInput, null, 2)
    );

    try {
      const result = await invokeLogoContainer(containerInput);
      console.log('[generateLogo] Container returned successfully');
      return {
        svg: result.svg,
        iterations: result.iterations,
        reasoning: result.reasoning,
        success: true,
      };
    } catch (error) {
      console.error('[generateLogo] Error:', error);
      return {
        svg: '',
        iterations: 0,
        reasoning: '',
        success: false,
        error:
          error instanceof Error ? error.message : 'Logo generation failed',
      };
    }
  });

  // Create the findSimilarLogos tool with server implementation
  const findSimilarLogos = findSimilarLogosDef.server(async (rawInput) => {
    console.log('[findSimilarLogos] ====== TOOL INVOKED ======');
    console.log(
      '[findSimilarLogos] Raw input:',
      JSON.stringify(rawInput, null, 2)
    );

    const input = rawInput as FindSimilarLogosInput;
    try {
      const result = await querySimilarLogos(input);
      return {
        success: result.success,
        results: result.results,
        count: result.results.length,
        degraded: result.degraded,
      };
    } catch (error) {
      // Return empty results on error - graceful degradation
      return {
        success: true,
        results: [],
        count: 0,
        degraded: true,
        error: error instanceof Error ? error.message : 'RAG query failed',
      };
    }
  });

  // Create the researchCompetitors tool with server implementation
  const researchCompetitors = researchCompetitorsDef.server(async (rawInput) => {
    console.log('[researchCompetitors] ====== TOOL INVOKED ======');
    console.log(
      '[researchCompetitors] Raw input:',
      JSON.stringify(rawInput, null, 2)
    );

    const input = rawInput as {
      industry: string;
      competitors: string[];
      styleKeywords: string[];
    };

    // Check if Firecrawl API key is configured
    if (!env.FIRECRAWL_API_KEY) {
      console.log('[researchCompetitors] FIRECRAWL_API_KEY not configured');
      return {
        success: false,
        results: [],
        summary: 'Research is not available - FIRECRAWL_API_KEY not configured',
        error: 'FIRECRAWL_API_KEY not configured',
      };
    }

    try {
      const researchService = createResearchService(env.FIRECRAWL_API_KEY);

      const session = await researchService.executeResearch({
        industry: input.industry,
        competitors: input.competitors.slice(0, 5), // Limit to 5 competitors
        styleKeywords: input.styleKeywords,
        brandName: '', // Will be filled from agent state in future
      });

      const summary = summarizeResearchResults(session.results);

      console.log(
        `[researchCompetitors] Research complete: ${session.results.length} results`
      );

      return {
        success: true,
        results: session.results.map((r: ResearchResult) => ({
          id: r.id,
          sourceUrl: r.sourceUrl,
          sourceType: r.sourceType,
          title: r.title,
          description: r.description,
          imageCount: r.imageUrls.length,
          patterns: r.extractedPatterns,
          relevanceScore: r.relevanceScore,
        })),
        summary,
        totalResults: session.results.length,
        competitorCount: session.results.filter(
          (r: ResearchResult) => r.sourceType === 'competitor'
        ).length,
        trendCount: session.results.filter(
          (r: ResearchResult) => r.sourceType === 'trend'
        ).length,
        inspirationCount: session.results.filter(
          (r: ResearchResult) => r.sourceType === 'inspiration'
        ).length,
      };
    } catch (error) {
      console.error('[researchCompetitors] Error:', error);
      return {
        success: false,
        results: [],
        summary: 'Research failed',
        error: error instanceof Error ? error.message : 'Research failed',
      };
    }
  });

  try {
    // Convert UIMessages to ModelMessages format expected by chat()
    // Using type assertion since our schema validation ensures correct structure
    const modelMessages = convertMessagesToModelMessages(messages as any);

    const stream = chat({
      adapter: anthropicText('claude-sonnet-4-5', {
        apiKey: env.ANTHROPIC_API_KEY,
      }),
      messages: modelMessages as any,
      conversationId,
      tools: [echoTest, generateLogo, findSimilarLogos, researchCompetitors],
      systemPrompts: [SYSTEM_PROMPT],
      agentLoopStrategy: maxIterations(10),
    });

    return new Response(toServerSentEventsStream(stream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Chat failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
