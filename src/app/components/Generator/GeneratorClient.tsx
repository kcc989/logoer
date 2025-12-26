'use client';

import { useState, useCallback } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

import { Card } from '@/components/ui/card';
import type { LogoConfig } from '@/lib/logo-types';
import { DEFAULT_LOGO_CONFIG } from '@/lib/logo-constants';

import { FeedbackChat } from '../FeedbackChat';
import { PreviewCanvas } from './PreviewCanvas';
import { ConfigPanel } from './ConfigPanel';
import { VersionHistory } from './VersionHistory';
import { SaveLogoDialog } from './SaveLogoDialog';

export function GeneratorClient() {
  const [config, setConfig] = useState<LogoConfig>(DEFAULT_LOGO_CONFIG);
  const [svg, setSvg] = useState<string | null>(null);
  const [versions, setVersions] = useState<
    { id: string; svg: string; timestamp: Date }[]
  >([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

        setShowSaveDialog(false);
      } catch (error) {
        console.error('Error saving logo:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [svg, config]
  );

  return (
    <TooltipProvider>
      <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Panel - Configuration */}
        <div className="lg:col-span-3">
          <Card className="h-full overflow-hidden p-4">
            <ConfigPanel
              config={config}
              onConfigChange={handleConfigChange}
              onColorChange={handleColorChange}
              onApplyPreset={handleApplyPreset}
            />
          </Card>
        </div>

        {/* Center Panel - Preview Canvas */}
        <div className="lg:col-span-6">
          <Card className="flex h-full flex-col p-4">
            <PreviewCanvas
              svg={svg}
              isLoading={false}
              versions={versions}
              onSelectVersion={handleSelectVersion}
              onToggleVersions={() => setShowVersionHistory(true)}
              onSave={() => setShowSaveDialog(true)}
              isSaving={isSaving}
            />
          </Card>
        </div>

        {/* Right Panel - Chat */}
        <div className="lg:col-span-3">
          <Card className="h-full p-4">
            <FeedbackChat onLogoGenerated={handleLogoGenerated} config={config} />
          </Card>
        </div>
      </div>

      {/* Version History Sidebar */}
      <VersionHistory
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        versions={versions}
        currentSvg={svg}
        onSelectVersion={handleSelectVersion}
        onDeleteVersion={handleDeleteVersion}
      />

      {/* Save Logo Dialog */}
      <SaveLogoDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSaveLogo}
        isSaving={isSaving}
      />
    </TooltipProvider>
  );
}
