/**
 * Generator UI State Machine
 *
 * View Modes:
 * - `idle`: No logo exists, chat is prominent, welcome state
 * - `generating`: AI is creating logo, loading state with progress
 * - `reviewing`: Logo exists, preview dominant, chat as sidebar
 *
 * State Transitions:
 * - idle → generating (user sends first message)
 * - generating → reviewing (logo generated)
 * - reviewing → generating (user requests changes)
 */

export type ViewMode = 'idle' | 'generating' | 'reviewing';

export interface GeneratorState {
  viewMode: ViewMode;
  svg: string | null;
  isLoading: boolean;
  hasMessages: boolean;
}

/**
 * Derive the current view mode from generator state
 */
export function deriveViewMode(state: {
  svg: string | null;
  isLoading: boolean;
}): ViewMode {
  const { svg, isLoading } = state;

  // If actively loading, show generating state
  if (isLoading) {
    return 'generating';
  }

  // If we have an SVG, show reviewing state
  if (svg) {
    return 'reviewing';
  }

  // No SVG and not loading = idle/welcome state
  return 'idle';
}

/**
 * Check if settings should be visible based on view mode
 * Settings are hidden by default, revealed contextually
 */
export function shouldShowSettings(viewMode: ViewMode): boolean {
  // Settings are hidden in idle state (focus on chat)
  // Settings can be toggled in reviewing state
  return viewMode === 'reviewing';
}

/**
 * Get layout configuration based on view mode
 */
export function getLayoutConfig(viewMode: ViewMode) {
  switch (viewMode) {
    case 'idle':
      return {
        layout: 'chat-centered' as const,
        showPreview: false,
        showSettings: false,
        chatPosition: 'center' as const,
      };
    case 'generating':
      return {
        layout: 'preview-focused' as const,
        showPreview: true,
        showSettings: false,
        chatPosition: 'right' as const,
      };
    case 'reviewing':
      return {
        layout: 'preview-dominant' as const,
        showPreview: true,
        showSettings: false, // Can be toggled
        chatPosition: 'right' as const,
      };
  }
}
