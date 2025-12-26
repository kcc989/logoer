import { chat, toStreamResponse, toolDefinition } from '@tanstack/ai';
import { anthropicText } from '@tanstack/ai-anthropic';
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
 * System prompt for the conversational Claude
 */
const SYSTEM_PROMPT = `You are a helpful logo design assistant. Your role is to help users create professional logos by understanding their needs and using the generateLogo tool.

WORKFLOW:
1. When a user describes a logo they want, gather key information:
   - Brand name/text to include
   - Preferred style (modern, minimal, playful, etc.)
   - Color preferences
   - Shape preferences
   - Any specific requirements

2. Use the generateLogo tool with the gathered information to create the logo.

3. After generating, explain your design choices and ask for feedback.

4. If the user provides feedback, use the generateLogo tool again with the previousFeedback parameter.

GUIDELINES:
- Be conversational and helpful
- Ask clarifying questions if the request is vague
- Explain design decisions briefly
- Suggest improvements based on design principles
- Always use the generateLogo tool to create logos - never try to describe SVG code directly

Remember: You handle the conversation, and the generateLogo tool handles the actual logo creation in a specialized environment.`;

/**
 * Invoke the logo generation container
 */
async function invokeLogoContainer(
  container: { fetch: (request: Request) => Promise<Response> },
  input: {
    description: string;
    config: z.infer<typeof LogoConfigSchema>;
    referenceImages?: string[];
    previousFeedback?: string;
  }
): Promise<{ svg: string; iterations: number; reasoning: string }> {
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
 * Chat handler for logo generation
 */
export async function chatHandler({
  request,
  env,
}: {
  request: Request;
  env: {
    ANTHROPIC_API_KEY: string;
    LogoAgentContainer: { fetch: (request: Request) => Promise<Response> };
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
      const result = await invokeLogoContainer(env.LogoAgentContainer, input);
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

  try {
    const stream = chat({
      adapter: anthropicText('claude-sonnet-4-5', {
        apiKey: env.ANTHROPIC_API_KEY,
      }),
      messages,
      conversationId,
      tools: [generateLogo],
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
