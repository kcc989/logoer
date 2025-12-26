'use client';

import { useState } from 'react';
import { useChat, fetchServerSentEvents } from '@tanstack/ai-react';

import type { LogoConfig } from '@/lib/logo-types';
import { FEEDBACK_SUGGESTIONS } from '@/lib/logo-constants';

import { ChatMessage } from './ChatMessage';
import { ThinkingIndicator } from './ThinkingIndicator';

interface FeedbackChatProps {
  onLogoGenerated: (svg: string) => void;
  config: LogoConfig;
}

export function FeedbackChat({ onLogoGenerated, config }: FeedbackChatProps) {
  const [input, setInput] = useState('');

  const { messages, sendMessage, isLoading } = useChat({
    connection: fetchServerSentEvents('/api/chat'),
    onToolCall: async ({ toolName, input: toolInput }) => {
      // Handle tool results - when generateLogo returns, update preview
      if (toolName === 'generateLogo') {
        const result = toolInput as { svg?: string; success?: boolean };
        if (result.svg && result.success) {
          onLogoGenerated(result.svg);
        }
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      // Include current config with the message as metadata
      sendMessage(input, {
        body: { config },
      });
      setInput('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!isLoading) {
      sendMessage(suggestion, {
        body: { config },
      });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-4 font-semibold">Chat</h2>

      {/* Messages area */}
      <div className="mb-4 flex-1 space-y-4 overflow-y-auto">
        {messages.length === 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="mb-1 font-medium text-muted-foreground">Logo Agent</p>
            <p>
              Hi! I&apos;m your logo design assistant. Describe the logo you
              want to create, and I&apos;ll help bring it to life.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {isLoading && <ThinkingIndicator />}
      </div>

      {/* Input area */}
      <div className="border-t pt-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your logo..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Send
          </button>
        </form>

        {/* Suggestion chips */}
        <div className="mt-2 flex flex-wrap gap-2">
          {FEEDBACK_SUGGESTIONS.slice(0, 4).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={isLoading}
              className="rounded border border-input px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
