'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Trash,
  Eye,
  DownloadSimple,
  PencilSimple,
} from '@phosphor-icons/react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { LogoPreviewDialog } from './LogoPreviewDialog';
import type { LogoListItem, LogoDetail } from '@/app/api/logos/handlers';

export function GalleryClient() {
  const [logos, setLogos] = useState<LogoListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<LogoDetail | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const fetchLogos = useCallback(async () => {
    try {
      const response = await fetch('/api/logos');
      if (!response.ok) {
        throw new Error('Failed to fetch logos');
      }
      const data = await response.json();
      setLogos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogos();
  }, [fetchLogos]);

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/logos/${deleteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete logo');
      }

      setLogos((prev) => prev.filter((logo) => logo.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      console.error('Error deleting logo:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePreview = async (id: string) => {
    setIsLoadingPreview(true);
    try {
      const response = await fetch(`/api/logos/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch logo details');
      }
      const data = await response.json();
      setPreviewLogo(data);
    } catch (err) {
      console.error('Error fetching logo:', err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleExportSvg = (svg: string, name: string) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase().replace(/\s+/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchLogos} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  if (logos.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-12 text-center">
        <div className="mx-auto max-w-sm">
          <svg
            className="mx-auto mb-4 h-12 w-12 text-muted-foreground"
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
          <h3 className="mb-2 font-semibold text-foreground">No logos yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Start creating logos to build your gallery
          </p>
          <a
            href="/generator"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Your First Logo
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {logos.map((logo) => (
          <Card key={logo.id} className="group overflow-hidden">
            {/* Preview Area */}
            <div className="relative aspect-square bg-muted/30">
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
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              />

              {/* Logo thumbnail - we'll need to fetch or store this */}
              <div className="relative flex h-full items-center justify-center p-4">
                <button
                  onClick={() => handlePreview(logo.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-8 w-8" />
                </button>
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => handlePreview(logo.id)}
                  disabled={isLoadingPreview}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  onClick={() => setDeleteId(logo.id)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="truncate font-medium text-foreground">
                {logo.name}
              </h3>
              {logo.description && (
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {logo.description}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(logo.createdAt).toLocaleDateString()}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Logo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this logo? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      {previewLogo && (
        <LogoPreviewDialog
          logo={previewLogo}
          open={!!previewLogo}
          onOpenChange={(open) => !open && setPreviewLogo(null)}
          onExport={handleExportSvg}
        />
      )}
    </>
  );
}
