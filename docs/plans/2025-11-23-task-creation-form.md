# Task Creation Form Design

**Date:** 2025-11-23
**Status:** Approved

## Overview

Implement a comprehensive Linear-style task creation form in the command palette with reusable field selection components. This form will support all task fields with an emphasis on reusability for future forms and features.

## Requirements

### Required Fields
- **Title** - Text input, must be non-empty
- **List** - Dropdown selector, must select a list before submission

### Optional Fields
- **Description** - WYSIWYG markdown editor
- **Status** - Dropdown (defaults to 'backlog')
- **Stress Level** - 1-10 scale selector
- **Due Date** - Date picker with timezone
- **Assignee** - Dropdown of list members
- **Labels** - Multi-select label picker

### Deferred to Future
- Recurring tasks
- Dynamic label creation

## Architecture

### Component Hierarchy

```
CreateTaskForm (main form container)
├── TitleInput (always visible)
├── MarkdownEditor (WYSIWYG description)
└── FieldToolbar (bottom bar with field buttons)
    ├── StatusButton → StatusSelector
    ├── ListButton → ListSelector
    ├── StressLevelButton → StressLevelSelector
    ├── DueDateButton → DueDatePicker
    ├── AssigneeButton → AssigneeSelector
    └── LabelsButton → LabelSelector
```

### Reusable Field Components

Each field follows a consistent pattern with two parts:

1. **Field Button Component** - Shows current value, triggers selector
2. **Field Selector Component** - The actual selection UI (dropdown/popover/etc.)

Pattern:
```tsx
<FieldButton value={currentValue} onClick={toggle}>
  <FieldSelector
    value={currentValue}
    onChange={setValue}
    isOpen={isOpen}
  />
</FieldButton>
```

All reusable components will be located in `src/components/task-fields/` for use across the application.

## Component Details

### StatusSelector
- Dropdown with 4 options: Backlog, Todo, In Progress, Done
- Uses `taskStatusSchema` values: 'backlog', 'todo', 'in_progress', 'done'
- Visual indicators (colors/icons) for each status
- Built with shadcn/ui Select or Command component

### ListSelector (Required)
- Dropdown showing user's lists
- Fetches lists via `fetchLists` from `@/queries/lists`
- Shows list name with icon/color
- Filterable/searchable if many lists exist
- When list changes, reloads assignee options (members of new list)
- Required field - blocks submission until selected

### StressLevelSelector
- Scale selector displaying 1-10 options
- Visual representation with color coding:
  - 1-3: Low stress (green)
  - 4-6: Medium stress (yellow)
  - 7-10: High stress (red)
- Can be implemented as buttons, slider, or dropdown
- Includes "Clear" option to remove stress level

### DueDatePicker
- Date picker using shadcn/ui Calendar or similar component
- Stores as Unix timestamp with timezone
- Shows formatted date in button ("Today", "Tomorrow", "Jan 15", etc.)
- Includes "Clear" option (field is optional)
- Automatically captures browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`

### AssigneeSelector
- Dropdown of list members
- Fetches members based on currently selected list
- Shows user avatar + name
- Includes "Unassigned" option (null value)
- Disabled until list is selected
- Resets when list changes

### LabelSelector
- Multi-select dropdown/popover
- Shows existing labels as chips/badges
- Supports multiple label selection
- Button shows selected count ("3 labels" or "No labels")
- Dynamic label creation deferred to future version

### MarkdownEditor
- WYSIWYG markdown editor for task description
- Recommended library: **Tiptap** (headless, flexible, good React support)
- Alternatives: Novel.sh (Notion-like), react-md-editor (simpler)
- Supports basic formatting: bold, italic, lists, links, headings
- Shows WYSIWYG editing mode

## Data Flow & State Management

### Form State

The `CreateTaskForm` manages all field values in local component state:

```tsx
const [title, setTitle] = useState('')
const [description, setDescription] = useState('')
const [status, setStatus] = useState<TaskStatus>('backlog')
const [listId, setListId] = useState<string | null>(null)
const [stressLevel, setStressLevel] = useState<number | null>(null)
const [dueDate, setDueDate] = useState<number | null>(null)
const [dueDateTimezone, setDueDateTimezone] = useState<string>(
  Intl.DateTimeFormat().resolvedOptions().timeZone
)
const [assignedToUserId, setAssignedToUserId] = useState<string | null>(null)
const [labelIds, setLabelIds] = useState<string[]>([])
```

### Validation Flow

**Client-side validation:**
1. Required fields check: `title` and `listId` must be present
2. Use `createTaskInputSchema.safeParse()` before submission
3. Show inline errors for invalid fields
4. Disable submit button when required fields are missing

**Submission flow:**
1. Validate all fields with updated Zod schema
2. POST to `/api/tasks` endpoint with JSON body
3. Close command palette on success
4. Show error message inline on failure
5. Optional: Navigate to task detail or refresh task list

### Data Dependencies

**List → Assignee relationship:**
- When `listId` changes, fetch members of the newly selected list
- Reset `assignedToUserId` to null when list changes
- Keep AssigneeSelector disabled until list is selected

**Labels:**
- Fetch all available labels (not filtered by list for V1)
- Future: Could filter labels by list or workspace

**Timezone:**
- Auto-detect browser timezone on component mount
- Update `dueDateTimezone` if user changes date (keep in sync)

## Implementation Details

### Schema Updates

Update `src/schemas/tasks.ts` to make due date optional and add listId:

```typescript
export const createTaskInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: taskStatusSchema.optional().default('backlog'),
  stressLevel: z.number().int().min(1).max(10).nullable().optional(),
  dueDate: z.number().int().nullable().optional(), // ← Changed from required
  dueDateTimezone: z.string().optional(), // ← Changed from required
  assignedToUserId: z.string().nullable().optional(),
  recurringTaskId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  listId: z.string(), // ← Add as required field
});
```

### File Structure

```
src/components/task-fields/
├── status-selector.tsx          # Status dropdown (backlog/todo/in_progress/done)
├── list-selector.tsx            # List picker (required)
├── stress-level-selector.tsx    # 1-10 stress level scale
├── due-date-picker.tsx          # Date picker with timezone
├── assignee-selector.tsx        # List member picker
├── label-selector.tsx           # Multi-select labels
└── markdown-editor.tsx          # WYSIWYG description editor

