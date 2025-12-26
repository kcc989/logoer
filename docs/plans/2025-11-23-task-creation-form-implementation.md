# Task Creation Form Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive Linear-style task creation form with reusable field components in the command palette.

**Architecture:** Reusable field components in `src/components/task-fields/` following a Button+Selector pattern, composed in `CreateTaskForm` within the command palette. Uses React Query for data fetching, Zod for validation, and Tiptap for markdown editing.

**Tech Stack:** React, TypeScript, Zod, React Query, Tiptap (markdown), shadcn/ui components, rwsdk

---

## Task 1: Update Task Schema

**Files:**
- Modify: `src/schemas/tasks.ts:36-46`

**Step 1: Make dueDate and dueDateTimezone optional**

Update the `createTaskInputSchema` in `src/schemas/tasks.ts`:

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

**Step 2: Verify types are correct**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit schema changes**

```bash
git add src/schemas/tasks.ts
git commit -m "Update task schema: make dueDate optional, add listId"
```

---

## Task 2: Install Tiptap for Markdown Editor

**Files:**
- Modify: `package.json`

**Step 1: Install Tiptap dependencies**

Run: `pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder`
Expected: Packages installed successfully

**Step 2: Verify installation**

Run: `pnpm list | grep tiptap`
Expected: Shows installed @tiptap packages

**Step 3: Commit dependency changes**

```bash
git add package.json pnpm-lock.yaml
git commit -m "Add Tiptap for WYSIWYG markdown editing"
```

---

## Task 3: Create StatusSelector Component

**Files:**
- Create: `src/components/task-fields/status-selector.tsx`

**Step 1: Create the StatusSelector component**

Create file `src/components/task-fields/status-selector.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { TaskStatus, taskStatusSchema } from '@/schemas/tasks';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface StatusSelectorProps {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
}

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  backlog: { label: 'Backlog', variant: 'secondary' },
  todo: { label: 'Todo', variant: 'default' },
  in_progress: { label: 'In Progress', variant: 'outline' },
  done: { label: 'Done', variant: 'default' },
};

export function StatusSelector({ value, onChange }: StatusSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue>
          <Badge variant={STATUS_CONFIG[value].variant}>
            {STATUS_CONFIG[value].label}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <SelectItem key={status} value={status}>
            <Badge variant={config.variant}>{config.label}</Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**Step 2: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit StatusSelector**

```bash
git add src/components/task-fields/status-selector.tsx
git commit -m "Add StatusSelector component"
```

---

## Task 4: Create ListSelector Component

**Files:**
- Create: `src/components/task-fields/list-selector.tsx`
- Reference: `src/queries/lists.ts`

**Step 1: Create the ListSelector component**

Create file `src/components/task-fields/list-selector.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLists } from '@/queries/lists';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

interface ListSelectorProps {
  value: string | null;
  onChange: (listId: string) => void;
}

