'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  DownloadSimple,
  ClockCounterClockwise,
  ArrowsOut,
  FloppyDisk,
} from '@phosphor-icons/react';
import { EXPORT_SIZES } from '@/lib/logo-constants';

interface PreviewCanvasProps {
  svg: string | null;
  isLoading: boolean;
  versions: { id: string; svg: string; timestamp: Date }[];
  onSelectVersion: (id: string) => void;
  onToggleVersions?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export function PreviewCanvas({
  svg,
  isLoading,
  versions,
  onSelectVersion,
  onToggleVersions,
  onSave,
  isSaving,
}: PreviewCanvasProps) {
  const [zoom, setZoom] = useState(1);

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
        // Convert SVG to PNG via canvas with specified size
        const targetWidth = size?.width ?? 1024;
        const targetHeight = size?.height ?? 1024;

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Draw white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetWidth, targetHeight);

            // Calculate scaling to fit while maintaining aspect ratio
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
        // Encode SVG properly for image source
        const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        img.src = URL.createObjectURL(svgBlob);
      }
    },
    [svg]
  );

  const zoomIn = () => setZoom((z) => Math.min(4, z + 0.25));
  const zoomOut = () => setZoom((z) => Math.max(0.25, z - 0.25));
  const resetZoom = () => setZoom(1);

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Preview</h2>
        <div className="flex items-center gap-2">
          {/* Version History Toggle */}
          {versions.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleVersions}
                  className="gap-1.5"
                >
                  <ClockCounterClockwise className="h-4 w-4" />
                  <span className="text-xs">{versions.length}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>View version history</TooltipContent>
            </Tooltip>
          )}

          {/* Save Button */}
          {onSave && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onSave}
                  disabled={!svg || isSaving}
                >
                  <FloppyDisk className="mr-1.5 h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save to gallery</TooltipContent>
            </Tooltip>
          )}

          {/* Export Dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!svg}>
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

      {/* Preview Area */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/30">
        {/* Checkered background pattern */}
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
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="font-medium">Agent is designing your logo...</p>
          </div>
        ) : svg ? (
          <div
            className="relative z-10 flex items-center justify-center transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          >
            <div
              className="svg-container [&>svg]:max-h-[300px] [&>svg]:max-w-[300px]"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        ) : (
          <div className="relative z-10 text-center text-muted-foreground">
            <svg
              className="mx-auto mb-4 h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="font-medium">No logo generated yet</p>
            <p className="mt-1 text-sm">
              Describe your logo in the chat to get started
            </p>
          </div>
        )}
      </div>

      {/* Bottom controls - Zoom */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" onClick={zoomOut}>
                <MagnifyingGlassMinus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>

          <div className="w-32">
            <Slider
              value={[zoom]}
              min={0.25}
              max={4}
              step={0.25}
              onValueChange={([value]) => setZoom(value)}
            />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" onClick={zoomIn}>
                <MagnifyingGlassPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>

          <span className="min-w-[3.5rem] text-center text-xs text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={resetZoom}
                className="ml-1"
              >
                <ArrowsOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset zoom</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  );
}
