# Task Views Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add table and kanban views for tasks in the list detail page with server-side filtering and realtime updates.

**Architecture:** Server-side filtering via URL params, realtime RSC re-renders using `renderRealtimeClients`, view preferences in localStorage. Filter changes update URL which triggers server re-render with filtered data.

**Tech Stack:** rwsdk (routing, realtime), Kysely (queries), React (components), TanStack Query (client mutations), Tailwind CSS

---

## Phase 1: Realtime Infrastructure

### Task 1: Add RealtimeDurableObject binding

**Files:**
- Modify: `wrangler.jsonc`

**Step 1: Add the durable object binding**

In `wrangler.jsonc`, add to the `durable_objects.bindings` array:

```json
{
  "name": "REALTIME_DURABLE_OBJECT",
  "class_name": "RealtimeDurableObject"
}
```

**Step 2: Add migration for the new class**

Add to the `migrations` array:

```json
{
  "tag": "v4",
  "new_classes": ["RealtimeDurableObject"]
}
```

**Step 3: Regenerate types**

Run: `pnpm generate`

**Step 4: Commit**

```bash
git add wrangler.jsonc
git commit -m "feat: add RealtimeDurableObject binding"
```

---

### Task 2: Add realtime route and export to worker

**Files:**
- Modify: `src/worker.tsx`

**Step 1: Add imports**

Add at the top of the file:

```typescript
import { realtimeRoute } from 'rwsdk/realtime/worker';
export { RealtimeDurableObject } from 'rwsdk/realtime/durableObject';
```

**Step 2: Add realtime route to defineApp**

Add `realtimeRoute(() => env.REALTIME_DURABLE_OBJECT)` after the `syncedStateRoutes` line:

```typescript
...syncedStateRoutes(() => env.STATE_COORDINATOR),
realtimeRoute(() => env.REALTIME_DURABLE_OBJECT),
prefix('/api', [listRoutes, taskRoutes]),
```

**Step 3: Verify types compile**

Run: `pnpm types`
Expected: No errors

**Step 4: Commit**

```bash
git add src/worker.tsx
git commit -m "feat: add realtime route and export RealtimeDurableObject"
```

---

### Task 3: Create RealtimeInit client component

**Files:**
- Create: `src/components/realtime-init.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { initRealtimeClient } from 'rwsdk/realtime/client';
import { useEffect } from 'react';

export function RealtimeInit({ realtimeKey }: { realtimeKey: string }) {
  useEffect(() => {
    initRealtimeClient({ key: realtimeKey });
  }, [realtimeKey]);

  return null;
}
```

**Step 2: Verify types compile**

Run: `pnpm types`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/realtime-init.tsx
git commit -m "feat: add RealtimeInit client component"
```

---

### Task 4: Create ListDocument for realtime list pages

**Files:**
- Create: `src/app/pages/lists/ListDocument.tsx`

**Step 1: Create the document**

```typescript
import { requestInfo } from 'rwsdk/worker';
import { RealtimeInit } from '@/components/realtime-init';

export const ListDocument: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { ctx, params } = requestInfo;
  const theme = ctx.theme || 'light';
  const listId = params.listId;

  return (
    <html lang="en" className={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Stress Debt</title>
        <link rel="modulepreload" href="/src/client.tsx" />
      </head>
      <body>
        <div id="root">{children}</div>
        <script>import("/src/client.tsx")</script>
        {listId && <RealtimeInit realtimeKey={`/lists/${listId}`} />}
      </body>
    </html>
  );
};
```

**Step 2: Verify types compile**

Run: `pnpm types`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/pages/lists/ListDocument.tsx
git commit -m "feat: add ListDocument with realtime initialization"
```

---

### Task 5: Update worker routing to use ListDocument

**Files:**
- Modify: `src/worker.tsx`

**Step 1: Import ListDocument**

```typescript
import { ListDocument } from '@/app/pages/lists/ListDocument';
```

**Step 2: Update routing**

Replace the current `render(Document, [...])` block with two render blocks:

```typescript
render(Document, [
  route('/', Home),
  route('/login', Login),
  route('/lists', Lists),
]),
render(ListDocument, [
  route('/lists/:listId', ListDetail),
]),
```

**Step 3: Verify types compile**

Run: `pnpm types`
Expected: No errors

**Step 4: Commit**

```bash
git add src/worker.tsx
git commit -m "feat: use ListDocument for list detail routes"
```

---

## Phase 2: Server-Side Filtering Query Layer

### Task 6: Create URL param parsing utility

**Files:**
- Create: `src/lib/task-filters.ts`

**Step 1: Create the filter types and parser**