src/components/command-palette/
└── create-task-form.tsx         # Main form using all field components
```

### Component Organization

**Reusable components** (`src/components/task-fields/`):
- Generic, composable field components
- Accept value/onChange props
- Can be used in any form (task creation, task editing, quick actions)
- Export both Button and Selector variants when applicable

**Form-specific logic** (`src/components/command-palette/create-task-form.tsx`):
- Form state management
- Validation logic
- Submission handling
- Field composition and layout

### Third-Party Libraries

**Markdown Editor:**
- **Recommended:** Tiptap - Headless editor with excellent React support
- Alternatives: Novel.sh (Notion-like), react-md-editor (simpler dual-mode)
- Install: `pnpm add @tiptap/react @tiptap/starter-kit`

**Date Picker:**
- Use existing shadcn/ui Calendar component
- Or react-day-picker if not already available

### API Integration

**Endpoint:** `POST /api/tasks`

**Request body:**
```typescript
{
  title: string
  description?: string
  status?: 'backlog' | 'todo' | 'in_progress' | 'done'
  stressLevel?: number | null
  dueDate?: number | null
  dueDateTimezone?: string
  assignedToUserId?: string | null
  labelIds?: string[]
  listId: string
}
```

**Response:** Created task object or error

**Error handling:**
- Show validation errors inline in form
- Network errors shown as toast or inline message
- Keep form open on error (allow retry)

### Styling Guidelines

- Use existing shadcn/ui components and Tailwind utility classes
- Match `CreateListForm` styling patterns for consistency
- Linear-inspired design: clean, minimal, content-focused
- Toolbar buttons should clearly show:
  - Unselected state (placeholder text, muted colors)
  - Selected state (actual value, prominent display)
  - Disabled state (when dependencies not met)

### User Experience

**Form layout:**
```
┌─────────────────────────────────────┐
│ ← Back                              │
│                                     │
│ [Title input field]                 │
│                                     │
│ [Description markdown editor]       │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [Status] [List] [Stress] [Due]  │ │
│ │ [Assignee] [Labels]             │ │
│ └─────────────────────────────────┘ │
│                                     │
│              [Cancel] [Create Task] │
└─────────────────────────────────────┘
```

**Button states:**
- List button: "Select list..." → "📋 Marketing Tasks"
- Status button: "Backlog" (default, can change)
- Stress level: "Set stress level" → "😰 Level 7"
- Due date: "Set due date" → "📅 Jan 15"
- Assignee: "Unassigned" → "👤 John Doe"
- Labels: "Add labels" → "🏷️ 3 labels"

## Success Criteria

- User can create comprehensive tasks with all fields through command palette
- Title and list are required, form prevents submission without them
- All optional fields are accessible and functional
- Field components are reusable in other contexts
- Form validates input using updated Zod schema
- Assignee selector only shows members of selected list
- Form closes on successful creation
- Errors are shown clearly and allow retry
- UI matches existing design system and Linear-style aesthetic

## Future Enhancements

- Dynamic label creation from within LabelSelector
- Recurring task support
- Keyboard shortcuts for field selection
- Template tasks (save common task configurations)
- Bulk task creation
- Task dependencies
- File attachments in description
