# Task Views Design: Table & Kanban with Server-Side Filtering

## Overview

Add task display to the list detail view with two view modes (table and kanban), comprehensive filtering, and real-time updates using rwsdk's realtime RSC system.

## Goals

- Display tasks in list detail view with table and kanban view modes
- Server-side filtering, sorting, and search for performance
- Real-time updates when any user modifies tasks
- Linear-style UI for view switching and filters
- Configurable table columns
- Shareable filtered views via URL params

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| View modes | Table + Kanban | Table for dense data, kanban for workflow visualization |
| Kanban grouping | By status | Natural workflow: backlog → todo → in_progress → done |
| Kanban card density | Compact (title + icons) | Scannable boards, avoids clutter |
| Table columns | Configurable | Users have different priorities |
| Filtering location | Server-side | Performance, works with realtime re-renders |
| Filter persistence | URL params | Shareable, works with RSC re-renders |
| View mode persistence | localStorage per list | UI preference, not shareable |
| Realtime approach | `renderRealtimeClients` | RSC re-renders with each client's filters |
| Task click action | Navigate to detail page | Simple, gives tasks their own URL |

## Component Architecture

```
src/components/tasks/
├── task-views/
│   ├── task-table.tsx          # Table view with sortable columns
│   ├── task-kanban.tsx         # Kanban board by status
│   ├── task-card.tsx           # Compact card for kanban
│   └── task-row.tsx            # Clickable table row
├── task-filters/
│   ├── task-filter-bar.tsx     # Horizontal filter bar (shared by both views)
│   ├── status-filter.tsx       # Multi-select status chips
│   ├── assignee-filter.tsx     # Assignee dropdown with avatars
│   ├── label-filter.tsx        # Label multi-select with colors
│   ├── due-date-filter.tsx     # Presets: overdue/today/this week/no date
│   ├── stress-filter.tsx       # Stress level range slider
│   ├── date-range-filter.tsx   # Created date range picker
│   └── search-input.tsx        # Debounced title search
├── display-toggle.tsx          # Linear-style Display button + popover
└── column-config.tsx           # Column visibility checkboxes (in Display popover)
```

## State Management

### URL Search Params (Server-Readable Filters)

```typescript
interface TaskQueryParams {
  search?: string;                    // Title search
  status?: string;                    // Comma-separated: "todo,in_progress"
  assignee?: string;                  // Comma-separated user IDs or "unassigned"
  labels?: string;                    // Comma-separated label IDs
  due?: 'overdue' | 'today' | 'week' | 'none';
  stressMin?: string;                 // "1" to "10"
  stressMax?: string;                 // "1" to "10"
  createdAfter?: string;              // Unix timestamp
  createdBefore?: string;             // Unix timestamp
  sort?: string;                      // Field name
  dir?: 'asc' | 'desc';
}

// Example URL:
// /lists/abc123?status=todo,in_progress&assignee=user1&sort=dueDate&dir=asc
```

### localStorage (UI Preferences)

```typescript
interface ListViewPreferences {
  viewMode: 'table' | 'kanban';
  tableColumns: string[];  // Visible column IDs
}

// Key format: `list-view-${listId}`
```

### Default Table Columns

```typescript
const DEFAULT_COLUMNS = ['title', 'status', 'stressLevel', 'dueDate', 'assignee', 'labels'];
const ALL_COLUMNS = ['title', 'status', 'stressLevel', 'dueDate', 'assignee', 'labels', 'description', 'createdAt', 'updatedAt'];
```

## UI Layout

### List Detail Page

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Lists                                                 │
│ [List Name - editable]                           [Display ▾]    │
│ 3 members                                                       │
├─────────────────────────────────────────────────────────────────┤
│ [🔍 Search...] [Status ▾] [Assignee ▾] [Labels ▾] [Due ▾]      │
│                [Stress ▾] [Created ▾]              [Clear all]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   TaskTable or TaskKanban renders here based on viewMode        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Display Popover (Linear-style)

```
┌────────────────────────────┐
│  ☰ List      ⊞ Board      │  ← Segmented toggle
├────────────────────────────┤
│  Columns                   │  ← Only visible in List mode
│  ☑ Title                   │
│  ☑ Status                  │
│  ☑ Stress Level            │
│  ☑ Due Date                │
│  ☑ Assignee                │
│  ☑ Labels                  │
│  ☐ Description             │
│  ☐ Created                 │
│  ☐ Updated                 │
└────────────────────────────┘
```