```typescript
import { TaskStatus, taskStatusSchema } from '@/schemas/tasks';

export interface TaskFilters {
  search?: string;
  statuses?: TaskStatus[];
  assigneeIds?: string[];
  labelIds?: string[];
  dueRange?: 'overdue' | 'today' | 'week' | 'none';
  stressMin?: number;
  stressMax?: number;
  createdAfter?: number;
  createdBefore?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export function parseTaskFiltersFromUrl(url: URL): TaskFilters {
  const params = url.searchParams;
  const filters: TaskFilters = {};

  const search = params.get('search');
  if (search) filters.search = search;

  const status = params.get('status');
  if (status) {
    const statuses = status.split(',').filter((s) => {
      const result = taskStatusSchema.safeParse(s);
      return result.success;
    }) as TaskStatus[];
    if (statuses.length > 0) filters.statuses = statuses;
  }

  const assignee = params.get('assignee');
  if (assignee) {
    filters.assigneeIds = assignee.split(',');
  }

  const labels = params.get('labels');
  if (labels) {
    filters.labelIds = labels.split(',');
  }

  const due = params.get('due');
  if (due && ['overdue', 'today', 'week', 'none'].includes(due)) {
    filters.dueRange = due as TaskFilters['dueRange'];
  }

  const stressMin = params.get('stressMin');
  if (stressMin) {
    const val = parseInt(stressMin, 10);
    if (!isNaN(val) && val >= 1 && val <= 10) filters.stressMin = val;
  }

  const stressMax = params.get('stressMax');
  if (stressMax) {
    const val = parseInt(stressMax, 10);
    if (!isNaN(val) && val >= 1 && val <= 10) filters.stressMax = val;
  }

  const createdAfter = params.get('createdAfter');
  if (createdAfter) {
    const val = parseInt(createdAfter, 10);
    if (!isNaN(val)) filters.createdAfter = val;
  }

  const createdBefore = params.get('createdBefore');
  if (createdBefore) {
    const val = parseInt(createdBefore, 10);
    if (!isNaN(val)) filters.createdBefore = val;
  }

  const sort = params.get('sort');
  if (sort) filters.sortField = sort;

  const dir = params.get('dir');
  if (dir === 'asc' || dir === 'desc') filters.sortDirection = dir;

  return filters;
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return !!(
    filters.search ||
    filters.statuses?.length ||
    filters.assigneeIds?.length ||
    filters.labelIds?.length ||
    filters.dueRange ||
    filters.stressMin !== undefined ||
    filters.stressMax !== undefined ||
    filters.createdAfter !== undefined ||
    filters.createdBefore !== undefined
  );
}
```

**Step 2: Verify types compile**

Run: `pnpm types`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/task-filters.ts
git commit -m "feat: add task filter URL parsing utility"
```

---

### Task 7: Add queryTasks function with filtering

**Files:**
- Modify: `src/queries/tasks.ts`

**Step 1: Add imports and the query function**

Replace the entire file content with:

```typescript
import { createMutationFn } from '@/lib/react-query-utils';
import { createTaskInputSchema, taskSchema, TaskWithLabels, taskWithLabelsSchema } from '@/schemas/tasks';
import { getListDb } from '@/db';
import type { TaskFilters } from '@/lib/task-filters';

export const createTask = createMutationFn({
  method: 'POST',
  url: '/api/tasks',
  requestSchema: createTaskInputSchema,
  responseSchema: taskSchema,
});

