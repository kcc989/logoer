'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LogoConfig, LogoType, LogoShape, LogoTheme } from '@/lib/logo-types';
import {
  LOGO_TYPES,
  LOGO_SHAPES,
  LOGO_THEMES,
  THEME_PRESETS,
  INDUSTRY_PRESETS,
  type Industry,
} from '@/lib/logo-constants';

interface ConfigPanelProps {
  config: LogoConfig;
  onConfigChange: <K extends keyof LogoConfig>(key: K, value: LogoConfig[K]) => void;
  onColorChange: (colorKey: 'primary' | 'accent', value: string) => void;
  onApplyPreset?: (preset: Partial<LogoConfig>) => void;
}

export function ConfigPanel({
  config,
  onConfigChange,
  onColorChange,
  onApplyPreset,
}: ConfigPanelProps) {
  const handleIndustrySelect = (industry: Industry) => {
    const preset = INDUSTRY_PRESETS.find((p) => p.value === industry);
    if (preset && onApplyPreset) {
      onApplyPreset(preset.config);
    } else if (preset) {
      // Apply each config value individually
      if (preset.config.type) onConfigChange('type', preset.config.type);
      if (preset.config.theme) onConfigChange('theme', preset.config.theme);
      if (preset.config.shape) onConfigChange('shape', preset.config.shape);
      if (preset.config.colors) {
        onColorChange('primary', preset.config.colors.primary);
        onColorChange('accent', preset.config.colors.accent);
      }
    }
  };

  const handleThemeSelect = (theme: LogoTheme) => {
    onConfigChange('theme', theme);
    const preset = THEME_PRESETS[theme];
    if (preset) {
      onColorChange('primary', preset.primary);
      onColorChange('accent', preset.accent);
      onConfigChange('typography', {
        ...config.typography,
        letterSpacing: preset.letterSpacing,
        fontWeight: preset.fontWeight,
      });
    }
  };

  return (
    <ScrollArea className="h-full">
      <h2 className="mb-4 font-semibold">Configuration</h2>

      <Tabs defaultValue="presets">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="presets" className="flex-1">
            Presets
          </TabsTrigger>
          <TabsTrigger value="style" className="flex-1">
            Style
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex-1">
            Colors
          </TabsTrigger>
        </TabsList>

        {/* Presets Tab */}
        <TabsContent value="presets" className="space-y-4">
          {/* Industry Presets */}
          <div>
            <Label className="mb-2 block text-sm font-medium">
              Industry Preset
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {INDUSTRY_PRESETS.map((industry) => (
                <Button
                  key={industry.value}
                  variant="outline"
                  size="sm"
                  className="h-auto flex-col items-start p-2 text-left"
                  onClick={() => handleIndustrySelect(industry.value)}
                >
                  <span className="text-xs font-medium">{industry.label}</span>
                  <span className="text-[10px] text-muted-foreground line-clamp-1">
                    {industry.description}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Theme Presets */}
          <div>
            <Label className="mb-2 block text-sm font-medium">Theme</Label>
            <div className="grid grid-cols-2 gap-2">
              {LOGO_THEMES.map((theme) => {
                const preset = THEME_PRESETS[theme.value];
                return (
                  <Button
                    key={theme.value}
                    variant={config.theme === theme.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-auto justify-start gap-2 p-2"
                    onClick={() => handleThemeSelect(theme.value)}
                  >
                    <div className="flex gap-0.5">
                      <div
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <div
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: preset.accent }}
                      />
                    </div>
                    <span className="text-xs">{theme.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Style Tab */}
        <TabsContent value="style" className="space-y-4">
          {/* Logo Type */}
          <div>
            <Label className="mb-2 block text-sm font-medium">Logo Type</Label>
            <div className="space-y-1.5">
              {LOGO_TYPES.map((type) => (
                <Button
                  key={type.value}
                  variant={config.type === type.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-auto w-full justify-start p-2 text-left"
                  onClick={() => onConfigChange('type', type.value)}
                >
                  <div>
                    <div className="text-xs font-medium">{type.label}</div>
                    <div className="text-[10px] opacity-70">
                      {type.description}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Shape */}
          <div>
            <Label className="mb-2 block text-sm font-medium">Shape</Label>
            <div className="grid grid-cols-3 gap-2">
              {LOGO_SHAPES.map((shape) => (
                <Button
                  key={shape.value}
                  variant={config.shape === shape.value ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => onConfigChange('shape', shape.value)}
                >
                  {shape.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Brand Text */}
          <div>
            <Label className="mb-2 block text-sm font-medium">Brand Name</Label>
            <input
              type="text"
              value={config.text}
              onChange={(e) => onConfigChange('text', e.target.value)}
              placeholder="ACME"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Typography Settings */}
          <div>
            <Label className="mb-2 block text-sm font-medium">
              Letter Spacing: {config.typography.letterSpacing}px
            </Label>
            <Slider
              value={[config.typography.letterSpacing]}
              min={0}
              max={20}
              step={1}
              onValueChange={([value]) =>
                onConfigChange('typography', {
                  ...config.typography,
                  letterSpacing: value,
                })
              }
            />
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium">
              Font Size: {config.typography.fontSize}px
            </Label>
            <Slider
              value={[config.typography.fontSize]}
              min={24}
              max={96}
              step={4}
              onValueChange={([value]) =>
                onConfigChange('typography', {
                  ...config.typography,
                  fontSize: value,
                })
              }
            />
          </div>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-4">
          {/* Primary Color */}
          <div>
            <Label className="mb-2 block text-sm font-medium">
              Primary Color
            </Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={config.colors.primary}
                onChange={(e) => onColorChange('primary', e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-input"
              />
              <input
                type="text"
                value={config.colors.primary}
                onChange={(e) => onColorChange('primary', e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <Label className="mb-2 block text-sm font-medium">
              Accent Color
            </Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={config.colors.accent}
                onChange={(e) => onColorChange('accent', e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-input"
              />
              <input
                type="text"
                value={config.colors.accent}
                onChange={(e) => onColorChange('accent', e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          {/* Color Swatches from Theme */}
          <div>
            <Label className="mb-2 block text-sm font-medium">
              Quick Colors
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(THEME_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border border-input p-1 hover:border-primary"
                  onClick={() => {
                    onColorChange('primary', preset.primary);
                    onColorChange('accent', preset.accent);
                  }}
                  title={key}
                >
                  <div
                    className="h-4 w-4 rounded-sm"
                    style={{ backgroundColor: preset.primary }}
                  />
                  <div
                    className="h-4 w-4 rounded-sm"
                    style={{ backgroundColor: preset.accent }}
                  />
                </button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </ScrollArea>
  );
}
