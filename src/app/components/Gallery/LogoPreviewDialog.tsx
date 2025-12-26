'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  DownloadSimple,
  ClockCounterClockwise,
  X,
} from '@phosphor-icons/react';
import { EXPORT_SIZES } from '@/lib/logo-constants';
import type { LogoDetail, VersionDetail } from '@/app/api/logos/handlers';

interface LogoPreviewDialogProps {
  logo: LogoDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (svg: string, name: string) => void;
}

export function LogoPreviewDialog({
  logo,
  open,
  onOpenChange,
  onExport,
}: LogoPreviewDialogProps) {
  const [selectedVersion, setSelectedVersion] = useState<VersionDetail | null>(
    logo.currentVersion
  );

  const handleExportPng = async (
    svg: string,
    name: string,
    size: { width: number; height: number }
  ) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size.width, size.height);

        const scale = Math.min(size.width / img.width, size.height / img.height);
        const x = (size.width - img.width * scale) / 2;
        const y = (size.height - img.height * scale) / 2;

        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${name.toLowerCase().replace(/\s+/g, '-')}-${size.width}x${size.height}.png`;
            a.click();
            URL.revokeObjectURL(url);
          }
        }, 'image/png');
      }
    };
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    img.src = URL.createObjectURL(svgBlob);
  };

  const version = selectedVersion || logo.currentVersion;

  if (!version) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-4xl">
        <AlertDialogHeader className="flex flex-row items-start justify-between">
          <div>
            <AlertDialogTitle>{logo.name}</AlertDialogTitle>
            {logo.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {logo.description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDialogHeader>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Preview */}
          <div className="md:col-span-2">
            <div className="relative aspect-square rounded-lg border bg-muted/30">
              {/* Checkered background */}
              <div
                className="absolute inset-0 opacity-30"
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
              <div className="relative flex h-full items-center justify-center p-8">
                <div
                  className="svg-container [&>svg]:max-h-[400px] [&>svg]:max-w-[400px]"
                  dangerouslySetInnerHTML={{ __html: version.svg }}
                />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Tabs defaultValue="export">
              <TabsList className="w-full">
                <TabsTrigger value="export" className="flex-1">
                  Export
                </TabsTrigger>
                <TabsTrigger value="versions" className="flex-1">
                  <ClockCounterClockwise className="mr-1 h-4 w-4" />
                  {logo.versions.length}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="export" className="mt-4 space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => onExport(version.svg, logo.name)}
                >
                  <DownloadSimple className="mr-2 h-4 w-4" />
                  Download SVG
                </Button>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    PNG Sizes
                  </p>
                  {EXPORT_SIZES.map((size) => (
                    <Button
                      key={size.label}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() =>
                        handleExportPng(version.svg, logo.name, {
                          width: size.width,
                          height: size.height,
                        })
                      }
                    >
                      <DownloadSimple className="mr-2 h-4 w-4" />
                      {size.label}
                    </Button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="versions" className="mt-4">
                <div className="max-h-[300px] space-y-2 overflow-y-auto">
                  {logo.versions.map((v, index) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVersion(v)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        v.id === version.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Version {logo.versions.length - index}
                        </span>
                        {v.id === logo.currentVersion?.id && (
                          <Badge variant="secondary">Current</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString()}
                      </p>
                      {v.iterations > 1 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {v.iterations} iterations
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {/* Config Info */}
            <div className="rounded-lg border p-3">
              <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                Configuration
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="capitalize">{version.config.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shape</span>
                  <span className="capitalize">{version.config.shape}</span>
                </div>
                {version.config.theme && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Theme</span>
                    <span className="capitalize">{version.config.theme}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Colors</span>
                  <div className="flex gap-1">
                    <div
                      className="h-4 w-4 rounded border"
                      style={{ backgroundColor: version.config.colors.primary }}
                      title={version.config.colors.primary}
                    />
                    <div
                      className="h-4 w-4 rounded border"
                      style={{ backgroundColor: version.config.colors.accent }}
                      title={version.config.colors.accent}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
