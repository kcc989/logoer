'use client';

import { useState, useCallback } from 'react';

interface PreviewCanvasProps {
  svg: string | null;
  isLoading: boolean;
  versions: { id: string; svg: string; timestamp: Date }[];
  onSelectVersion: (id: string) => void;
}

export function PreviewCanvas({
  svg,
  isLoading,
  versions,
  onSelectVersion,
}: PreviewCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [showVersions, setShowVersions] = useState(false);

  const handleExport = useCallback(
    async (format: 'svg' | 'png') => {
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
        // Convert SVG to PNG via canvas
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width * 2;
          canvas.height = img.height * 2;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'logo.png';
                a.click();
                URL.revokeObjectURL(url);
              }
            }, 'image/png');
          }
        };
        img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
      }
    },
    [svg]
  );

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Preview</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('svg')}
            disabled={!svg}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            Export SVG
          </button>
          <button
            onClick={() => handleExport('png')}
            disabled={!svg}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            Export PNG
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30">
        {isLoading ? (
          <div className="text-center text-muted-foreground">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="font-medium">Agent is designing your logo...</p>
          </div>
        ) : svg ? (
          <div
            className="flex items-center justify-center transition-transform"
            style={{ transform: `scale(${zoom})` }}
          >
            <div
              className="svg-container"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
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

      {/* Bottom controls */}
      <div className="mt-4 flex items-center justify-between">
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            className="rounded-md border border-input px-3 py-1 text-sm hover:bg-accent"
          >
            -
          </button>
          <span className="min-w-[4rem] text-center text-sm">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            className="rounded-md border border-input px-3 py-1 text-sm hover:bg-accent"
          >
            +
          </button>
        </div>

        {/* Version toggle */}
        {versions.length > 0 && (
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="rounded-md border border-input px-3 py-1 text-sm hover:bg-accent"
          >
            {versions.length} version{versions.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Versions panel */}
      {showVersions && versions.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto rounded-lg border border-border bg-muted/30 p-2">
          {versions.map((version) => (
            <button
              key={version.id}
              onClick={() => onSelectVersion(version.id)}
              className="flex-shrink-0 rounded border border-border bg-white p-2 hover:border-primary"
            >
              <div
                className="h-16 w-16"
                dangerouslySetInnerHTML={{ __html: version.svg }}
              />
              <p className="mt-1 text-center text-xs text-muted-foreground">
                {version.timestamp.toLocaleTimeString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