### Table View

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Title ↕        │ Status ↕    │ Stress ↕ │ Due Date ↕  │ Assignee │ Labels│
├──────────────────────────────────────────────────────────────────────────┤
│ Fix login bug  │ ◐ Progress  │ ⚡ 8     │ Nov 25      │ 👤 Casey │ 🏷 bug │
│ Add dark mode  │ ○ Backlog   │ ⚡ 3     │ Dec 1       │ —        │       │
│ Write tests    │ ○ Todo      │ ⚡ 5     │ Nov 30      │ 👤 Alex  │ 🏷 dev │
└──────────────────────────────────────────────────────────────────────────┘
```

- Click row → navigate to `/lists/:listId/tasks/:taskId`
- Click column header → toggle sort
- Sortable indicator shows current sort field and direction

### Kanban View

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Backlog    │ │    Todo     │ │ In Progress │ │    Done     │
│     (2)     │ │     (3)     │ │     (1)     │ │     (5)     │
├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────┤
│ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │
│ │Add dark │ │ │ │Write    │ │ │ │Fix login│ │ │ │Deploy   │ │
│ │mode     │ │ │ │tests    │ │ │ │bug      │ │ │ │v2.0     │ │
│ │    📅 👤│ │ │ │    📅 👤│ │ │ │⚡8 📅 👤│ │ │ │    📅 👤│ │
│ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │
│ ┌─────────┐ │ │ ┌─────────┐ │ │             │ │ ┌─────────┐ │
│ │Research │ │ │ │Update   │ │ │             │ │ │Fix typo │ │
│ │API      │ │ │ │docs     │ │ │             │ │ │         │ │
│ └─────────┘ │ │ └─────────┘ │ │             │ │ └─────────┘ │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

- Compact cards: title + small icons for due date/assignee/stress (only if set)
- Click card → navigate to task detail page
- Column headers show count of tasks in that status
- Same sort order applies within each column

## Realtime Architecture

### Setup Requirements

**1. Durable Object binding** (`wrangler.jsonc`):
```json
{
  "durable_objects": {
    "bindings": [
      {
        "name": "REALTIME_DURABLE_OBJECT",
        "class_name": "RealtimeDurableObject"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v4",
      "new_classes": ["RealtimeDurableObject"]
    }
  ]
}
```

**2. Worker exports** (`src/worker.tsx`):
```typescript
import { realtimeRoute } from "rwsdk/realtime/worker";
export { RealtimeDurableObject } from "rwsdk/realtime/durableObject";

export default defineApp([
  // ...existing middleware
  realtimeRoute(() => env.REALTIME_DURABLE_OBJECT),
  // ...existing routes
]);
```

**3. List-specific Document** (`src/app/pages/lists/ListDocument.tsx`):
```typescript
import { requestInfo } from "rwsdk/worker";
import { RealtimeInit } from "@/components/realtime-init";

export const ListDocument: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { ctx, params } = requestInfo;
  const listId = params.listId;
  const theme = ctx.theme || 'light';

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
        <RealtimeInit listId={listId} />
      </body>
    </html>
  );
};
```

**4. Client realtime initialization** (`src/components/realtime-init.tsx`):
```typescript
"use client";
import { initRealtimeClient } from "rwsdk/realtime/client";
import { useEffect } from "react";

export function RealtimeInit({ listId }: { listId: string }) {
  useEffect(() => {
    initRealtimeClient({ key: `/lists/${listId}` });
  }, [listId]);
  return null;
}
```

**5. Routing update** (`src/worker.tsx`):
```typescript
import { ListDocument } from "@/app/pages/lists/ListDocument";

