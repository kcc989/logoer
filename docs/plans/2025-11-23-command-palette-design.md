# Command Palette Design

**Date:** 2025-11-23
**Status:** Approved

## Overview

Implement a globally accessible command palette (similar to Linear) that provides quick access to actions, navigation, and search throughout the authenticated user experience.

## Requirements

- Globally accessible from any logged-in page
- Triggered via keyboard shortcut (Cmd+K / Ctrl+K) OR via button clicks
- Three types of commands:
  - **Actions**: Show inline forms (e.g., Create List, Create Task)
  - **Navigation**: Navigate to pages (e.g., Go to Lists, Go to Settings)
  - **Search**: Find and navigate to specific items (future)
- Button clicks skip command selection and open directly to forms
- Start with minimal scope: "Create List" and "Go to Lists"

## Architecture

### Compound Components Pattern

Use a context provider pattern with modular view components:

```
<CommandPaletteProvider>
  {/* App content */}
  <CommandPalette />
</CommandPaletteProvider>
```

### Core Components

1. **CommandPaletteProvider**
   - Wraps app in app-layout component
   - Provides global state via context
   - Handles keyboard shortcut listener

2. **useCommandPalette() hook**
   - Exposes: `open(view?)`, `close()`, `setView(view)`
   - Usage: `open()` opens to command list, `open('create-list')` opens to form

3. **CommandPalette component**
   - Dialog that renders based on context state
   - Manages view routing (commands list vs specific forms)
   - Includes back button when in a view

4. **View components**
   - `CommandList`: Shows available commands
   - `CreateListForm`: Inline form for creating lists
   - Future: `CreateTaskForm`, search views, etc.

### State Management

Context state:
```typescript
{
  isOpen: boolean
  currentView: string | null  // 'commands' | 'create-list' | etc.
  open: (view?: string) => void
  close: () => void
  setView: (view: string) => void
}
```

### Command Structure

```typescript
type Command = {
  id: string              // 'create-list', 'go-to-lists'
  label: string           // "Create List"
  icon?: ReactNode        // Optional icon
  keywords?: string[]     // For search filtering
  action: () => void      // What happens when selected
  group?: string          // 'actions', 'navigation', 'search'
}
```

Example commands:
```typescript
[
  {
    id: 'create-list',
    label: 'Create List',
    group: 'actions',
    keywords: ['new', 'add'],
    action: () => setView('create-list')
  },
  {
    id: 'go-to-lists',
    label: 'Go to Lists',
    group: 'navigation',
    keywords: ['navigate', 'view'],
    action: () => {
      window.location.href = '/lists'
      close()
    }
  }
]
```

## User Flows

### Flow 1: Keyboard Shortcut → Command → Action
1. User presses Cmd+K
2. Palette opens showing CommandList
3. User selects "Create List"
4. Form appears inline in palette
5. User fills form and submits
6. API call completes, palette closes

### Flow 2: Button Click → Direct to Form
1. User clicks "Create List" button
2. `open('create-list')` is called
3. Palette opens directly to CreateListForm (skips command list)
4. User fills form and submits
5. API call completes, palette closes

### Flow 3: Keyboard Shortcut → Command → Navigation
1. User presses Cmd+K
2. Palette opens showing CommandList
3. User selects "Go to Lists"
4. `window.location.href = '/lists'` executes
5. Palette closes
6. Page navigates

## Implementation Details

### Global Setup

Mount in app-layout component:
```tsx
import { CommandPaletteProvider, CommandPalette } from '@/components/command-palette'

export default function AppLayout({ children }) {
  return (
    <CommandPaletteProvider>
      {children}
      <CommandPalette />
    </CommandPaletteProvider>
  )
}
```

### Keyboard Shortcut

In CommandPaletteProvider:
```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setIsOpen(true)
      setCurrentView('commands')
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

### Form Components

Use existing UI components from `components/ui`:
- Button
- Field
- Input
- Dialog
- Command (shadcn/ui command component)

Example form structure:
```tsx
function CreateListForm() {
  const { close } = useCommandPalette()
  const [name, setName] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    await fetch('/api/lists', {
      method: 'POST',
      body: JSON.stringify({ name })
    })
    close()
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="List name">
        <Input value={name} onChange={...} autoFocus />
      </Field>
      <Button type="submit" disabled={!name}>
        Create List
      </Button>
    </form>
  )
}
```

### Navigation

Use `window.location.href` for navigation (not Next.js router):
```tsx
window.location.href = '/lists'
```

## V1 Scope

**Commands to implement:**
1. Create List (action → inline form)
2. Go to Lists (navigation → redirect)

**Future additions:**
- Create Task
- Search tasks/lists
- Go to Settings
- More navigation commands
- Keyboard shortcuts display

## Technical Considerations

- Dialog component from shadcn/ui handles overlay, focus trap, ESC key
- Command component handles search/filtering of command list
- Forms validate using existing Zod schemas (createListInputSchema)
- API calls to existing endpoints
- Toast notifications for success/error feedback (optional for v1)
- Form state resets when palette closes

## Success Criteria

- User can open palette with Cmd+K from any page
- User can create a list through the palette
- User can navigate to lists page through the palette
- Button clicks can trigger palette with specific forms
- Palette is accessible and keyboard-navigable
- UI matches existing design system
