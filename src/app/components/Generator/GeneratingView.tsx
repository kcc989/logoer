'use client';

import { useEffect, useRef } from 'react';
import { useChat } from '@tanstack/ai-react';
import { Spinner } from '@/components/ui/spinner';
import { ChatMessage } from '../FeedbackChat/ChatMessage';
import { ThinkingIndicator } from '../FeedbackChat/ThinkingIndicator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GeneratingViewProps {
  messages: ReturnType<typeof useChat>['messages'];
}

export function GeneratingView({ messages }: GeneratingViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
      <div className="w-full max-w-xl space-y-6">
        {/* Progress Indicator */}
        <div className="text-center">
          <div className="mb-6 inline-flex items-center justify-center">
            <div className="relative">
              <div className="h-20 w-20 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>
          <h2 className="text-xl font-semibold">Creating your logo...</h2>
          <p className="mt-1 text-muted-foreground">
            This usually takes about 10-15 seconds
          </p>
        </div>

        {/* Live Updates */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <ScrollArea className="h-48">
            <div className="space-y-3">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} compact />
              ))}
              <ThinkingIndicator />
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
