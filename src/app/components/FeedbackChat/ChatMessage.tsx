'use client';

import { z } from 'zod';

// Zod schemas for parsing message parts
const ToolOutputSchema = z.object({
  svg: z.string().optional(),
  iterations: z.number().optional(),
  reasoning: z.string().optional(),
  success: z.boolean().optional(),
  error: z.string().optional(),
});

const ToolCallPartSchema = z.object({
  type: z.literal('tool-call'),
  id: z.string(),
  name: z.string(),
  state: z.string().optional(),
});

const ToolResultPartSchema = z.object({
  type: z.literal('tool-result'),
  toolCallId: z.string(),
  content: z.string(),
  state: z.string().optional(),
  error: z.string().optional(),
});

const TextPartSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
});

const ThinkingPartSchema = z.object({
  type: z.literal('thinking'),
  content: z.string(),
});

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: unknown[];
}

interface ChatMessageProps {
  message: Message;
  compact?: boolean;
}

export function ChatMessage({ message, compact = false }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';

  // Build a map of tool call IDs to tool names
  const toolCallMap = new Map<string, string>();
  for (const part of message.parts) {
    const toolCallResult = ToolCallPartSchema.safeParse(part);
    if (toolCallResult.success) {
      toolCallMap.set(toolCallResult.data.id, toolCallResult.data.name);
    }
  }

  return (
    <div
      className={`rounded-lg text-sm ${
        isAssistant ? 'bg-muted/50' : 'bg-primary/10'
      } ${compact ? 'p-2' : 'p-3'}`}
    >
      <p className={`font-medium text-muted-foreground ${compact ? 'mb-0.5 text-xs' : 'mb-1'}`}>
        {isAssistant ? 'Logo Agent' : 'You'}
      </p>
      <div className="space-y-2">
        {message.parts.map((part, idx) => {
          // Try parsing as thinking part
          const thinkingResult = ThinkingPartSchema.safeParse(part);
          if (thinkingResult.success) {
            return (
              <div
                key={idx}
                className="text-xs italic text-muted-foreground"
              >
                <span className="mr-1">Thinking:</span>
                {thinkingResult.data.content}
              </div>
            );
          }

          // Try parsing as text part
          const textResult = TextPartSchema.safeParse(part);
          if (textResult.success) {
            return (
              <div key={idx} className="whitespace-pre-wrap">
                {textResult.data.content}
              </div>
            );
          }

          // Try parsing as tool-call part
          const toolCallResult = ToolCallPartSchema.safeParse(part);
          if (toolCallResult.success) {
            if (toolCallResult.data.name === 'generateLogo') {
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded bg-accent/50 px-2 py-1 text-xs"
                >
                  <span className="animate-pulse">Generating logo...</span>
                </div>
              );
            }
            return null;
          }

          // Try parsing as tool-result part
          const toolResultResult = ToolResultPartSchema.safeParse(part);
          if (toolResultResult.success) {
            const toolResult = toolResultResult.data;
            const toolName = toolCallMap.get(toolResult.toolCallId);

            // Only render for generateLogo tool results
            if (toolName !== 'generateLogo') {
              return null;
            }

            // Parse the content JSON string
            let parsedContent: unknown;
            try {
              parsedContent = JSON.parse(toolResult.content);
            } catch {
              return null;
            }

            const outputResult = ToolOutputSchema.safeParse(parsedContent);
            if (!outputResult.success) {
              return null;
            }

            const toolOutput = outputResult.data;
            const errorMessage = toolResult.error || toolOutput.error;

            if (toolOutput.success && toolOutput.svg) {
              return (
                <div key={idx} className="space-y-2">
                  <div className="overflow-hidden rounded border border-border bg-white p-2">
                    <div
                      className="flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: toolOutput.svg }}
                    />
                  </div>
                  {toolOutput.iterations && (
                    <p className="text-xs text-muted-foreground">
                      Generated in {toolOutput.iterations} iteration
                      {toolOutput.iterations > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              );
            }
            if (errorMessage) {
              return (
                <div
                  key={idx}
                  className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive"
                >
                  Error: {errorMessage}
                </div>
              );
            }
            return null;
          }

          return null;
        })}
      </div>
    </div>
  );
}