export async function queryTasks(
  listId: string,
  filters: TaskFilters
): Promise<TaskWithLabels[]> {
  const listDb = await getListDb({ listId });

  let query = listDb.selectFrom('tasks').selectAll();

  // Status filter
  if (filters.statuses?.length) {
    query = query.where('status', 'in', filters.statuses);
  }

  // Assignee filter
  if (filters.assigneeIds?.length) {
    if (filters.assigneeIds.includes('unassigned')) {
      const assigned = filters.assigneeIds.filter((id) => id !== 'unassigned');
      if (assigned.length) {
        query = query.where((eb) =>
          eb.or([
            eb('assignedToUserId', 'is', null),
            eb('assignedToUserId', 'in', assigned),
          ])
        );
      } else {
        query = query.where('assignedToUserId', 'is', null);
      }
    } else {
      query = query.where('assignedToUserId', 'in', filters.assigneeIds);
    }
  }

  // Search filter
  if (filters.search) {
    query = query.where('title', 'like', `%${filters.search}%`);
  }

  // Due date filter
  if (filters.dueRange) {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();
    const tomorrowStartMs = todayStartMs + 86400000;
    const weekEndMs = todayStartMs + 7 * 86400000;

    switch (filters.dueRange) {
      case 'overdue':
        query = query.where('dueDate', '<', now).where('status', '!=', 'done');
        break;
      case 'today':
        query = query
          .where('dueDate', '>=', todayStartMs)
          .where('dueDate', '<', tomorrowStartMs);
        break;
      case 'week':
        query = query
          .where('dueDate', '>=', todayStartMs)
          .where('dueDate', '<', weekEndMs);
        break;
      case 'none':
        query = query.where('dueDate', 'is', null);
        break;
    }
  }

  // Stress level filter
  if (filters.stressMin !== undefined) {
    query = query.where('stressLevel', '>=', filters.stressMin);
  }
  if (filters.stressMax !== undefined) {
    query = query.where('stressLevel', '<=', filters.stressMax);
  }

  // Created date filter
  if (filters.createdAfter !== undefined) {
    query = query.where('createdAt', '>=', filters.createdAfter);
  }
  if (filters.createdBefore !== undefined) {
    query = query.where('createdAt', '<=', filters.createdBefore);
  }

  // Sorting
  const sortField = filters.sortField || 'createdAt';
  const sortDir = filters.sortDirection || 'desc';

  // Type-safe sorting - only allow known columns
  const validSortFields = ['title', 'status', 'stressLevel', 'dueDate', 'createdAt', 'updatedAt'] as const;
  const safeSortField = validSortFields.includes(sortField as any) ? sortField : 'createdAt';

  query = query.orderBy(safeSortField as any, sortDir);

  const tasks = await query.execute();

  // Parse with labels (currently empty array, will be populated when we add label relations)
  return tasks.map((task) => taskWithLabelsSchema.parse({ ...task, labels: [] }));
}
```

**Step 2: Verify types compile**

Run: `pnpm types`
Expected: No errors

**Step 3: Commit**

```bash
git add src/queries/tasks.ts
git commit -m "feat: add queryTasks function with server-side filtering"
```

---

## Phase 3: View Preferences Hook

### Task 8: Create useViewPreferences hook

**Files:**
- Create: `src/lib/hooks/use-view-preferences.ts`

**Step 1: Create the hook**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';

export type ViewMode = 'table' | 'kanban';

export interface ViewPreferences {
  viewMode: ViewMode;
  tableColumns: string[];
}

const DEFAULT_COLUMNS = [
  'title',
  'status',
  'stressLevel',
  'dueDate',
  'assignee',
  'labels',
];

const ALL_COLUMNS = [
  { id: 'title', label: 'Title' },
  { id: 'status', label: 'Status' },
  { id: 'stressLevel', label: 'Stress Level' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'labels', label: 'Labels' },
  { id: 'description', label: 'Description' },
  { id: 'createdAt', label: 'Created' },
  { id: 'updatedAt', label: 'Updated' },
];

export { ALL_COLUMNS };

function getStorageKey(listId: string): string {
  return `list-view-${listId}`;
}

function loadPreferences(listId: string): ViewPreferences {
  if (typeof window === 'undefined') {
    return { viewMode: 'table', tableColumns: DEFAULT_COLUMNS };
  }

  try {
    const stored = localStorage.getItem(getStorageKey(listId));
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        viewMode: parsed.viewMode || 'table',
        tableColumns: parsed.tableColumns || DEFAULT_COLUMNS,
      };
    }
  } catch {
    // Ignore parse errors
  }

  return { viewMode: 'table', tableColumns: DEFAULT_COLUMNS };
}

function savePreferences(listId: string, prefs: ViewPreferences): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(getStorageKey(listId), JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

export function useViewPreferences(listId: string) {
  const [preferences, setPreferences] = useState<ViewPreferences>(() =>
    loadPreferences(listId)
  );

  // Load from localStorage on mount
  useEffect(() => {
    setPreferences(loadPreferences(listId));
  }, [listId]);

  const setViewMode = useCallback(
    (viewMode: ViewMode) => {
      setPreferences((prev) => {
        const next = { ...prev, viewMode };
        savePreferences(listId, next);
        return next;
      });
    },
    [listId]
  );

  const setTableColumns = useCallback(
    (tableColumns: string[]) => {
      setPreferences((prev) => {
        const next = { ...prev, tableColumns };
        savePreferences(listId, next);
        return next;
      });
    },
    [listId]
  );

  const toggleColumn = useCallback(
    (columnId: string) => {
      setPreferences((prev) => {
        const tableColumns = prev.tableColumns.includes(columnId)
          ? prev.tableColumns.filter((c) => c !== columnId)
          : [...prev.tableColumns, columnId];
        const next = { ...prev, tableColumns };
        savePreferences(listId, next);
        return next;
      });
    },
    [listId]
  );

  return {
    ...preferences,
    setViewMode,
    setTableColumns,
    toggleColumn,
  };
}
```

**Step 2: Verify types compile**