export default defineApp([
  // ...
  render(Document, [
    route('/', Home),
    route('/login', Login),
    route('/lists', Lists),
  ]),
  render(ListDocument, [
    route('/lists/:listId', ListDetail),
    route('/lists/:listId/tasks/:taskId', TaskDetail),
  ]),
]);
```

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client A   │     │    Server    │     │   Client B   │
│ (filter: all)│     │              │     │(filter: todo)│
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  GET /lists/123    │                    │
       │  ?status=all       │                    │
       │───────────────────>│                    │
       │                    │                    │
       │    RSC with all    │                    │
       │       tasks        │                    │
       │<───────────────────│                    │
       │                    │                    │
       │                    │  GET /lists/123    │
       │                    │  ?status=todo      │
       │                    │<───────────────────│
       │                    │                    │
       │                    │  RSC with todo     │
       │                    │     tasks only     │
       │                    │───────────────────>│
       │                    │                    │
       │  POST create task  │                    │
       │  (status: todo)    │                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ renderRealtimeClients
       │                    │   key: /lists/123  │
       │                    │                    │
       │   RSC re-render    │   RSC re-render    │
       │   (with filter)    │   (with filter)    │
       │<───────────────────│───────────────────>│
       │                    │                    │
       │  Shows new task    │  Shows new task    │
       │  (matches filter)  │  (matches filter)  │
```

### Task Mutation Handler Pattern

```typescript
// src/app/api/tasks/handlers.ts
import { renderRealtimeClients } from "rwsdk/realtime/worker";
import { env } from "cloudflare:workers";

async function notifyListSubscribers(listId: string) {
  await renderRealtimeClients({
    durableObjectNamespace: env.REALTIME_DURABLE_OBJECT,
    key: `/lists/${listId}`,
  });
}

export async function handleCreateTask({ request, params }: RequestInfo) {
  const body = await request.json();
  const task = await createTaskInDb(body);

  await notifyListSubscribers(body.listId);

  return Response.json(task, { status: 201 });
}

export async function handleUpdateTask({ request, params }: RequestInfo) {
  const body = await request.json();
  const task = await updateTaskInDb(params.taskId, body);

  await notifyListSubscribers(task.listId);

  return Response.json(task);
}

export async function handleDeleteTask({ params }: RequestInfo) {
  const task = await getTaskById(params.taskId);
  await deleteTaskFromDb(params.taskId);

  await notifyListSubscribers(task.listId);

  return new Response(null, { status: 204 });
}
```

## Server-Side Query Building

```typescript
// src/queries/tasks.ts
import { db } from "@/db";

interface TaskQueryParams {
  listId: string;
  search?: string;
  statuses?: string[];
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

export async function queryTasks(params: TaskQueryParams) {
  const listDb = await getListDb({ listId: params.listId });

  let query = listDb
    .selectFrom('tasks')
    .selectAll();

  // Status filter
  if (params.statuses?.length) {
    query = query.where('status', 'in', params.statuses);
  }

  // Assignee filter
  if (params.assigneeIds?.length) {
    if (params.assigneeIds.includes('unassigned')) {
      const assigned = params.assigneeIds.filter(id => id !== 'unassigned');
      if (assigned.length) {
        query = query.where(eb => eb.or([
          eb('assignedToUserId', 'is', null),
          eb('assignedToUserId', 'in', assigned)
        ]));
      } else {
        query = query.where('assignedToUserId', 'is', null);
      }
    } else {
      query = query.where('assignedToUserId', 'in', params.assigneeIds);
    }
  }

  // Search filter
  if (params.search) {
    query = query.where('title', 'like', `%${params.search}%`);
  }

  // Due date filter
  if (params.dueRange) {
    const now = Date.now();
    const today = startOfDay(now);
    const endOfWeek = addDays(today, 7);

    switch (params.dueRange) {
      case 'overdue':
        query = query.where('dueDate', '<', now);
        break;
      case 'today':
        query = query.where('dueDate', '>=', today)
                     .where('dueDate', '<', addDays(today, 1));
        break;
      case 'week':
        query = query.where('dueDate', '>=', today)
                     .where('dueDate', '<', endOfWeek);
        break;
      case 'none':
        query = query.where('dueDate', 'is', null);
        break;
    }
  }

  // Stress level filter
  if (params.stressMin !== undefined) {
    query = query.where('stressLevel', '>=', params.stressMin);
  }
  if (params.stressMax !== undefined) {
    query = query.where('stressLevel', '<=', params.stressMax);
  }

  // Created date filter
  if (params.createdAfter !== undefined) {
    query = query.where('createdAt', '>=', params.createdAfter);
  }
  if (params.createdBefore !== undefined) {
    query = query.where('createdAt', '<=', params.createdBefore);
  }

  // Sorting
  const sortField = params.sortField || 'createdAt';
  const sortDir = params.sortDirection || 'desc';
  query = query.orderBy(sortField, sortDir);

  return query.execute();
}
```

