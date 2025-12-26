'use client';

import { useState, useCallback } from 'react';

import { Card } from '@/components/ui/card';
import type { LogoConfig, LogoType, LogoShape, LogoTheme } from '@/lib/logo-types';
import { DEFAULT_LOGO_CONFIG, LOGO_TYPES, LOGO_SHAPES, LOGO_THEMES } from '@/lib/logo-constants';

import { FeedbackChat } from '../FeedbackChat';
import { PreviewCanvas } from './PreviewCanvas';
import { ConfigPanel } from './ConfigPanel';

export function GeneratorClient() {
  const [config, setConfig] = useState<LogoConfig>(DEFAULT_LOGO_CONFIG);
  const [svg, setSvg] = useState<string | null>(null);
  const [versions, setVersions] = useState<
    { id: string; svg: string; timestamp: Date }[]
  >([]);

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

  return (
    <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Panel - Configuration */}
      <div className="lg:col-span-3">
        <Card className="h-full overflow-y-auto p-4">
          <ConfigPanel
            config={config}
            onConfigChange={handleConfigChange}
            onColorChange={handleColorChange}
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
  );
}
