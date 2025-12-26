'use client';

interface MessagePart {
  type: 'text' | 'thinking' | 'tool-call' | 'tool-result';
  content?: string;
  name?: string;
  state?: string;
  result?: {
    svg?: string;
    iterations?: number;
    reasoning?: string;
    success?: boolean;
    error?: string;
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={`rounded-lg p-3 text-sm ${
        isAssistant ? 'bg-muted/50' : 'bg-primary/10'
      }`}
    >
      <p className="mb-1 font-medium text-muted-foreground">
        {isAssistant ? 'Logo Agent' : 'You'}
      </p>
      <div className="space-y-2">
        {message.parts.map((part, idx) => {
          switch (part.type) {
            case 'thinking':
              return (
                <div
                  key={idx}
                  className="text-xs italic text-muted-foreground"
                >
                  <span className="mr-1">Thinking:</span>
                  {part.content}
                </div>
              );

            case 'text':
              return (
                <div key={idx} className="whitespace-pre-wrap">
                  {part.content}
                </div>
              );

            case 'tool-call':
              if (part.name === 'generateLogo') {
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

            case 'tool-result':
              if (part.result?.success && part.result?.svg) {
                return (
                  <div key={idx} className="space-y-2">
                    <div className="overflow-hidden rounded border border-border bg-white p-2">
                      <div
                        className="flex items-center justify-center"
                        dangerouslySetInnerHTML={{ __html: part.result.svg }}
                      />
                    </div>
                    {part.result.iterations && (
                      <p className="text-xs text-muted-foreground">
                        Generated in {part.result.iterations} iteration
                        {part.result.iterations > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                );
              }
              if (part.result?.error) {
                return (
                  <div
                    key={idx}
                    className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive"
                  >
                    Error: {part.result.error}
                  </div>
                );
              }
              return null;

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