## Migration from useSyncedState

The current `ListDetailContent` uses `useSyncedState` for real-time list updates. This will be replaced:

**Before:**
```typescript
'use client';
import { useSyncedState } from 'rwsdk/use-synced-state/client';

export function ListDetailContent({ listId, initialData }) {
  const [list, setList] = useSyncedState(initialData, `list-${listId}`);
  // Client-side state management
}
```

**After:**
```typescript
// Server component - no 'use client'
export function ListDetailContent({ list, tasks, filters }) {
  // Pure rendering - data comes from server
  // Filter changes update URL → triggers RSC re-render
  // Task mutations → API call → renderRealtimeClients → RSC re-render
}
```

The `SyncedStateServer` handlers for lists can remain if other features use them, or be removed if fully migrated to the realtime RSC pattern.

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/app/pages/lists/ListDocument.tsx` | Realtime-enabled Document for list pages |
| `src/components/realtime-init.tsx` | Client component to init realtime subscription |
| `src/components/tasks/task-views/task-table.tsx` | Table view component |
| `src/components/tasks/task-views/task-kanban.tsx` | Kanban board component |
| `src/components/tasks/task-views/task-card.tsx` | Compact kanban card |
| `src/components/tasks/task-views/task-row.tsx` | Table row component |
| `src/components/tasks/task-filters/task-filter-bar.tsx` | Filter bar container |
| `src/components/tasks/task-filters/status-filter.tsx` | Status multi-select |
| `src/components/tasks/task-filters/assignee-filter.tsx` | Assignee filter |
| `src/components/tasks/task-filters/label-filter.tsx` | Label filter |
| `src/components/tasks/task-filters/due-date-filter.tsx` | Due date presets |
| `src/components/tasks/task-filters/stress-filter.tsx` | Stress range filter |
| `src/components/tasks/task-filters/date-range-filter.tsx` | Created date range |
| `src/components/tasks/task-filters/search-input.tsx` | Debounced search |
| `src/components/tasks/display-toggle.tsx` | View mode toggle + column config |
| `src/lib/hooks/use-view-preferences.ts` | localStorage hook for view prefs |
| `src/lib/hooks/use-task-filters.ts` | URL param management for filters |

### Modified Files

| File | Changes |
|------|---------|
| `wrangler.jsonc` | Add `REALTIME_DURABLE_OBJECT` binding |
| `src/worker.tsx` | Add realtime route, export DO, use ListDocument |
| `src/app/pages/lists/ListDetail.tsx` | Query tasks with filters from URL params |
| `src/components/lists/list-detail-content.tsx` | Remove useSyncedState, add filter bar + views |
| `src/app/api/tasks/handlers.ts` | Add `renderRealtimeClients` calls |
| `src/queries/tasks.ts` | Add `queryTasks` with filter support |

## Implementation Order

1. **Realtime infrastructure** - DO binding, worker setup, ListDocument, RealtimeInit
2. **Query layer** - `queryTasks` with filter support
3. **View preferences hook** - localStorage for view mode and columns
4. **Filter URL hook** - URL param management with debounced search
5. **Display toggle** - View mode switch and column config popover
6. **Filter bar** - All filter components
7. **Table view** - TaskTable, TaskRow with sorting
8. **Kanban view** - TaskKanban, TaskCard
9. **Wire up ListDetail** - Integrate all components
10. **Task mutations** - Add `renderRealtimeClients` to handlers
11. **Remove useSyncedState** - Clean up old approach

## Testing Checklist

- [ ] Table view displays tasks with correct columns
- [ ] Column visibility persists in localStorage
- [ ] Clicking column header sorts table
- [ ] Sort direction toggles on repeated clicks
- [ ] Kanban view groups tasks by status
- [ ] Kanban cards show title + icons
- [ ] View mode toggle switches between table/kanban
- [ ] View mode persists in localStorage per list
- [ ] Each filter updates URL params
- [ ] Filters apply server-side (check network tab)
- [ ] Search debounces before updating URL
- [ ] Clear all button resets filters
- [ ] Creating task in one window appears in another
- [ ] Filtered views update correctly (task appears/disappears based on filter)
- [ ] Task click navigates to detail page
- [ ] Back button preserves filters (URL-based)
