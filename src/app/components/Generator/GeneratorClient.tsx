'use client';

import { useState, useCallback } from 'react';
import { useChat } from '@tanstack/ai-react';
import { TooltipProvider } from '@/components/ui/tooltip';

import type { LogoConfig } from '@/lib/logo-types';
import { DEFAULT_LOGO_CONFIG } from '@/lib/logo-constants';
import { deriveViewMode } from '@/lib/generator-state';

import { IdleView } from './IdleView';
import { GeneratingView } from './GeneratingView';
import { ReviewingView } from './ReviewingView';

export function GeneratorClient() {
  const [config, setConfig] = useState<LogoConfig>(DEFAULT_LOGO_CONFIG);
  const [svg, setSvg] = useState<string | null>(null);
  const [versions, setVersions] = useState<
    { id: string; svg: string; timestamp: Date }[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ReturnType<typeof useChat>['messages']>([]);

  // Derive view mode from state
  const viewMode = deriveViewMode({ svg, isLoading });

  const handleLogoGenerated = useCallback((newSvg: string) => {
    setSvg(newSvg);
    setVersions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), svg: newSvg, timestamp: new Date() },
    ]);
  }, []);

  const handleSelectVersion = useCallback(
    (id: string) => {
      const version = versions.find((v) => v.id === id);
      if (version) {
        setSvg(version.svg);
      }
    },
    [versions]
  );

  const handleDeleteVersion = useCallback(
    (id: string) => {
      setVersions((prev) => prev.filter((v) => v.id !== id));
    },
    []
  );

  const handleConfigChange = useCallback(
    <K extends keyof LogoConfig>(key: K, value: LogoConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleColorChange = useCallback(
    (colorKey: 'primary' | 'accent', value: string) => {
      setConfig((prev) => ({
        ...prev,
        colors: { ...prev.colors, [colorKey]: value },
      }));
    },
    []
  );

  const handleApplyPreset = useCallback((preset: Partial<LogoConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...preset,
      colors: preset.colors ? { ...prev.colors, ...preset.colors } : prev.colors,
      typography: preset.typography
        ? { ...prev.typography, ...preset.typography }
        : prev.typography,
    }));
  }, []);

  const handleSaveLogo = useCallback(
    async (name: string, description: string) => {
      if (!svg) return;

      setIsSaving(true);
      try {
        const response = await fetch('/api/logos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description: description || undefined,
            svg,
            config,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save logo');
        }
      } catch (error) {
        console.error('Error saving logo:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [svg, config]
  );

  const handleMessagesChange = useCallback((newMessages: typeof messages) => {
    setMessages(newMessages);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  return (
    <TooltipProvider>
      <div className="relative">
        {/* Idle View */}
        <div
          className={`transition-all duration-500 ease-out ${
            viewMode === 'idle'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4 pointer-events-none absolute inset-0'
          }`}
        >
          {(viewMode === 'idle' || viewMode === 'generating') && (
            <IdleView
              onLogoGenerated={handleLogoGenerated}
              config={config}
              onMessagesChange={handleMessagesChange}
              onLoadingChange={handleLoadingChange}
            />
          )}
        </div>

        {/* Generating View */}
        <div
          className={`transition-all duration-500 ease-out ${
            viewMode === 'generating'
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-95 pointer-events-none absolute inset-0'
          }`}
        >
          {viewMode === 'generating' && (
            <GeneratingView messages={messages} />
          )}
        </div>

        {/* Reviewing View */}
        <div
          className={`transition-all duration-500 ease-out ${
            viewMode === 'reviewing'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-4 pointer-events-none absolute inset-0'
          }`}
        >
          {viewMode === 'reviewing' && svg && (
            <ReviewingView
              svg={svg}
              onLogoGenerated={handleLogoGenerated}
              config={config}
              onConfigChange={handleConfigChange}
              onColorChange={handleColorChange}
              onApplyPreset={handleApplyPreset}
              versions={versions}
              onSelectVersion={handleSelectVersion}
              onDeleteVersion={handleDeleteVersion}
              onSaveLogo={handleSaveLogo}
              isSaving={isSaving}
              initialMessages={messages}
              initialIsLoading={isLoading}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
