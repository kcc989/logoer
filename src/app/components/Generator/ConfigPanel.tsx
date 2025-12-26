'use client';

import type { LogoConfig, LogoType, LogoShape, LogoTheme } from '@/lib/logo-types';
import { LOGO_TYPES, LOGO_SHAPES, LOGO_THEMES } from '@/lib/logo-constants';

interface ConfigPanelProps {
  config: LogoConfig;
  onConfigChange: <K extends keyof LogoConfig>(key: K, value: LogoConfig[K]) => void;
  onColorChange: (colorKey: 'primary' | 'accent', value: string) => void;
}

export function ConfigPanel({
  config,
  onConfigChange,
  onColorChange,
}: ConfigPanelProps) {
  return (
    <>
      <h2 className="mb-4 font-semibold">Configuration</h2>

      <div className="space-y-4">
        {/* Logo Type */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Logo Type
          </label>
          <select
            value={config.type}
            onChange={(e) => onConfigChange('type', e.target.value as LogoType)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {LOGO_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Theme */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Theme
          </label>
          <select
            value={config.theme || 'modern'}
            onChange={(e) =>
              onConfigChange('theme', e.target.value as LogoTheme)
            }
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {LOGO_THEMES.map((theme) => (
              <option key={theme.value} value={theme.value}>
                {theme.label}
              </option>
            ))}
          </select>
        </div>

        {/* Shape */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Shape
          </label>
          <select
            value={config.shape}
            onChange={(e) =>
              onConfigChange('shape', e.target.value as LogoShape)
            }
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {LOGO_SHAPES.map((shape) => (
              <option key={shape.value} value={shape.value}>
                {shape.label}
              </option>
            ))}
          </select>
        </div>

        {/* Brand Text */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Brand Name
          </label>
          <input
            type="text"
            value={config.text}
            onChange={(e) => onConfigChange('text', e.target.value)}
            placeholder="ACME"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Primary Color */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Primary Color
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="color"
              value={config.colors.primary}
              onChange={(e) => onColorChange('primary', e.target.value)}
              className="h-9 w-12 rounded border border-input"
            />
            <input
              type="text"
              value={config.colors.primary}
              onChange={(e) => onColorChange('primary', e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Accent Color */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Accent Color
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="color"
              value={config.colors.accent}
              onChange={(e) => onColorChange('accent', e.target.value)}
              className="h-9 w-12 rounded border border-input"
            />
            <input
              type="text"
              value={config.colors.accent}
              onChange={(e) => onColorChange('accent', e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
    </>
  );
}
