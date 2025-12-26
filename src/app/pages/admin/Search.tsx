'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';

export function AdminSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 20 }),
      });
      const data = (await response.json()) as { results?: any[] };
      setResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Vector Search</h1>
        <p className="text-muted-foreground mt-2">
          Search the ChromaDB vector index for similar logos.
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search for logos (e.g., 'modern tech abstract blue')"
            className="w-full px-4 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <MagnifyingGlassIcon className="w-4 h-4" />
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((result: any, index: number) => (
            <div
              key={result.id || index}
              className="p-4 rounded-lg border border-border bg-card"
            >
              <div className="aspect-square bg-muted rounded-md mb-3 flex items-center justify-center">
                {result.svg_url ? (
                  <img
                    src={result.svg_url}
                    alt={result.name || 'Logo'}
                    className="w-full h-full object-contain p-4"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">No preview</span>
                )}
              </div>
              <p className="font-medium truncate">{result.name || 'Untitled'}</p>
              <p className="text-sm text-muted-foreground">
                Score: {(result.similarity * 100).toFixed(1)}%
              </p>
              {result.theme && (
                <p className="text-xs text-muted-foreground mt-1">
                  {result.logo_type} / {result.theme}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[300px] rounded-lg border border-dashed border-border">
          <div className="text-center">
            <MagnifyingGlassIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Enter a search query to find similar logos in the vector index.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