Run: `pnpm types`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/hooks/use-view-preferences.ts
git commit -m "feat: add useViewPreferences hook for localStorage persistence"
```

---

## Phase 4: Display Toggle Component

### Task 9: Create DisplayToggle component

**Files:**
- Create: `src/components/tasks/display-toggle.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { LayoutList, LayoutGrid, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { type ViewMode, ALL_COLUMNS } from '@/lib/hooks/use-view-preferences';

interface DisplayToggleProps {
  viewMode: ViewMode;
  tableColumns: string[];
  onViewModeChange: (mode: ViewMode) => void;
  onToggleColumn: (columnId: string) => void;
}

export function DisplayToggle({
  viewMode,
  tableColumns,
  onViewModeChange,
  onToggleColumn,
}: DisplayToggleProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <Settings2 className="h-4 w-4" />
          Display
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* View Mode Toggle */}
        <div className="flex p-1 gap-1">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 h-8 gap-2"
            onClick={() => onViewModeChange('table')}
          >
            <LayoutList className="h-4 w-4" />
            List
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 h-8 gap-2"
            onClick={() => onViewModeChange('kanban')}
          >
            <LayoutGrid className="h-4 w-4" />
            Board
          </Button>
        </div>

        {/* Column Config - only show in table mode */}
        {viewMode === 'table' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Columns
            </DropdownMenuLabel>
            {ALL_COLUMNS.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={tableColumns.includes(column.id)}
                onCheckedChange={() => onToggleColumn(column.id)}
                disabled={column.id === 'title'} // Title is always visible
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Verify types compile**

Run: `pnpm types`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/tasks/display-toggle.tsx
git commit -m "feat: add DisplayToggle component with view mode and column config"
```

---

## Phase 5: Filter Components

### Task 10: Create SearchInput component

**Files:**
- Create: `src/components/tasks/task-filters/search-input.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search tasks...',
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync from parent
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce changes to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8 h-8 w-48"
      />
      {localValue && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
          onClick={() => {
            setLocalValue('');
            onChange('');
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-filters/search-input.tsx
git commit -m "feat: add SearchInput component with debouncing"
```

---

### Task 11: Create StatusFilter component

**Files:**
- Create: `src/components/tasks/task-filters/status-filter.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { TaskStatus } from '@/schemas/tasks';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

const STATUS_OPTIONS: { value: TaskStatus; label: string; icon: string }[] = [
  { value: 'backlog', label: 'Backlog', icon: '○' },
  { value: 'todo', label: 'Todo', icon: '○' },
  { value: 'in_progress', label: 'In Progress', icon: '◐' },
  { value: 'done', label: 'Done', icon: '●' },
];

interface StatusFilterProps {
  value: TaskStatus[];
  onChange: (statuses: TaskStatus[]) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const handleToggle = (status: TaskStatus) => {
    if (value.includes(status)) {
      onChange(value.filter((s) => s !== status));
    } else {
      onChange([...value, status]);
    }
  };

  const label =
    value.length === 0
      ? 'Status'
      : value.length === 1
        ? STATUS_OPTIONS.find((s) => s.value === value[0])?.label
        : `${value.length} statuses`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 gap-1 ${value.length > 0 ? 'border-primary' : ''}`}
        >
          {label}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STATUS_OPTIONS.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={value.includes(option.value)}
            onCheckedChange={() => handleToggle(option.value)}
          >
            <span className="mr-2">{option.icon}</span>
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-filters/status-filter.tsx
git commit -m "feat: add StatusFilter component"
```

---

### Task 12: Create AssigneeFilter component

**Files:**
- Create: `src/components/tasks/task-filters/assignee-filter.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchListMembers } from '@/queries/members';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronDown } from 'lucide-react';

interface AssigneeFilterProps {
  listId: string;
  value: string[];
  onChange: (assigneeIds: string[]) => void;
}

export function AssigneeFilter({
  listId,
  value,
  onChange,
}: AssigneeFilterProps) {
  const { data: members } = useQuery({
    queryKey: ['list-members', listId],
    queryFn: () => fetchListMembers(listId),
    enabled: !!listId,
  });

  const handleToggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const getLabel = () => {
    if (value.length === 0) return 'Assignee';
    if (value.length === 1) {
      if (value[0] === 'unassigned') return 'Unassigned';
      const member = members?.find((m) => m.id === value[0]);
      return member?.name || member?.username || 'Assignee';
    }
    return `${value.length} assignees`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 gap-1 ${value.length > 0 ? 'border-primary' : ''}`}
        >
          {getLabel()}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuCheckboxItem
          checked={value.includes('unassigned')}
          onCheckedChange={() => handleToggle('unassigned')}
        >
          <Avatar className="h-5 w-5 mr-2">
            <AvatarFallback>?</AvatarFallback>
          </Avatar>
          Unassigned
        </DropdownMenuCheckboxItem>
        {members && members.length > 0 && <DropdownMenuSeparator />}
        {members?.map((member) => {
          const displayName = member.name || member.username || member.email || 'Unknown';
          const initials = displayName[0]?.toUpperCase() || '?';
          return (
            <DropdownMenuCheckboxItem
              key={member.id}
              checked={value.includes(member.id)}
              onCheckedChange={() => handleToggle(member.id)}
            >
              <Avatar className="h-5 w-5 mr-2">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              {displayName}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-filters/assignee-filter.tsx
git commit -m "feat: add AssigneeFilter component"
```

---

### Task 13: Create DueDateFilter component

**Files:**
- Create: `src/components/tasks/task-filters/due-date-filter.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

type DueRange = 'overdue' | 'today' | 'week' | 'none' | null;

const DUE_OPTIONS: { value: DueRange; label: string }[] = [
  { value: null, label: 'Any due date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Due this week' },
  { value: 'none', label: 'No due date' },
];

interface DueDateFilterProps {
  value: DueRange;
  onChange: (range: DueRange) => void;
}

export function DueDateFilter({ value, onChange }: DueDateFilterProps) {
  const label = value
    ? DUE_OPTIONS.find((o) => o.value === value)?.label || 'Due date'
    : 'Due date';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 gap-1 ${value ? 'border-primary' : ''}`}
        >
          {label}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={value || ''}
          onValueChange={(v) => onChange((v || null) as DueRange)}
        >
          {DUE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value || 'any'}
              value={option.value || ''}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { DueRange };
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-filters/due-date-filter.tsx
git commit -m "feat: add DueDateFilter component"
```

---

### Task 14: Create TaskFilterBar component

**Files:**
- Create: `src/components/tasks/task-filters/task-filter-bar.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { SearchInput } from './search-input';
import { StatusFilter } from './status-filter';
import { AssigneeFilter } from './assignee-filter';
import { DueDateFilter, type DueRange } from './due-date-filter';
import type { TaskStatus } from '@/schemas/tasks';
import type { TaskFilters } from '@/lib/task-filters';
import { hasActiveFilters } from '@/lib/task-filters';

interface TaskFilterBarProps {
  listId: string;
  filters: TaskFilters;
}

export function TaskFilterBar({ listId, filters }: TaskFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const queryString = params.toString();
      const url = queryString ? `?${queryString}` : window.location.pathname;
      router.push(url);
    },
    [router, searchParams]
  );

  const handleSearchChange = (search: string) => {
    updateUrl({ search: search || null });
  };

  const handleStatusChange = (statuses: TaskStatus[]) => {
    updateUrl({ status: statuses.length > 0 ? statuses.join(',') : null });
  };

  const handleAssigneeChange = (assigneeIds: string[]) => {
    updateUrl({ assignee: assigneeIds.length > 0 ? assigneeIds.join(',') : null });
  };

  const handleDueDateChange = (dueRange: DueRange) => {
    updateUrl({ due: dueRange });
  };

  const handleClearAll = () => {
    router.push(window.location.pathname);
  };

  const showClearButton = hasActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput
        value={filters.search || ''}
        onChange={handleSearchChange}
      />
      <StatusFilter
        value={filters.statuses || []}
        onChange={handleStatusChange}
      />
      <AssigneeFilter
        listId={listId}
        value={filters.assigneeIds || []}
        onChange={handleAssigneeChange}
      />
      <DueDateFilter
        value={filters.dueRange || null}
        onChange={handleDueDateChange}
      />
      {showClearButton && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-muted-foreground"
          onClick={handleClearAll}
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-filters/task-filter-bar.tsx
git commit -m "feat: add TaskFilterBar component"
```

---

### Task 15: Create filter components index

**Files:**
- Create: `src/components/tasks/task-filters/index.ts`

**Step 1: Create the index file**

```typescript
export { TaskFilterBar } from './task-filter-bar';
export { SearchInput } from './search-input';
export { StatusFilter } from './status-filter';
export { AssigneeFilter } from './assignee-filter';
export { DueDateFilter } from './due-date-filter';
export type { DueRange } from './due-date-filter';
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-filters/index.ts
git commit -m "feat: add task-filters index exports"
```

---

## Phase 6: Table View Components

### Task 16: Create TaskRow component

**Files:**
- Create: `src/components/tasks/task-views/task-row.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { format } from 'date-fns';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { TaskWithLabels, TaskStatus } from '@/schemas/tasks';

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: string; variant: 'default' | 'secondary' | 'outline' }> = {
  backlog: { label: 'Backlog', icon: '○', variant: 'secondary' },
  todo: { label: 'Todo', icon: '○', variant: 'default' },
  in_progress: { label: 'In Progress', icon: '◐', variant: 'outline' },
  done: { label: 'Done', icon: '●', variant: 'default' },
};

interface TaskRowProps {
  task: TaskWithLabels;
  visibleColumns: string[];
  onClick: () => void;
  assigneeName?: string;
}

export function TaskRow({
  task,
  visibleColumns,
  onClick,
  assigneeName,
}: TaskRowProps) {
  const statusConfig = STATUS_CONFIG[task.status];

  return (
    <TableRow
      className="cursor-pointer"
      onClick={onClick}
    >
      {visibleColumns.includes('title') && (
        <TableCell className="font-medium">{task.title}</TableCell>
      )}
      {visibleColumns.includes('status') && (
        <TableCell>
          <Badge variant={statusConfig.variant}>
            <span className="mr-1">{statusConfig.icon}</span>
            {statusConfig.label}
          </Badge>
        </TableCell>
      )}
      {visibleColumns.includes('stressLevel') && (
        <TableCell>
          {task.stressLevel && (
            <span className="text-sm">
              <span className="text-yellow-500">⚡</span> {task.stressLevel}
            </span>
          )}
        </TableCell>
      )}
      {visibleColumns.includes('dueDate') && (
        <TableCell>
          {task.dueDate && (
            <span className="text-sm text-muted-foreground">
              {format(new Date(task.dueDate), 'MMM d')}
            </span>
          )}
        </TableCell>
      )}
      {visibleColumns.includes('assignee') && (
        <TableCell>
          {task.assignedToUserId && assigneeName && (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-xs">
                  {assigneeName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{assigneeName}</span>
            </div>
          )}
        </TableCell>
      )}
      {visibleColumns.includes('labels') && (
        <TableCell>
          <div className="flex gap-1 flex-wrap">
            {task.labels.map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                style={{
                  borderColor: label.color,
                  color: label.color,
                }}
              >
                {label.name}
              </Badge>
            ))}
          </div>
        </TableCell>
      )}
      {visibleColumns.includes('description') && (
        <TableCell className="max-w-xs truncate text-muted-foreground">
          {task.description}
        </TableCell>
      )}
      {visibleColumns.includes('createdAt') && (
        <TableCell className="text-sm text-muted-foreground">
          {format(new Date(task.createdAt), 'MMM d')}
        </TableCell>
      )}
      {visibleColumns.includes('updatedAt') && (
        <TableCell className="text-sm text-muted-foreground">
          {format(new Date(task.updatedAt), 'MMM d')}
        </TableCell>
      )}
    </TableRow>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-views/task-row.tsx
git commit -m "feat: add TaskRow component"
```

---

### Task 17: Create TaskTable component

**Files:**
- Create: `src/components/tasks/task-views/task-table.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TaskRow } from './task-row';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import type { TaskWithLabels } from '@/schemas/tasks';
import type { TaskFilters } from '@/lib/task-filters';

const COLUMN_HEADERS: Record<string, { label: string; sortable: boolean }> = {
  title: { label: 'Title', sortable: true },
  status: { label: 'Status', sortable: true },
  stressLevel: { label: 'Stress', sortable: true },
  dueDate: { label: 'Due Date', sortable: true },
  assignee: { label: 'Assignee', sortable: false },
  labels: { label: 'Labels', sortable: false },
  description: { label: 'Description', sortable: false },
  createdAt: { label: 'Created', sortable: true },
  updatedAt: { label: 'Updated', sortable: true },
};

interface TaskTableProps {
  listId: string;
  tasks: TaskWithLabels[];
  visibleColumns: string[];
  filters: TaskFilters;
  memberMap: Record<string, string>; // userId -> displayName
}

export function TaskTable({
  listId,
  tasks,
  visibleColumns,
  filters,
  memberMap,
}: TaskTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSort = useCallback(
    (field: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const currentSort = params.get('sort');
      const currentDir = params.get('dir');

      if (currentSort === field) {
        // Toggle direction
        if (currentDir === 'asc') {
          params.set('dir', 'desc');
        } else if (currentDir === 'desc') {
          // Remove sort
          params.delete('sort');
          params.delete('dir');
        } else {
          params.set('dir', 'asc');
        }
      } else {
        params.set('sort', field);
        params.set('dir', 'asc');
      }

      const queryString = params.toString();
      router.push(queryString ? `?${queryString}` : window.location.pathname);
    },
    [router, searchParams]
  );

  const handleRowClick = (taskId: string) => {
    router.push(`/lists/${listId}/tasks/${taskId}`);
  };

  const getSortIcon = (field: string) => {
    if (filters.sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    if (filters.sortDirection === 'asc') {
      return <ArrowUp className="h-3 w-3 ml-1" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {visibleColumns.map((col) => {
            const header = COLUMN_HEADERS[col];
            if (!header) return null;

            return (
              <TableHead
                key={col}
                className={header.sortable ? 'cursor-pointer select-none' : ''}
                onClick={header.sortable ? () => handleSort(col) : undefined}
              >
                <div className="flex items-center">
                  {header.label}
                  {header.sortable && getSortIcon(col)}
                </div>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.length === 0 ? (
          <TableRow>
            <td
              colSpan={visibleColumns.length}
              className="text-center py-8 text-muted-foreground"
            >
              No tasks found
            </td>
          </TableRow>
        ) : (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              visibleColumns={visibleColumns}
              onClick={() => handleRowClick(task.id)}
              assigneeName={
                task.assignedToUserId
                  ? memberMap[task.assignedToUserId]
                  : undefined
              }
            />
          ))
        )}
      </TableBody>
    </Table>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-views/task-table.tsx
git commit -m "feat: add TaskTable component with sortable columns"
```

---

## Phase 7: Kanban View Components

### Task 18: Create TaskCard component

**Files:**
- Create: `src/components/tasks/task-views/task-card.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { format } from 'date-fns';
import { Calendar, User, Zap } from 'lucide-react';
import type { TaskWithLabels } from '@/schemas/tasks';

interface TaskCardProps {
  task: TaskWithLabels;
  onClick: () => void;
  assigneeName?: string;
}

export function TaskCard({ task, onClick, assigneeName }: TaskCardProps) {
  const hasIcons = task.dueDate || task.assignedToUserId || task.stressLevel;

  return (
    <div
      className="bg-card border rounded-md p-3 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <div className="text-sm font-medium line-clamp-2">{task.title}</div>
      {hasIcons && (
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {task.stressLevel && task.stressLevel >= 7 && (
            <span className="flex items-center gap-0.5 text-yellow-500">
              <Zap className="h-3 w-3" />
              {task.stressLevel}
            </span>
          )}
          {task.dueDate && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {format(new Date(task.dueDate), 'MMM d')}
            </span>
          )}
          {task.assignedToUserId && assigneeName && (
            <span className="flex items-center gap-0.5">
              <User className="h-3 w-3" />
              {assigneeName}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-views/task-card.tsx
git commit -m "feat: add TaskCard component for kanban"
```

---

### Task 19: Create TaskKanban component

**Files:**
- Create: `src/components/tasks/task-views/task-kanban.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { TaskCard } from './task-card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { TaskWithLabels, TaskStatus } from '@/schemas/tasks';

const COLUMNS: { status: TaskStatus; label: string; icon: string }[] = [
  { status: 'backlog', label: 'Backlog', icon: '○' },
  { status: 'todo', label: 'Todo', icon: '○' },
  { status: 'in_progress', label: 'In Progress', icon: '◐' },
  { status: 'done', label: 'Done', icon: '●' },
];

interface TaskKanbanProps {
  listId: string;
  tasks: TaskWithLabels[];
  memberMap: Record<string, string>;
}

export function TaskKanban({ listId, tasks, memberMap }: TaskKanbanProps) {
  const router = useRouter();

  const handleCardClick = (taskId: string) => {
    router.push(`/lists/${listId}/tasks/${taskId}`);
  };

  const tasksByStatus = COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.status),
  }));

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {tasksByStatus.map((column) => (
          <div
            key={column.status}
            className="w-72 flex-shrink-0 bg-muted/30 rounded-lg"
          >
            {/* Column Header */}
            <div className="p-3 border-b">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{column.icon}</span>
                <span className="font-medium">{column.label}</span>
                <span className="text-muted-foreground text-sm">
                  ({column.tasks.length})
                </span>
              </div>
            </div>

            {/* Column Body */}
            <div className="p-2 space-y-2 min-h-[200px]">
              {column.tasks.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No tasks
                </div>
              ) : (
                column.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => handleCardClick(task.id)}
                    assigneeName={
                      task.assignedToUserId
                        ? memberMap[task.assignedToUserId]
                        : undefined
                    }
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-views/task-kanban.tsx
git commit -m "feat: add TaskKanban component"
```

---

### Task 20: Create task-views index

**Files:**
- Create: `src/components/tasks/task-views/index.ts`

**Step 1: Create the index file**

```typescript
export { TaskTable } from './task-table';
export { TaskKanban } from './task-kanban';
export { TaskRow } from './task-row';
export { TaskCard } from './task-card';
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-views/index.ts
git commit -m "feat: add task-views index exports"
```

---

## Phase 8: Wire Up ListDetail

### Task 21: Update ListDetail to fetch filtered tasks

**Files:**
- Modify: `src/app/pages/lists/ListDetail.tsx`

**Step 1: Update imports and add filter parsing**

Replace the entire file with:

```typescript
import { requestInfo, type RequestInfo } from 'rwsdk/worker';
import { AppLayout } from '@/app/app-layout';
import { db, getListDb } from '@/db';
import type { ListWithMembersAndTasks } from '@/schemas/lists';
import { taskWithLabelsSchema } from '@/schemas/tasks';
import { ListDetailContent } from '@/components/lists/list-detail-content';
import { parseTaskFiltersFromUrl, type TaskFilters } from '@/lib/task-filters';
import { queryTasks } from '@/queries/tasks';

async function getListById(
  listId: string
): Promise<Omit<ListWithMembersAndTasks, 'tasks'> | null> {
  const list = await db
    .selectFrom('lists')
    .innerJoin('list_members', 'lists.id', 'list_members.listId')
    .where('lists.id', '=', listId)
    .selectAll('lists')
    .executeTakeFirst();

  if (!list) {
    return null;
  }

  // Get members with user data
  const listMembersWithUsers = await db
    .selectFrom('list_members')
    .innerJoin('user', 'list_members.userId', 'user.id')
    .where('list_members.listId', '=', listId)
    .select([
      'list_members.id',
      'list_members.listId',
      'list_members.userId',
      'list_members.role',
      'list_members.joinedAt',
      'user.id as odontocete_user_id',
      'user.name as user_name',
      'user.email as user_email',
      'user.image as user_image',
      'user.username as user_username',
    ])
    .execute();

  return {
    ...list,
    members: listMembersWithUsers.map((row) => ({
      id: row.id,
      listId: row.listId,
      userId: row.userId,
      role: row.role as 'member' | 'owner',
      joinedAt: row.joinedAt,
      user: {
        id: row.odontocete_user_id,
        name: row.user_name,
        email: row.user_email,
        image: row.user_image,
        username: row.user_username,
      },
    })),
  };
}

export async function ListDetail({ params, ctx, request }: RequestInfo) {
  const listId = params.listId;

  if (!ctx.user?.id) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background ml-64">
          <div className="container mx-auto px-6 py-12">
            <p>Please log in to view this list</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Load list data
  const list = await getListById(listId);

  if (!list) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background ml-64">
          <div className="container mx-auto px-6 py-12">
            <p>List not found</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Parse filters from URL
  const url = new URL(request.url);
  const filters = parseTaskFiltersFromUrl(url);

  // Fetch filtered tasks
  const tasks = await queryTasks(listId, filters);

  // Build member map for display names
  const memberMap: Record<string, string> = {};
  for (const member of list.members) {
    memberMap[member.userId] = member.user?.name || member.user?.username || member.user?.email || 'Unknown';
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background ml-64">
        <div className="container mx-auto px-6 py-12">
          <ListDetailContent
            listId={listId}
            list={list}
            tasks={tasks}
            filters={filters}
            memberMap={memberMap}
          />
        </div>
      </div>
    </AppLayout>
  );
}
```

**Step 2: Verify types compile**

Run: `pnpm types`
Expected: Errors about ListDetailContent props (we'll fix next)

**Step 3: Commit**

```bash
git add src/app/pages/lists/ListDetail.tsx
git commit -m "feat: update ListDetail to fetch filtered tasks server-side"
```

---

### Task 22: Rewrite ListDetailContent with views and filters

**Files:**
- Modify: `src/components/lists/list-detail-content.tsx`

**Step 1: Replace the entire file**

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { DisplayToggle } from '@/components/tasks/display-toggle';
import { TaskFilterBar } from '@/components/tasks/task-filters';
import { TaskTable, TaskKanban } from '@/components/tasks/task-views';
import { useViewPreferences } from '@/lib/hooks/use-view-preferences';
import type { TaskWithLabels } from '@/schemas/tasks';
import type { TaskFilters } from '@/lib/task-filters';

interface ListMember {
  id: string;
  listId: string;
  userId: string;
  role: 'member' | 'owner';
  joinedAt: number;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    username: string | null;
  } | null;
}

interface ListData {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
  members: ListMember[];
}

interface ListDetailContentProps {
  listId: string;
  list: ListData;
  tasks: TaskWithLabels[];
  filters: TaskFilters;
  memberMap: Record<string, string>;
}

export function ListDetailContent({
  listId,
  list,
  tasks,
  filters,
  memberMap,
}: ListDetailContentProps) {
  const { viewMode, tableColumns, setViewMode, toggleColumn } =
    useViewPreferences(listId);

  const memberCount = list.members?.length ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <a href="/lists">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Lists
          </a>
        </Button>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-semibold tracking-tight">{list.name}</h1>
            <p className="text-muted-foreground mt-1">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} ·{' '}
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>
          <DisplayToggle
            viewMode={viewMode}
            tableColumns={tableColumns}
            onViewModeChange={setViewMode}
            onToggleColumn={toggleColumn}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-6">
        <TaskFilterBar listId={listId} filters={filters} />
      </div>

      {/* Task Views */}
      <div>
        {viewMode === 'table' ? (
          <TaskTable
            listId={listId}
            tasks={tasks}
            visibleColumns={tableColumns}
            filters={filters}
            memberMap={memberMap}
          />
        ) : (
          <TaskKanban listId={listId} tasks={tasks} memberMap={memberMap} />
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify types compile**

Run: `pnpm types`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/lists/list-detail-content.tsx
git commit -m "feat: rewrite ListDetailContent with table/kanban views and filters"
```

---

## Phase 9: Add Realtime Notifications to Task Handlers

### Task 23: Update task handlers to trigger realtime updates

**Files:**
- Modify: `src/app/api/tasks/handlers.ts`

**Step 1: Add realtime notification helper**

Add after the existing imports:

```typescript
import { renderRealtimeClients } from 'rwsdk/realtime/worker';

async function notifyListSubscribers(listId: string) {
  await renderRealtimeClients({
    durableObjectNamespace: env.REALTIME_DURABLE_OBJECT,
    key: `/lists/${listId}`,
  });
}
```

**Step 2: Update createTask function**

Find the `createTask` function and add realtime notification after the task is created. Replace the existing `createTask` function with:

```typescript
export async function createTask(
  listId: string,
  input: Omit<CreateTaskInput, 'listId'>
): Promise<Task> {
  const listDb = await getListDb({ listId });

  // Default dueDate to current time + 1 day if not provided
  const defaultDueDate = Date.now() + 86400000; // 24 hours from now
  const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const task = await listDb
    .insertInto('tasks')
    .values({
      id: nanoid(),
      title: input.title,
      description: input.description || '',
      status: input.status,
      stressLevel: input.stressLevel ?? 5,
      dueDate: input.dueDate ?? defaultDueDate,
      dueDateTimezone: input.dueDateTimezone || defaultTimezone,
      assignedToUserId: input.assignedToUserId || null,
      recurringTaskId: input.recurringTaskId || null,
      completedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // Notify all clients viewing this list
  await notifyListSubscribers(listId);

  return taskSchema.parse(task);
}
```

**Step 3: Remove the old SyncedState notification**

Remove these lines from the `createTask` function if they exist:

```typescript
const list = await getListById(listId);
const id = env.STATE_COORDINATOR.idFromName('syncedState');
const stub = env.STATE_COORDINATOR.get(id);
await stub.setState(list, `list:${listId}`);
```

**Step 4: Verify types compile**

Run: `pnpm types`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/tasks/handlers.ts
git commit -m "feat: add realtime notifications to task handlers"
```

---

## Phase 10: Final Integration

### Task 24: Verify the full flow works

**Step 1: Start the dev server**

Run: `pnpm dev`

**Step 2: Test the following manually**

1. Navigate to a list detail page
2. Verify tasks are displayed in table view
3. Click "Display" and switch to "Board" view
4. Verify kanban columns show tasks by status
5. Use the status filter to filter tasks
6. Verify URL updates with filter params
7. Create a task in another browser window
8. Verify the task appears in real-time

**Step 3: Fix any issues found**

Address any errors or issues discovered during testing.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete task views with realtime updates"
```

---

## Summary

This plan implements:

1. **Realtime infrastructure** - RealtimeDurableObject binding, ListDocument with realtime init
2. **Server-side filtering** - URL param parsing, Kysely query builder with all filters
3. **View preferences** - localStorage hook for view mode and column visibility
4. **Filter components** - Search, status, assignee, due date filters
5. **Table view** - Sortable columns, clickable rows
6. **Kanban view** - Status columns, compact cards
7. **Integration** - Updated ListDetail and ListDetailContent to wire everything together
8. **Realtime updates** - Task mutations trigger re-renders for all connected clients

**Estimated tasks: 24**
**Each task: 2-10 minutes**
