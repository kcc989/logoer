'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat, fetchServerSentEvents } from '@tanstack/ai-react';
import { z } from 'zod';
import { PaperPlaneRight, Sparkle } from '@phosphor-icons/react';
import type { LogoConfig } from '@/lib/logo-types';
import { FEEDBACK_SUGGESTIONS } from '@/lib/logo-constants';

// Zod schemas for parsing tool results
const ToolResultOutputSchema = z.object({
  svg: z.string().optional(),
  success: z.boolean().optional(),
  iterations: z.number().optional(),
  reasoning: z.string().optional(),
  error: z.string().optional(),
});

const ToolCallPartSchema = z.object({
  type: z.literal('tool-call'),
  id: z.string(),
  name: z.string(),
});

const ToolResultPartSchema = z.object({
  type: z.literal('tool-result'),
  toolCallId: z.string(),
  content: z.string(),
});

interface IdleViewProps {
  onLogoGenerated: (svg: string) => void;
  config: LogoConfig;
  onMessagesChange: (messages: ReturnType<typeof useChat>['messages']) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

const STARTER_PROMPTS = [
  'Create a modern tech startup logo',
  'Design a friendly cafe logo with a coffee cup',
  'Make an elegant law firm logo',
  'Create a playful pet store logo',
];

export function IdleView({
  onLogoGenerated,
  config,
  onMessagesChange,
  onLoadingChange,
}: IdleViewProps) {
  const [input, setInput] = useState('');
  const lastProcessedSvgRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, isLoading } = useChat({
    connection: fetchServerSentEvents('/api/chat'),
  });

  // Sync messages and loading state to parent
  useEffect(() => {
    onMessagesChange(messages);
  }, [messages, onMessagesChange]);

  useEffect(() => {
    onLoadingChange(isLoading);
  }, [isLoading, onLoadingChange]);

  // Watch messages for tool-result parts and extract SVG
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== 'assistant') continue;

      const toolCallMap = new Map<string, string>();
      for (const part of message.parts) {
        const toolCallResult = ToolCallPartSchema.safeParse(part);
        if (toolCallResult.success) {
          toolCallMap.set(toolCallResult.data.id, toolCallResult.data.name);
        }
      }

      for (const part of message.parts) {
        const toolResultResult = ToolResultPartSchema.safeParse(part);
        if (!toolResultResult.success) continue;

        const toolResult = toolResultResult.data;
        const toolName = toolCallMap.get(toolResult.toolCallId);
        if (toolName !== 'generateLogo') continue;

        let parsedContent: unknown;
        try {
          parsedContent = JSON.parse(toolResult.content);
        } catch {
          continue;
        }
        const contentParseResult = ToolResultOutputSchema.safeParse(parsedContent);
        if (!contentParseResult.success) continue;

        const output = contentParseResult.data;

        if (output.success && output.svg && output.svg !== lastProcessedSvgRef.current) {
          lastProcessedSvgRef.current = output.svg;
          onLogoGenerated(output.svg);
        }
      }
    }
  }, [messages, onLogoGenerated]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleStarterClick = (prompt: string) => {
    if (!isLoading) {
      sendMessage(prompt);
    }
  };

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Welcome Header */}
        <div className="text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
            <Sparkle className="h-8 w-8 text-primary" weight="duotone" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            What logo would you like to create?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Describe your vision and I&apos;ll bring it to life
          </p>
        </div>

        {/* Main Input */}
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your logo..."
            className="w-full rounded-xl border-2 border-input bg-background px-5 py-4 pr-14 text-lg shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-primary p-2.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <PaperPlaneRight className="h-5 w-5" weight="bold" />
          </button>
        </form>

        {/* Starter Prompts */}
        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Or try one of these:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleStarterClick(prompt)}
                disabled={isLoading}
                className="rounded-full border border-input bg-background px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
