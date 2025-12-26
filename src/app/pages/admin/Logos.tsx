'use client';

import { useState, useEffect } from 'react';
import { ImagesIcon, PencilIcon, TrashIcon } from '@phosphor-icons/react';

type Logo = {
  id: string;
  name: string;
  logo_type: string;
  theme: string;
  shape: string;
  primary_color: string;
  accent_color: string;
  description: string;
};

export function AdminLogos() {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchLogos();
  }, [page]);

  const fetchLogos = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/logos?limit=${limit}&offset=${page * limit}`);
      const data = (await response.json()) as { logos?: Logo[] };
      setLogos(data.logos || []);
    } catch (error) {
      console.error('Failed to fetch logos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this logo?')) return;

    try {
      await fetch(`/api/admin/logos/${id}`, { method: 'DELETE' });
      setLogos(logos.filter((l) => l.id !== id));
    } catch (error) {
      console.error('Failed to delete logo:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Logo Management</h1>
        <p className="text-muted-foreground mt-2">
          View and manage logos in the vector index.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading logos...</p>
        </div>
      ) : logos.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {logos.map((logo) => (
              <div
                key={logo.id}
                className="p-4 rounded-lg border border-border bg-card group"
              >
                <div className="aspect-square bg-muted rounded-md mb-3 flex items-center justify-center relative">
                  <ImagesIcon className="w-12 h-12 text-muted-foreground" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      className="p-2 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => handleDelete(logo.id)}
                      className="p-2 rounded-md bg-red-500/50 hover:bg-red-500/70 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
                <p className="font-medium truncate">{logo.name || 'Untitled'}</p>
                <p className="text-sm text-muted-foreground">
                  {logo.logo_type} / {logo.theme}
                </p>
                <div className="flex gap-1 mt-2">
                  {logo.primary_color && (
                    <div
                      className="w-4 h-4 rounded-full border border-border"
                      style={{ backgroundColor: logo.primary_color }}
                      title={logo.primary_color}
                    />
                  )}
                  {logo.accent_color && (
                    <div
                      className="w-4 h-4 rounded-full border border-border"
                      style={{ backgroundColor: logo.accent_color }}
                      title={logo.accent_color}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-2 rounded-md border border-input hover:bg-accent disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2">Page {page + 1}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={logos.length < limit}
              className="px-4 py-2 rounded-md border border-input hover:bg-accent disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center min-h-[400px] rounded-lg border border-dashed border-border">
          <div className="text-center">
            <ImagesIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No logos in the index yet. Upload some SVGs to get started.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
