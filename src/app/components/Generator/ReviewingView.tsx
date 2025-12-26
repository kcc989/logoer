'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useChat, fetchServerSentEvents } from '@tanstack/ai-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  DownloadSimple,
  FloppyDisk,
  ClockCounterClockwise,
  SlidersHorizontal,
  PaperPlaneRight,
  X,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LogoConfig } from '@/lib/logo-types';
import { EXPORT_SIZES, FEEDBACK_SUGGESTIONS } from '@/lib/logo-constants';
import { ChatMessage } from '../FeedbackChat/ChatMessage';
import { ThinkingIndicator } from '../FeedbackChat/ThinkingIndicator';
import { ConfigPanel } from './ConfigPanel';
import { VersionHistory } from './VersionHistory';
import { SaveLogoDialog } from './SaveLogoDialog';

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

interface ReviewingViewProps {
  svg: string;
  onLogoGenerated: (svg: string) => void;
  config: LogoConfig;
  onConfigChange: <K extends keyof LogoConfig>(key: K, value: LogoConfig[K]) => void;
  onColorChange: (colorKey: 'primary' | 'accent', value: string) => void;
  onApplyPreset: (preset: Partial<LogoConfig>) => void;
  versions: { id: string; svg: string; timestamp: Date }[];
  onSelectVersion: (id: string) => void;
  onDeleteVersion: (id: string) => void;
  onSaveLogo: (name: string, description: string) => Promise<void>;
  isSaving: boolean;
  initialMessages?: ReturnType<typeof useChat>['messages'];
  initialIsLoading?: boolean;
}

export function ReviewingView({
  svg,
  onLogoGenerated,
  config,
  onConfigChange,
  onColorChange,
  onApplyPreset,
  versions,
  onSelectVersion,
  onDeleteVersion,
  onSaveLogo,
  isSaving,
  initialMessages = [],
  initialIsLoading = false,
}: ReviewingViewProps) {
  const [zoom, setZoom] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [input, setInput] = useState('');
  const lastProcessedSvgRef = useRef<string | null>(svg);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, isLoading } = useChat({
    connection: fetchServerSentEvents('/api/chat'),
    initialMessages,
  });

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

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!isLoading) {
      sendMessage(suggestion);
    }
  };

  const handleExport = useCallback(
    async (format: 'svg' | 'png', size?: { width: number; height: number }) => {
      if (!svg) return;

      if (format === 'svg') {
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'logo.svg';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const targetWidth = size?.width ?? 1024;
        const targetHeight = size?.height ?? 1024;

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetWidth, targetHeight);

            const scale = Math.min(
              targetWidth / img.width,
              targetHeight / img.height
            );
            const x = (targetWidth - img.width * scale) / 2;
            const y = (targetHeight - img.height * scale) / 2;

            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `logo-${targetWidth}x${targetHeight}.png`;
                a.click();
                URL.revokeObjectURL(url);
              }
            }, 'image/png');
          }
        };
        const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        img.src = URL.createObjectURL(svgBlob);
      }
    },
    [svg]
  );

  const zoomIn = () => setZoom((z) => Math.min(4, z + 0.25));
  const zoomOut = () => setZoom((z) => Math.max(0.25, z - 0.25));

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Main Preview Area */}
      <div className="flex flex-1 flex-col">
        {/* Floating Actions Bar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={zoomOut}>
                    <MagnifyingGlassMinus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>
              <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={zoomIn}>
                    <MagnifyingGlassPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>
            </div>

            {/* Version Count */}
            {versions.length > 1 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVersionHistory(true)}
                    className="gap-1.5"
                  >
                    <ClockCounterClockwise className="h-4 w-4" />
                    <span className="text-xs">{versions.length}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Version history</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Settings Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showSettings ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>

            {/* Save Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                  disabled={isSaving}
                >
                  <FloppyDisk className="mr-1.5 h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save to gallery</TooltipContent>
            </Tooltip>

            {/* Export Dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <DownloadSimple className="mr-1.5 h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Export logo</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>SVG (Vector)</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleExport('svg')}>
                  Download SVG
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>PNG (Raster)</DropdownMenuLabel>
                {EXPORT_SIZES.map((size) => (
                  <DropdownMenuItem
                    key={size.label}
                    onClick={() =>
                      handleExport('png', { width: size.width, height: size.height })
                    }
                  >
                    {size.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Preview Canvas */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30">
          {/* Checkered background */}
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: `
                linear-gradient(45deg, #e5e5e5 25%, transparent 25%),
                linear-gradient(-45deg, #e5e5e5 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #e5e5e5 75%),
                linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)
              `,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            }}
          />

          {isLoading ? (
            <div className="relative z-10 text-center text-muted-foreground">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="font-medium">Refining your logo...</p>
            </div>
          ) : (
            <div
              className="relative z-10 flex items-center justify-center transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            >
              <div
                className="svg-container [&>svg]:h-[400px] [&>svg]:w-[400px]"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Chat Sidebar */}
      <div
        className={`flex flex-col rounded-xl border bg-background transition-all duration-300 ${
          chatExpanded ? 'w-80' : 'w-12'
        }`}
      >
        {chatExpanded ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b p-3">
              <h3 className="font-medium">Refine</h3>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setChatExpanded(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} compact />
                ))}
                {isLoading && <ThinkingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe changes..."
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  disabled={isLoading}
                />
                <Button type="submit" size="sm" disabled={!input.trim() || isLoading}>
                  <PaperPlaneRight className="h-4 w-4" />
                </Button>
              </form>

              {/* Quick Suggestions */}
              <div className="mt-2 flex flex-wrap gap-1">
                {FEEDBACK_SUGGESTIONS.slice(0, 3).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={isLoading}
                    className="rounded-full border border-input px-2 py-0.5 text-[10px] hover:bg-accent disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <Button
            variant="ghost"
            className="h-full w-full rounded-xl"
            onClick={() => setChatExpanded(true)}
          >
            <PaperPlaneRight className="h-5 w-5 rotate-180" />
          </Button>
        )}
      </div>

      {/* Settings Sheet */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
          </SheetHeader>
          <div className="mt-4 h-[calc(100vh-8rem)]">
            <ConfigPanel
              config={config}
              onConfigChange={onConfigChange}
              onColorChange={onColorChange}
              onApplyPreset={onApplyPreset}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Version History */}
      <VersionHistory
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        versions={versions}
        currentSvg={svg}
        onSelectVersion={onSelectVersion}
        onDeleteVersion={onDeleteVersion}
      />

      {/* Save Dialog */}
      <SaveLogoDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={onSaveLogo}
        isSaving={isSaving}
      />
    </div>
  );
}
