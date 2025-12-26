'use client';

export function ThinkingIndicator() {
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-sm">
      <p className="mb-1 font-medium text-muted-foreground">Logo Agent</p>
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-primary"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-primary"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-primary"
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <span className="text-muted-foreground">Thinking...</span>
      </div>
    </div>
  );
}
