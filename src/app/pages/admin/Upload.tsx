'use client';

import { useState } from 'react';
import { UploadIcon, LinkIcon, ListBulletsIcon, CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react';

type Tab = 'file' | 'url' | 'batch';

type UploadResult = {
  success: boolean;
  id?: string;
  error?: string;
};

export function AdminUpload() {
  const [activeTab, setActiveTab] = useState<Tab>('file');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);

  // File upload state
  const [file, setFile] = useState<File | null>(null);

  // URL upload state
  const [url, setUrl] = useState('');

  // Batch upload state
  const [urls, setUrls] = useState('');

  const handleFileUpload = async () => {
    if (!file) return;

    setLoading(true);
    setResults([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/upload/file', {
        method: 'POST',
        body: formData,
      });
      const data = (await response.json()) as { id?: string; error?: string };
      setResults([{ success: response.ok, id: data.id, error: data.error }]);
    } catch (error) {
      setResults([{ success: false, error: String(error) }]);
    } finally {
      setLoading(false);
    }
  };

  const handleUrlUpload = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setResults([]);

    try {
      const response = await fetch('/api/admin/upload/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      setResults([{ success: response.ok, id: data.id, error: data.error }]);
    } catch (error) {
      setResults([{ success: false, error: String(error) }]);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchUpload = async () => {
    const urlList = urls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urlList.length === 0) return;

    setLoading(true);
    setResults([]);

    try {
      const response = await fetch('/api/admin/upload/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList }),
      });
      const data = (await response.json()) as {
        results?: UploadResult[];
        ids?: string[];
        error?: string;
      };
      setResults(
        data.results ||
          urlList.map((_, i) => ({
            success: response.ok,
            id: data.ids?.[i],
            error: data.error,
          }))
      );
    } catch (error) {
      setResults([{ success: false, error: String(error) }]);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'file' as Tab, label: 'Upload File', icon: UploadIcon },
    { id: 'url' as Tab, label: 'From URL', icon: LinkIcon },
    { id: 'batch' as Tab, label: 'Batch URLs', icon: ListBulletsIcon },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload SVGs</h1>
        <p className="text-muted-foreground mt-2">
          Upload SVG files to be indexed in the vector database.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'file' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".svg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <UploadIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              {file ? (
                <p className="text-foreground font-medium">{file.name}</p>
              ) : (
                <p className="text-muted-foreground">
                  Click or drag to upload an SVG file
                </p>
              )}
            </div>
            <button
              onClick={handleFileUpload}
              disabled={!file || loading}
              className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        )}

        {activeTab === 'url' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">SVG URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/logo.svg"
                className="w-full px-4 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleUrlUpload}
              disabled={!url.trim() || loading}
              className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Uploading...' : 'Upload from URL'}
            </button>
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                SVG URLs (one per line, max 100)
              </label>
              <textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder="https://example.com/logo1.svg&#10;https://example.com/logo2.svg&#10;https://example.com/logo3.svg"
                rows={10}
                className="w-full px-4 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
              />
            </div>
            <button
              onClick={handleBatchUpload}
              disabled={!urls.trim() || loading}
              className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Uploading...' : 'Upload Batch'}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Results</h3>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                  result.success
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-red-500/10 text-red-600'
                }`}
              >
                {result.success ? (
                  <CheckCircleIcon className="w-4 h-4" />
                ) : (
                  <XCircleIcon className="w-4 h-4" />
                )}
                <span>
                  {result.success
                    ? `Uploaded: ${result.id}`
                    : `Failed: ${result.error}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