export function ListSelector({ value, onChange }: ListSelectorProps) {
  const { data: lists, isPending, isError } = useQuery({
    queryKey: ['lists'],
    queryFn: () => fetchLists(100, 0), // Fetch up to 100 lists
  });

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4" />
        Loading lists...
      </div>
    );
  }

  if (isError || !lists) {
    return <div className="text-sm text-red-500">Failed to load lists</div>;
  }

  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select list..." />
      </SelectTrigger>
      <SelectContent>
        {lists.map((list) => (
          <SelectItem key={list.id} value={list.id}>
            {list.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**Step 2: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit ListSelector**

```bash
git add src/components/task-fields/list-selector.tsx
git commit -m "Add ListSelector component with React Query"
```

---

## Task 5: Create StressLevelSelector Component

**Files:**
- Create: `src/components/task-fields/stress-level-selector.tsx`

**Step 1: Create the StressLevelSelector component**

Create file `src/components/task-fields/stress-level-selector.tsx`:

```typescript
'use client';

import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface StressLevelSelectorProps {
  value: number | null;
  onChange: (level: number | null) => void;
}

const getStressColor = (level: number): string => {
  if (level <= 3) return 'bg-green-500';
  if (level <= 6) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getStressVariant = (
  level: number
): 'default' | 'secondary' | 'destructive' => {
  if (level <= 3) return 'default';
  if (level <= 6) return 'secondary';
  return 'destructive';
};

export function StressLevelSelector({
  value,
  onChange,
}: StressLevelSelectorProps) {
  const currentLevel = value || 5;

  return (
    <div className="flex items-center gap-4 p-4">
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Stress Level</span>
          {value !== null && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              className="h-6 px-2"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Slider
          value={[currentLevel]}
          onValueChange={([level]) => onChange(level)}
          min={1}
          max={10}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1 (Low)</span>
          <Badge variant={value !== null ? getStressVariant(currentLevel) : 'outline'}>
            Level {currentLevel}
          </Badge>
          <span>10 (High)</span>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit StressLevelSelector**

```bash
git add src/components/task-fields/stress-level-selector.tsx
git commit -m "Add StressLevelSelector with slider and color coding"
```

---

## Task 6: Create DueDatePicker Component

**Files:**
- Create: `src/components/task-fields/due-date-picker.tsx`

**Step 1: Create the DueDatePicker component**

Create file `src/components/task-fields/due-date-picker.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/dropdown-menu';
import { CalendarIcon, X } from 'lucide-react';

interface DueDatePickerProps {
  value: number | null; // Unix timestamp in ms
  onChange: (timestamp: number | null) => void;
}

export function DueDatePicker({ value, onChange }: DueDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedDate = value ? new Date(value) : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(date.getTime());
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            format(selectedDate, 'PPP')
          ) : (
            <span className="text-muted-foreground">Set due date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
        />
        {value !== null && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="w-full"
            >
              <X className="mr-2 h-4 w-4" />
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit DueDatePicker**

```bash
git add src/components/task-fields/due-date-picker.tsx
git commit -m "Add DueDatePicker with Calendar component"
```

---

## Task 7: Create Query Function for List Members

**Files:**
- Create: `src/queries/members.ts`
- Reference: `src/queries/lists.ts`

**Step 1: Create members query**

Create file `src/queries/members.ts`:

```typescript
import { z } from 'zod';
import { userPublicSchema } from '@/schemas/users';
import { createQueryFnWithParams } from '@/lib/react-query-utils';

const membersArraySchema = z.array(userPublicSchema);

export const fetchListMembers = createQueryFnWithParams(
  (listId: string) => `/api/lists/${listId}/members`,
  membersArraySchema
);
```

**Step 2: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit members query**

```bash
git add src/queries/members.ts
git commit -m "Add fetchListMembers query function"
```

---

## Task 8: Create AssigneeSelector Component

**Files:**
- Create: `src/components/task-fields/assignee-selector.tsx`

**Step 1: Create the AssigneeSelector component**

Create file `src/components/task-fields/assignee-selector.tsx`:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchListMembers } from '@/queries/members';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';

interface AssigneeSelectorProps {
  listId: string | null;
  value: string | null;
  onChange: (userId: string | null) => void;
}

export function AssigneeSelector({
  listId,
  value,
  onChange,
}: AssigneeSelectorProps) {
  const { data: members, isPending } = useQuery({
    queryKey: ['list-members', listId],
    queryFn: () => fetchListMembers(listId!),
    enabled: !!listId,
  });

  if (!listId) {
    return (
      <div className="text-sm text-muted-foreground">
        Select a list first
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4" />
        Loading members...
      </div>
    );
  }

  const handleChange = (newValue: string) => {
    onChange(newValue === 'unassigned' ? null : newValue);
  };

  return (
    <Select
      value={value || 'unassigned'}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarFallback>?</AvatarFallback>
            </Avatar>
            <span>Unassigned</span>
          </div>
        </SelectItem>
        {members?.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback>
                  {member.name?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <span>{member.name || member.email}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**Step 2: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit AssigneeSelector**

```bash
git add src/components/task-fields/assignee-selector.tsx
git commit -m "Add AssigneeSelector with list member filtering"
```

---

## Task 9: Create Query Function for Labels

**Files:**
- Create: `src/queries/labels.ts`

**Step 1: Create labels query**

Create file `src/queries/labels.ts`:

```typescript
import { z } from 'zod';
import { labelSchema } from '@/schemas/labels';
import { fetchWithSchema } from '@/lib/react-query-utils';

const labelsArraySchema = z.array(labelSchema);

export const fetchLabels = () =>
  fetchWithSchema({
    url: '/api/labels',
    schema: labelsArraySchema,
  });
```

**Step 2: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit labels query**

```bash
git add src/queries/labels.ts
git commit -m "Add fetchLabels query function"
```

---

## Task 10: Create LabelSelector Component

**Files:**
- Create: `src/components/task-fields/label-selector.tsx`

**Step 1: Create the LabelSelector component**

Create file `src/components/task-fields/label-selector.tsx`:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchLabels } from '@/queries/labels';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tag } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface LabelSelectorProps {
  value: string[];
  onChange: (labelIds: string[]) => void;
}

export function LabelSelector({ value, onChange }: LabelSelectorProps) {
  const { data: labels, isPending } = useQuery({
    queryKey: ['labels'],
    queryFn: fetchLabels,
  });

  const toggleLabel = (labelId: string) => {
    if (value.includes(labelId)) {
      onChange(value.filter((id) => id !== labelId));
    } else {
      onChange([...value, labelId]);
    }
  };

  const selectedCount = value.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[200px] justify-start">
          <Tag className="mr-2 h-4 w-4" />
          {selectedCount > 0 ? (
            <span>{selectedCount} label{selectedCount !== 1 ? 's' : ''}</span>
          ) : (
            <span className="text-muted-foreground">Add labels</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-4" align="start">
        <div className="space-y-2">
          <div className="font-medium text-sm">Select labels</div>
          {isPending ? (
            <div className="flex items-center gap-2 py-4">
              <Spinner className="h-4 w-4" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : labels && labels.length > 0 ? (
            <div className="space-y-2">
              {labels.map((label) => (
                <div key={label.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`label-${label.id}`}
                    checked={value.includes(label.id)}
                    onCheckedChange={() => toggleLabel(label.id)}
                  />
                  <label
                    htmlFor={`label-${label.id}`}
                    className="flex-1 cursor-pointer text-sm"
                  >
                    <Badge variant="outline">{label.name}</Badge>
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-sm text-muted-foreground text-center">
              No labels available
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit LabelSelector**

```bash
git add src/components/task-fields/label-selector.tsx
git commit -m "Add LabelSelector with multi-select checkboxes"
```

---

## Task 11: Create MarkdownEditor Component

**Files:**
- Create: `src/components/task-fields/markdown-editor.tsx`

**Step 1: Create the MarkdownEditor component**

Create file `src/components/task-fields/markdown-editor.tsx`:

```typescript
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { useEffect } from 'react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Add a description...',
}: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getText());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3',
      },
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== editor.getText()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-md">
      <div className="border-b bg-muted/50 p-2 flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-muted' : ''}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-muted' : ''}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-muted' : ''}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
```

**Step 2: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit MarkdownEditor**

```bash
git add src/components/task-fields/markdown-editor.tsx
git commit -m "Add MarkdownEditor with Tiptap and toolbar"
```

---

## Task 12: Create Mutation Function for Creating Tasks

**Files:**
- Create: `src/queries/tasks.ts`

**Step 1: Create tasks mutation**

Create file `src/queries/tasks.ts`:

```typescript
import { createMutationFn } from '@/lib/react-query-utils';
import { createTaskInputSchema, taskSchema } from '@/schemas/tasks';

export const createTask = createMutationFn({
  method: 'POST',
  url: '/api/tasks',
  requestSchema: createTaskInputSchema,
  responseSchema: taskSchema,
});
```

**Step 2: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit tasks mutation**

```bash
git add src/queries/tasks.ts
git commit -m "Add createTask mutation function"
```

---

## Task 13: Build CreateTaskForm - Part 1 (Structure & State)

**Files:**
- Modify: `src/components/command-palette/create-task-form.tsx`

**Step 1: Replace stub with form structure**

Replace entire contents of `src/components/command-palette/create-task-form.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCommandPalette } from '.';
import { createTask } from '@/queries/tasks';
import { TaskStatus } from '@/schemas/tasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { StatusSelector } from '@/components/task-fields/status-selector';
import { ListSelector } from '@/components/task-fields/list-selector';
import { StressLevelSelector } from '@/components/task-fields/stress-level-selector';
import { DueDatePicker } from '@/components/task-fields/due-date-picker';
import { AssigneeSelector } from '@/components/task-fields/assignee-selector';
import { LabelSelector } from '@/components/task-fields/label-selector';
import { MarkdownEditor } from '@/components/task-fields/markdown-editor';

export function CreateTaskForm() {
  const { close } = useCommandPalette();
  const queryClient = useQueryClient();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('backlog');
  const [listId, setListId] = useState<string | null>(null);
  const [stressLevel, setStressLevel] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<number | null>(null);
  const [assignedToUserId, setAssignedToUserId] = useState<string | null>(null);
  const [labelIds, setLabelIds] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);

  // Auto-detect timezone
  const dueDateTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Reset assignee when list changes
  const handleListChange = (newListId: string) => {
    setListId(newListId);
    setAssignedToUserId(null); // Reset assignee
  };

  // Mutation
  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      close();
      // Optional: Navigate to task or show success toast
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!listId) {
      setError('Please select a list');
      return;
    }

    // Submit
    mutation.mutate({
      title,
      description: description || undefined,
      status,
      stressLevel: stressLevel || undefined,
      dueDate: dueDate || undefined,
      dueDateTimezone: dueDate ? dueDateTimezone : undefined,
      assignedToUserId: assignedToUserId || undefined,
      labelIds: labelIds.length > 0 ? labelIds : undefined,
      listId,
    });
  };

  const isSubmitting = mutation.isPending;
  const canSubmit = title.trim() && listId && !isSubmitting;

  return (
    <div className="p-4">
      {/* Back button */}
      <div className="mb-4">
        <button
          onClick={() => close()}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <Field>
          <FieldLabel>Title</FieldLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            autoFocus
            disabled={isSubmitting}
          />
        </Field>

        {/* Description */}
        <Field>
          <FieldLabel>Description (optional)</FieldLabel>
          <MarkdownEditor
            value={description}
            onChange={setDescription}
            placeholder="Add a description..."
          />
        </Field>

        {/* Field Toolbar */}
        <div className="border rounded-md p-4 space-y-3 bg-muted/20">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel className="text-xs">Status</FieldLabel>
              <StatusSelector value={status} onChange={setStatus} />
            </Field>

            <Field>
              <FieldLabel className="text-xs">List *</FieldLabel>
              <ListSelector value={listId} onChange={handleListChange} />
            </Field>

            <Field>
              <FieldLabel className="text-xs">Due Date</FieldLabel>
              <DueDatePicker value={dueDate} onChange={setDueDate} />
            </Field>

            <Field>
              <FieldLabel className="text-xs">Assignee</FieldLabel>
              <AssigneeSelector
                listId={listId}
                value={assignedToUserId}
                onChange={setAssignedToUserId}
              />
            </Field>

            <Field>
              <FieldLabel className="text-xs">Labels</FieldLabel>
              <LabelSelector value={labelIds} onChange={setLabelIds} />
            </Field>
          </div>

          <Field>
            <FieldLabel className="text-xs">Stress Level</FieldLabel>
            <StressLevelSelector value={stressLevel} onChange={setStressLevel} />
          </Field>
        </div>

        {/* Error message */}
        {error && <div className="text-sm text-red-500">{error}</div>}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit CreateTaskForm**

```bash
git add src/components/command-palette/create-task-form.tsx
git commit -m "Build CreateTaskForm with all field components"
```

---

## Task 14: Wire CreateTaskForm into Command Palette

**Files:**
- Modify: `src/components/command-palette/index.tsx:187-188`

**Step 1: Import CreateTaskForm**

Add import at top of `src/components/command-palette/index.tsx`:

```typescript
import { CreateTaskForm } from './create-task-form';
```

**Step 2: Add CreateTaskForm to CommandPalette rendering**

Update the `CommandPalette` component to include the create-task view (around line 187):

```typescript
export function CommandPalette() {
  const { isOpen, currentView, close } = useCommandPalette();

  return (
    <CommandDialog open={isOpen} onOpenChange={close} showCloseButton={false}>
      {currentView === 'commands' && <CommandsListView />}
      {currentView === 'create-list' && <CreateListForm />}
      {currentView === 'create-task' && <CreateTaskForm />}
    </CommandDialog>
  );
}
```

**Step 3: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 4: Commit integration**

```bash
git add src/components/command-palette/index.tsx
git commit -m "Wire CreateTaskForm into command palette"
```

---

## Task 15: Update Task Handler to Support ListId

**Files:**
- Modify: `src/app/api/tasks/handlers.ts:15-33`

**Step 1: Update createTaskRoute to accept listId from request body**

The current handler expects `listId` from `ctx.listId`, but we need to accept it from the request body. Update the handler:

```typescript
async function createTaskRoute({ ctx, request }: RequestInfo) {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  const validationResult = createTaskInputSchema.safeParse(
    await request.json()
  );
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.message);
  }

  const { listId, ...taskData } = validationResult.data;

  if (!listId) {
    throw new ValidationError('listId is required');
  }

  const task = await createTask(listId, taskData);

  return task;
}
```

**Step 2: Verify no type errors**

Run: `pnpm run types`
Expected: No type errors

**Step 3: Commit handler update**

```bash
git add src/app/api/tasks/handlers.ts
git commit -m "Update task handler to accept listId from request body"
```

---

## Task 16: Manual Testing & Validation

**Files:**
- None (testing phase)

**Step 1: Start development server**

Run: `pnpm run dev`
Expected: Server starts without errors

**Step 2: Test command palette opens**

1. Open browser to `http://localhost:5173`
2. Press `Cmd+K` (or `Ctrl+K`)
3. Expected: Command palette opens with command list

**Step 3: Test Create Task command**

1. Select "Create Task" from command list
2. Expected: Form appears with all fields

**Step 4: Test required field validation**

1. Try to submit without title
2. Expected: Error "Title is required"
3. Try to submit without list
4. Expected: Error "Please select a list"

**Step 5: Test form fields**

1. Enter title
2. Select a list
3. Test each field component:
   - Status dropdown
   - Due date picker
   - Assignee selector (should show members of selected list)
   - Labels multi-select
   - Stress level slider
   - Markdown editor formatting
4. Expected: All fields work correctly

**Step 6: Test task creation**

1. Fill in required fields (title + list)
2. Add optional fields
3. Click "Create Task"
4. Expected: Task created, palette closes, no errors

**Step 7: Verify in browser console**

Check for:
- No console errors
- Network request to `/api/tasks` succeeded
- Response contains created task

---

## Task 17: Final Cleanup & Documentation

**Files:**
- Modify: `docs/plans/2025-11-23-task-creation-form.md`

**Step 1: Update design document with implementation notes**

Add "Implementation Completed" section to design doc with:
- Date completed
- Any deviations from plan
- Known limitations

**Step 2: Verify all components exported from index**

Create `src/components/task-fields/index.ts` for clean imports:

```typescript
export { StatusSelector } from './status-selector';
export { ListSelector } from './list-selector';
export { StressLevelSelector } from './stress-level-selector';
export { DueDatePicker } from './due-date-picker';
export { AssigneeSelector } from './assignee-selector';
export { LabelSelector } from './label-selector';
export { MarkdownEditor } from './markdown-editor';
```

**Step 3: Final commit**

```bash
git add src/components/task-fields/index.ts docs/plans/2025-11-23-task-creation-form.md
git commit -m "Add task-fields index exports and update design doc"
```

**Step 4: Verify clean build**

Run: `pnpm run build`
Expected: Build succeeds with no errors

---

## Success Criteria Checklist

- [ ] Task schema updated with optional dueDate and required listId
- [ ] All 7 field components created and reusable
- [ ] CreateTaskForm functional with all fields
- [ ] Form validates required fields (title, listId)
- [ ] Command palette integration working
- [ ] Can create tasks with all optional fields
- [ ] Assignee selector filters by selected list
- [ ] Markdown editor supports basic formatting
- [ ] No TypeScript errors
- [ ] Clean build succeeds

---

## Notes for Implementation

**API Endpoint Assumptions:**
- `/api/labels` - May not exist yet, create stub or skip LabelSelector if needed
- `/api/lists/{listId}/members` - May not exist, create stub or show all users

**Optional Enhancements (post-V1):**
- Toast notifications on success/error (using sonner)
- Keyboard navigation between fields
- Save draft state in localStorage
- Cmd+Enter to submit form
- Tab navigation through toolbar fields

**Potential Issues:**
- If labels/members API doesn't exist, those selectors will show errors
- Popover component may need adjustment (used dropdown-menu in import but should be Popover)
- Calendar date-fns version compatibility
- Tiptap may need additional configuration for markdown output (currently uses getText() instead of getMarkdown())
