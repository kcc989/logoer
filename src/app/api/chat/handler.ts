import { chat, toStreamResponse, toolDefinition } from '@tanstack/ai';
import { anthropicText } from '@tanstack/ai-anthropic';
import { getContainer } from '@cloudflare/containers';
import { z } from 'zod';

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
  primary: z.string().describe('Primary color in hex format (e.g., #0f172a)'),
  accent: z.string().describe('Accent color in hex format (e.g., #3b82f6)'),
});

const LogoConfigSchema = z.object({
  type: LogoTypeSchema.describe('The type of logo to generate'),
  text: z.string().describe('The brand name or text to include in the logo'),
  shape: LogoShapeSchema.describe('The shape to use for abstract/pictorial elements'),
  theme: LogoThemeSchema.optional().describe('The visual theme/style for the logo'),
  colors: ColorConfigSchema.describe('Color palette for the logo'),
  width: z.number().default(400).describe('Width of the logo in pixels'),
  height: z.number().default(200).describe('Height of the logo in pixels'),
});

/**
 * Tool definition for generating logos via the Container
 */
const generateLogoDef = toolDefinition({
  name: 'generateLogo',
  description:
    'Generate an SVG logo using the Claude Agent SDK running in a container. ' +
    'Use this tool when the user wants to create, generate, or design a logo. ' +
    'The agent will iterate on the design until it meets quality standards.',
  inputSchema: z.object({
    description: z
      .string()
      .describe('Natural language description of the desired logo'),
    config: LogoConfigSchema.describe('Configuration options for the logo'),
    referenceImages: z
      .array(z.string())
      .optional()
      .describe('Base64 encoded reference images for style inspiration'),
    previousFeedback: z
      .string()
      .optional()
      .describe('Feedback from the user on a previous iteration'),
  }),
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
 * System prompt for the conversational Claude
 */
const SYSTEM_PROMPT = `You are a helpful logo design assistant. Your role is to help users create professional logos by understanding their needs and using the available tools.

WORKFLOW:
1. When a user describes a logo they want, gather key information:
   - Brand name/text to include
   - Preferred style (modern, minimal, playful, etc.)
   - Color preferences
   - Shape preferences
   - Any specific requirements

2. BEFORE generating, use findSimilarLogos to search for relevant examples in our database.
   This provides inspiration and helps create designs that follow proven patterns.
   - If similar logos are found, mention 1-2 key insights from them
   - If no similar logos are found, that's fine - proceed with generation

3. Use the generateLogo tool with the gathered information to create the logo.
   If you found similar logos, incorporate insights from them into the description.

4. After generating, explain your design choices and ask for feedback.

5. If the user provides feedback, use the generateLogo tool again with the previousFeedback parameter.

GUIDELINES:
- Be conversational and helpful
- Ask clarifying questions if the request is vague
- Use findSimilarLogos to research before generating (when relevant)
- Explain design decisions briefly
- Suggest improvements based on design principles
- Always use the generateLogo tool to create logos - never try to describe SVG code directly
- If the RAG search returns no results, don't mention it - just proceed with generation

Remember: You handle the conversation, findSimilarLogos provides design research, and generateLogo creates the actual logo.`;

/**
 * Invoke the logo generation container
 */
async function invokeLogoContainer(
  containerBinding: DurableObjectNamespace,
  input: {
    description: string;
    config: z.infer<typeof LogoConfigSchema>;
    referenceImages?: string[];
    previousFeedback?: string;
  }
): Promise<{ svg: string; iterations: number; reasoning: string }> {
  // Get a singleton container instance
  const container = getContainer(containerBinding);

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
 * Query the RAG system for similar logos
 */
async function querySimilarLogos(
  containerBinding: DurableObjectNamespace,
  input: {
    query?: string;
    logoType?: string;
    theme?: string;
    shape?: string;
    nResults?: number;
  }
): Promise<{
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
  const container = getContainer(containerBinding);

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
    // Return graceful degradation
    return {
      success: true,
      results: [],
      degraded: true,
      error: 'RAG query failed',
    };
  }

  return response.json();
}

/**
 * Chat handler for logo generation
 */
export async function chatHandler({
  request,
  env,
}: {
  request: Request;
  env: {
    ANTHROPIC_API_KEY: string;
    LOGO_AGENT: DurableObjectNamespace;
  };
}) {
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { messages, conversationId } = await request.json();

  // Create the generateLogo tool with server implementation
  const generateLogo = generateLogoDef.server(async (input) => {
    try {
      const result = await invokeLogoContainer(env.LOGO_AGENT, input);
      return {
        svg: result.svg,
        iterations: result.iterations,
        reasoning: result.reasoning,
        success: true,
      };
    } catch (error) {
      return {
        svg: '',
        iterations: 0,
        reasoning: '',
        success: false,
        error: error instanceof Error ? error.message : 'Logo generation failed',
      };
    }
  });

  // Create the findSimilarLogos tool with server implementation
  const findSimilarLogos = findSimilarLogosDef.server(async (input) => {
    try {
      const result = await querySimilarLogos(env.LOGO_AGENT, input);
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

  try {
    const stream = chat({
      adapter: anthropicText('claude-sonnet-4-5', {
        apiKey: env.ANTHROPIC_API_KEY,
      }),
      messages,
      conversationId,
      tools: [generateLogo, findSimilarLogos],
      systemPrompt: SYSTEM_PROMPT,
    });

    return toStreamResponse(stream);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Chat failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
