# Task Management System Design

**Date:** 2025-11-22
**Status:** Design Complete, Ready for Implementation

## Overview

A collaborative task management system focused on tracking "stress debt" - the mental burden of outstanding tasks. Features real-time collaboration, recurring tasks, and stress metrics to help users understand the weight of their responsibilities.

### Core Features

- **Stress Debt Tracking:** Calculate mental burden based on user-defined stress levels, task age, and urgency
- **Real-time Collaboration:** Multiple users can work on shared lists with live updates
- **Recurring Tasks:** Automated task spawning based on patterns (daily/weekly/monthly)
- **Linear-like UX:** Keyboard-driven, fast, minimal interface with drag-and-drop
- **Multi-database Architecture:** Hybrid User DO + List DO for optimal performance

---

## Database Architecture

### Strategy: Two Durable Objects

**CentralDatabase** (singleton, keyed by `auth-database`)

- Stores user authentication (Better Auth tables)
- Global registry of all lists (`lists` table)
- List membership tracking (`list_members` junction table)
- Single source of truth for "who can access what"

**ListDatabase** (one per list, keyed by `list:{listId}`)

- Single source of truth for each list's data
- Contains all tasks, labels, recurring tasks, skipped instances
- Real-time sync via `useSyncedState`

### Database Schema (Minimal Modeling)

#### Anchors (Entities)

- **User:** People who use the system
- **List:** Collection of tasks
- **Task:** Individual work item
- **Label:** Category/tag for filtering
- **RecurringPattern:** Template/rule for spawning recurring tasks
- **RecurringTaskException:** A modification to a specific occurrence (skip or reschedule)

#### Links (Relationships)

```
User ↔ List (N:M) → list_members junction table in CentralDB
Task ↔ Label (N:M) → task_labels junction table
Task ↔ User (N:1) → assignedToUserId in tasks table
Task ↔ RecurringPattern (N:1) → recurringTaskId in tasks table
RecurringPattern ↔ RecurringTaskException (1:N) → recurringTaskId in recurring_task_exceptions table
RecurringTaskException ↔ Task (0-or-1:0-or-1) → affectedTaskId in recurring_task_exceptions table
```

**Validation:**
- "A RecurringPattern can have several Exceptions" ✓
- "An Exception belongs to one RecurringPattern" ✓
- "An Exception can affect one Task (or none, if created before generation)" ✓
- "A Task can be affected by one Exception (or none, if it's a normal occurrence)" ✓
```

#### Physical Schema

**CentralDatabase Tables:**

```typescript
// user table (Better Auth)
{
  id: string (primary key)
  email: string
  emailVerified: boolean
  name: string
  image: string
  username: string (unique)
  createdAt: string (ISO timestamp)
  updatedAt: string (ISO timestamp)
}

// lists table (all lists in the system)
{
  id: string (primary key)
  name: string
  createdAt: string (ISO timestamp)
  updatedAt: string (ISO timestamp)
}

// list_members table (N:M junction - who can access which lists)
{
  id: string (primary key)
  listId: string (FK to lists.id)
  userId: string (FK to user.id)
  role: string ('member' | 'owner', default 'member')
  joinedAt: number (Unix epoch millis)
}

// ... other Better Auth tables (account, session, verification)
```

**ListDatabase Tables:**

```typescript
// tasks table
{
  id: string (primary key)
  title: string (NOT NULL)
  description: string (default '')
  status: string ('backlog' | 'todo' | 'in_progress' | 'done', default 'todo')
  stressLevel: number (1-10, default 5)
  dueDate: number (Unix epoch millis, NOT NULL)
  dueDateTimezone: string (e.g., 'America/New_York', NOT NULL)
  assignedToUserId: string (nullable)
  recurringTaskId: string (FK to recurring_tasks.id, nullable)
  createdAt: number (Unix epoch millis, NOT NULL)
  updatedAt: number (Unix epoch millis, NOT NULL)
  completedAt: number (Unix epoch millis, nullable)
}

// labels table
{
  id: string (primary key)
  name: string (NOT NULL)
  color: string (hex color, e.g., '#3b82f6')
  createdAt: number (Unix epoch millis)
  updatedAt: number (Unix epoch millis)
}

// task_labels table (N:M junction)
{
  taskId: string (FK to tasks.id)
  labelId: string (FK to labels.id)
  PRIMARY KEY (taskId, labelId)
}

// recurring_tasks table (pattern/rule for spawning tasks)
{
  id: string (primary key)
  title: string (NOT NULL)
  description: string (default '')
  stressLevel: number (1-10, nullable)
  frequency: string ('daily' | 'weekly' | 'monthly')
  interval: number (e.g., 2 for "every 2 weeks")
  startDate: number (Unix epoch millis - when pattern starts)
  createdAt: number (Unix epoch millis)
  updatedAt: number (Unix epoch millis)
}

// recurring_task_exceptions table (modifications to specific occurrences)
{
  id: string (primary key)
  recurringTaskId: string (FK to recurring_tasks.id, NOT NULL)
  originalDate: number (Unix epoch millis - the original scheduled date)
  originalTimezone: string (timezone of original occurrence)
  exceptionType: string ('skip' | 'reschedule')
  newDate: number (Unix epoch millis - only for reschedules, nullable)
  newTimezone: string (timezone for rescheduled date, nullable)
  reason: string (optional user note, default '')
  affectedTaskId: string (FK to tasks.id, nullable - links to generated task if it exists)
  createdAt: number (Unix epoch millis)
  updatedAt: number (Unix epoch millis)
}
```

### Date Handling

**Storage:** Unix epoch milliseconds (INTEGER in SQLite)

- Compact (8 bytes)
- Fast sorting/comparisons
- Easy conversion: `date.getTime()` and `new Date(millis)`

**Serialization:**

```typescript
// lib/dates.ts
export function serializeDate(date: Date | null): number | null {
  return date ? date.getTime() : null;
}

export function deserializeDate(epochMillis: number | null): Date | null {
  return epochMillis ? new Date(epochMillis) : null;
}
```

**Usage:**

```typescript
// Client works with Date objects
import { format, differenceInDays } from 'date-fns';
const age = differenceInDays(new Date(), task.createdAt);
```

### Database Access Pattern

**Centralized accessor in `db/index.ts`:**

```typescript
import { env } from 'cloudflare:workers';
import { type Database, createDb } from 'rwsdk/db';
import { type migrations } from '@/db/centralDbMigrations';

// Central database (auth + lists + membership)
export type CentralDatabase = Database<typeof migrations>;
export const db = createDb<CentralDatabase>(env.DATABASE, 'auth-database');

// List database accessor (per-list data)
export function getListDb(listId: string) {
  return createDb<ListDatabase>(env.LIST_DATABASE, `list:${listId}`);
}
```

**Usage:**

```typescript
import { db, getListDb } from '@/db';

// Access central DB (users, lists, membership)
const lists = await db.selectFrom('lists').selectAll().execute();

// Access specific list DB (tasks, labels, recurring tasks)
const listDb = getListDb(listId);
const tasks = await listDb.selectFrom('tasks').selectAll().execute();
```

---

## Data Flow & Real-time Sync

### User Login & List Loading

1. User authenticates → Better Auth creates session in CentralDatabase
2. Worker queries `list_members` table in CentralDatabase → get accessible list IDs
3. Frontend receives list of accessible lists
4. User selects a list → Worker loads that list's ListDatabase DO

### Real-time Collaboration with useSyncedState

```typescript
// Frontend syncs state from List DO
const [tasks, setTasks] = useSyncedState<Task[]>([], `list:${listId}:tasks`);
const [labels, setLabels] = useSyncedState<Label[]>(
  [],
  `list:${listId}:labels`
);

// Update task - all collaborators see change immediately
function completeTask(taskId: string) {
  setTasks((tasks) =>
    tasks.map((t) =>
      t.id === taskId ? { ...t, status: 'done', completed_at: Date.now() } : t
    )
  );
}
```

**Flow:**

1. User A calls `setTasks()` → update sent to ListDatabase DO
2. List DO updates SQLite database
3. List DO broadcasts change via WebSocket to all connected clients
4. User B's `useSyncedState` hook receives update → UI re-renders
5. Single source of truth - no manual sync logic needed

### Permission Checking

- List DO verifies `user_id` exists in `list_members` before allowing operations
- Simple permissions: if you're a member, you have full access
- Future: Add role-based permissions (owner, editor, viewer)

### Inviting Users

```typescript
// Add to list_members in CentralDB
await db.insertInto('list_members').values({
  id: crypto.randomUUID(),
  listId: listId,
  userId: invitedUserId,
  role: 'member',
  joinedAt: Date.now(),
});

// That's it! User now has access to the list
```

---

## Mental Burden Calculation

### Formula

```typescript
mentalBurden = stressLevel × ageMultiplier × urgencyFactor
```

### Components

**1. Stress Level** (user input, 1-10)

- User sets when creating/editing task
- Represents anxiety/importance
- Nullable - not all tasks need stress tracking

**2. Age Multiplier** (system calculated)

```typescript
function calculateAgeMultiplier(
  createdAt: Date,
  completedAt: Date | null
): number {
  const now = completedAt || new Date();
  const ageInDays = differenceInDays(now, createdAt);

  // Linear growth: tasks get more burdensome over time
  // Day 0: 1.0x, Day 30: 2.0x, Day 90: 4.0x
  return 1 + ageInDays / 30;
}
```

**3. Urgency Factor** (due date proximity)

```typescript
function calculateUrgencyFactor(dueDate: Date | null): number {
  if (!dueDate) return 1.0; // No deadline

  const daysUntilDue = differenceInDays(dueDate, new Date());

  if (daysUntilDue < 0) return 3.0; // Overdue!
  if (daysUntilDue === 0) return 2.5; // Due today
  if (daysUntilDue <= 3) return 2.0; // Due this week
  if (daysUntilDue <= 7) return 1.5; // Due next week
  return 1.0; // Due far in future
}
```

### Implementation

```typescript
// lib/stress-debt.ts
export function calculateMentalBurden(task: Task): number {
  if (!task.stressLevel) return 0;

  const age = calculateAgeMultiplier(task.createdAt, task.completedAt);
  const urgency = calculateUrgencyFactor(task.dueDate);

  return task.stressLevel * age * urgency;
}

export function calculateTotalStressDebt(tasks: Task[]): number {
  return tasks
    .filter((t) => t.status !== 'done')
    .reduce((sum, task) => sum + calculateMentalBurden(task), 0);
}
```

### Display

- Per-task burden indicator (color: green < 10, yellow 10-30, red > 30)
- List total "Stress Debt Score"
- Dashboard with top stressors and trends

---

## Recurring Task Spawning

### Strategy: Calculation-Based (No Mutable State)

**Key Insight:** We don't track "next occurrence" in the database. Instead, we calculate what _should_ exist based on the pattern's `startDate`, and compare against what _does_ exist (already-spawned tasks and skipped instances).

**Why this is better:**

- Pattern is immutable (except for user edits)
- No need to update `next_occurrence_date` after spawning
- Pattern updates (frequency changes) work automatically
- Skipping instances is a simple insert, not a state mutation

### Spawning Algorithm

```typescript
// Called when list loads or via cron
export async function spawnDueRecurringTasks(listDb: Kysely<ListDatabase>) {
  const recurringTasks = await listDb
    .selectFrom('recurring_tasks')
    .selectAll()
    .execute();
  const now = Date.now();

  for (const pattern of recurringTasks) {
    // Calculate all dates that should have spawned between startDate and now
    const expectedDates = calculateExpectedDates(pattern, now);

    for (const expectedDate of expectedDates) {
      // Check if this date already has a spawned task
      const existing = await listDb
        .selectFrom('tasks')
        .where('recurringTaskId', '=', pattern.id)
        .where('createdAt', '>=', startOfDay(expectedDate))
        .where('createdAt', '<=', endOfDay(expectedDate))
        .executeTakeFirst();

      if (existing) continue; // Already spawned

      // Check if there's an exception for this occurrence
      const exception = await listDb
        .selectFrom('recurring_task_exceptions')
        .where('recurringTaskId', '=', pattern.id)
        .where('originalDate', '=', startOfDay(expectedDate))
        .executeTakeFirst();

      if (exception?.exceptionType === 'skip') {
        continue; // User skipped this occurrence
      }

      // Determine the actual due date (use rescheduled date if applicable)
      const actualDueDate = exception?.exceptionType === 'reschedule'
        ? exception.newDate
        : expectedDate;

      const actualTimezone = exception?.exceptionType === 'reschedule'
        ? exception.newTimezone
        : pattern.timezone; // or user's default timezone

      // Spawn the task
      const taskId = crypto.randomUUID();
      await listDb
        .insertInto('tasks')
        .values({
          id: taskId,
          title: pattern.title,
          description: pattern.description,
          status: 'todo',
          stressLevel: pattern.stressLevel,
          dueDate: actualDueDate,
          dueDateTimezone: actualTimezone,
          recurringTaskId: pattern.id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .execute();

      // Link the exception to the task if one exists
      if (exception) {
        await listDb
          .updateTable('recurring_task_exceptions')
          .set({ affectedTaskId: taskId })
          .where('id', '=', exception.id)
          .execute();
      }
    }
  }
}

function calculateExpectedDates(
  pattern: RecurringPattern,
  until: number
): number[] {
  const dates: number[] = [];
  let currentDate = pattern.startDate;

  while (currentDate <= until) {
    dates.push(currentDate);

    // Calculate next occurrence based on frequency
    switch (pattern.frequency) {
      case 'daily':
        currentDate = addDays(
          new Date(currentDate),
          pattern.interval
        ).getTime();
        break;
      case 'weekly':
        currentDate = addWeeks(
          new Date(currentDate),
          pattern.interval
        ).getTime();
        break;
      case 'monthly':
        currentDate = addMonths(
          new Date(currentDate),
          pattern.interval
        ).getTime();
        break;
    }
  }

  return dates;
}
```

### Just-in-time Spawning

```typescript
// In List DO, called when loading tasks
export async function loadTasks(listId: string): Promise<Task[]> {
  const listDb = getListDb(listId);

  // Spawn any due tasks first (idempotent)
  await spawnDueRecurringTasks(listDb);

  const rows = await listDb.selectFrom('tasks').selectAll().execute();
  return rows.map(deserializeTask);
}
```

### Cron Implementation

**wrangler.jsonc:**

```json
{
  "triggers": {
    "crons": ["0 6 * * *"] // Daily at 6 AM UTC
  }
}
```

**worker.tsx:**

```typescript
export default {
  fetch: app.fetch,

  async scheduled(controller: ScheduledController) {
    try {
      switch (controller.cron) {
        case '0 6 * * *': {
          await spawnRecurringTasksGlobally();
          console.log('✅ Daily recurring task spawn complete');
          break;
        }
      }
    } catch (error) {
      console.error('Cron error:', error);
    }
  },
} satisfies ExportedHandler<Env>;
```

**Global spawning logic:**

```typescript
// lib/recurring-cron.ts
export async function spawnRecurringTasksGlobally() {
  // Get all lists from CentralDB
  const lists = await db.selectFrom('lists').selectAll().execute();

  for (const { id: listId } of lists) {
    const listDb = getListDb(listId);

    // Use the same spawning logic as just-in-time
    await spawnDueRecurringTasks(listDb);
  }
}
```

### Testing Cron Locally

```bash
# Test cron trigger
curl "http://localhost:5173/cdn-cgi/handler/scheduled?cron=0+6+*+*+*"
```

### Updating Recurring Patterns

When a user updates a recurring pattern (e.g., changing from daily to weekly), we simply update the pattern record. Already-spawned tasks remain unchanged (they're independent Task instances). Future spawning uses the new pattern.

```typescript
// Update pattern frequency
await listDb
  .updateTable('recurring_tasks')
  .set({
    frequency: 'weekly',
    interval: 1,
    updatedAt: Date.now(),
  })
  .where('id', '=', patternId)
  .execute();

// Future spawns will use the new frequency
// Already-spawned tasks remain as-is
```

### Managing Recurring Task Exceptions

Exceptions allow you to modify specific occurrences of a recurring pattern without changing the pattern itself. Two types of exceptions are supported: **skip** and **reschedule**.

#### Scenario 1: Exception Before Task Generation

When you create an exception for a future occurrence that hasn't been generated yet:

```typescript
// Skip a specific occurrence (e.g., "skip July 4th for my daily standup")
await listDb.insertInto('recurring_task_exceptions').values({
  id: crypto.randomUUID(),
  recurringTaskId: patternId,
  originalDate: startOfDay(new Date('2025-07-04')).getTime(),
  originalTimezone: 'America/New_York',
  exceptionType: 'skip',
  reason: 'Holiday - Independence Day',
  affectedTaskId: null, // No task exists yet
  createdAt: Date.now(),
  updatedAt: Date.now(),
}).execute();

// Reschedule a specific occurrence (e.g., move Monday meeting to Tuesday)
await listDb.insertInto('recurring_task_exceptions').values({
  id: crypto.randomUUID(),
  recurringTaskId: patternId,
  originalDate: startOfDay(new Date('2025-07-07')).getTime(), // Monday
  originalTimezone: 'America/New_York',
  exceptionType: 'reschedule',
  newDate: startOfDay(new Date('2025-07-08')).getTime(), // Tuesday
  newTimezone: 'America/New_York',
  reason: 'Conflict with all-hands meeting',
  affectedTaskId: null, // No task exists yet
  createdAt: Date.now(),
  updatedAt: Date.now(),
}).execute();
```

When the spawning algorithm runs, it will:
- **Skip**: Not create a task for that date
- **Reschedule**: Create a task with the `newDate` instead of `originalDate`, then link it via `affectedTaskId`

#### Scenario 2: Exception For Already-Generated Task

When you modify an occurrence that already has a generated task:

```typescript
// Skip an existing task
const existingTask = await listDb
  .selectFrom('tasks')
  .where('id', '=', taskId)
  .selectTakeFirst();

// Mark task as skipped (preserves history)
await listDb
  .updateTable('tasks')
  .set({ status: 'skipped', updatedAt: Date.now() })
  .where('id', '=', taskId)
  .execute();

// Create exception record
await listDb.insertInto('recurring_task_exceptions').values({
  id: crypto.randomUUID(),
  recurringTaskId: existingTask.recurringTaskId,
  originalDate: existingTask.dueDate,
  originalTimezone: existingTask.dueDateTimezone,
  exceptionType: 'skip',
  reason: 'No longer needed',
  affectedTaskId: taskId, // Link to existing task
  createdAt: Date.now(),
  updatedAt: Date.now(),
}).execute();

// Reschedule an existing task
await listDb
  .updateTable('tasks')
  .set({
    dueDate: newDate,
    dueDateTimezone: newTimezone,
    updatedAt: Date.now(),
  })
  .where('id', '=', taskId)
  .execute();

// Create exception record
await listDb.insertInto('recurring_task_exceptions').values({
  id: crypto.randomUUID(),
  recurringTaskId: existingTask.recurringTaskId,
  originalDate: existingTask.dueDate,
  originalTimezone: existingTask.dueDateTimezone,
  exceptionType: 'reschedule',
  newDate: newDate,
  newTimezone: newTimezone,
  reason: 'Schedule conflict',
  affectedTaskId: taskId, // Link to existing task
  createdAt: Date.now(),
  updatedAt: Date.now(),
}).execute();
```

#### Minimal Modeling Validation

- **Anchor:** RecurringTaskException (represents a modification to a specific occurrence)
- **Links:**
  - RecurringPattern ↔ RecurringTaskException (1:N)
    - "A RecurringPattern can have several Exceptions" ✓
    - "An Exception belongs to one RecurringPattern" ✓
  - RecurringTaskException ↔ Task (0-or-1:0-or-1)
    - "An Exception can affect one Task (or none)" ✓
    - "A Task can be affected by one Exception (or none)" ✓

The exceptions table is the source of truth for deviations from the recurring pattern, whether the task instance exists yet or not.

---

## API Operations & Routes

### Architecture

**useSyncedState:** Real-time collaborative state (tasks, labels, list metadata)
**REST API:** Actions and setup (create list, invite users, manage recurring tasks)

### Route Structure

```
src/
  api/
    lists/
      handlers.ts       # Business logic
      routes.ts         # Route definitions
    tasks/
      handlers.ts
      routes.ts
    recurring-tasks/
      handlers.ts
      routes.ts
  lib/
    middleware/
      permissions.ts    # Permission middleware
    server/
      lists.ts          # Server-side methods (no HTTP)
      tasks.ts
```

### Permission Middleware

```typescript
// lib/middleware/permissions.ts
import { db } from '@/db';

export async function requireListAccess({ params, ctx }: RequestInfo) {
  if (!ctx.user) return new Response('Unauthorized', { status: 401 });

  // Check membership in CentralDB
  const member = await db
    .selectFrom('list_members')
    .where('listId', '=', params.listId)
    .where('userId', '=', ctx.user.id)
    .executeTakeFirst();

  if (!member) return new Response('Forbidden', { status: 403 });

  ctx.listMember = member;
}

export async function requireAuth({ ctx }: RequestInfo) {
  if (!ctx.user) return new Response('Unauthorized', { status: 401 });
}
```

### Route Definitions

```typescript
// api/lists/routes.ts
export const listRoutes = [
  route('/api/lists', {
    get: [requireAuth, getUserLists],
    post: [requireAuth, createList],
  }),

  route('/api/lists/:listId', {
    delete: [requireListAccess, deleteList],
  }),

  route('/api/lists/:listId/invite', {
    post: [requireListAccess, inviteToList],
  }),
];

// api/tasks/routes.ts
export const taskRoutes = [
  route('/api/lists/:listId/tasks', {
    get: [requireListAccess, getTasks],
    post: [requireListAccess, createTask],
  }),

  route('/api/lists/:listId/tasks/:taskId', {
    patch: [requireListAccess, updateTask],
    delete: [requireListAccess, deleteTask],
  }),
];

// api/recurring-tasks/routes.ts
export const recurringTaskRoutes = [
  route('/api/lists/:listId/recurring-tasks', {
    post: [requireListAccess, createRecurringTask],
  }),

  route('/api/lists/:listId/recurring-tasks/:recurringTaskId', {
    patch: [requireListAccess, updateRecurringTask],
    delete: [requireListAccess, deleteRecurringTask],
  }),
];
```

### Handler Example

```typescript
// api/lists/handlers.ts
import { db } from '@/db';

export async function createList({ request, ctx }: RequestInfo) {
  const { name } = await request.json();
  const listId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create list in CentralDB
  await db
    .insertInto('lists')
    .values({
      id: listId,
      name,
      createdAt: now,
      updatedAt: now,
    })
    .execute();

  // Add creator as owner in CentralDB
  await db
    .insertInto('list_members')
    .values({
      id: crypto.randomUUID(),
      listId: listId,
      userId: ctx.user.id,
      role: 'owner',
      joinedAt: Date.now(),
    })
    .execute();

  return Response.json({ listId });
}
```

### Server Methods (Direct Function Calls)

```typescript
// lib/server/tasks.ts
export async function getTasksWithStressDebt(listId: string) {
  const listDb = getListDb(listId);

  const rows = await listDb
    .selectFrom('tasks')
    .where('status', '!=', 'done')
    .selectAll()
    .execute();

  return rows.map((row) => ({
    ...deserializeTask(row),
    mentalBurden: calculateMentalBurden(deserializeTask(row)),
  }));
}
```

**When to use:**

- **Server methods:** Internal operations, cron jobs, calculations
- **API routes:** Client-initiated actions, require HTTP context

---

## UI Components & Linear-like UX

### Core Principles

- **Keyboard-driven:** Command palette (Cmd+K), shortcuts for all actions
- **Fast & minimal:** Clean interface, smooth animations
- **Real-time:** Live collaboration with instant updates
- **Drag-and-drop:** Move tasks between status columns

### Key Components

#### 1. Command Palette

```typescript
// components/CommandPalette.tsx
import { Command } from "@/components/ui/command";

export function CommandPalette({ isOpen, onClose }: Props) {
  return (
    <Command>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandItem onSelect={() => createTask()}>Create task...</CommandItem>
        <CommandItem onSelect={() => createList()}>Create list...</CommandItem>
      </CommandList>
    </Command>
  );
}

// Keyboard: Cmd/Ctrl + K
```

#### 2. Task List with Drag-and-Drop

```typescript
// components/TaskList.tsx
import { DndContext } from "@dnd-kit/core";

export function TaskList({ listId }: { listId: string }) {
  const [tasks, setTasks] = useSyncedState<Task[]>([], `list:${listId}:tasks`);

  const handleDragEnd = (event: DragEndEvent) => {
    const taskId = event.active.id as string;
    const newStatus = event.over.id as TaskStatus;

    setTasks(tasks =>
      tasks.map(t =>
        t.id === taskId ? { ...t, status: newStatus } : t
      )
    );
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="task-list-container">
        <StatusColumn id="backlog" title="Backlog" tasks={...} />
        <StatusColumn id="todo" title="To Do" tasks={...} />
        <StatusColumn id="in_progress" title="In Progress" tasks={...} />
        <StatusColumn id="done" title="Done" tasks={...} />
      </div>
    </DndContext>
  );
}
```

#### 3. Status Column

```typescript
// components/StatusColumn.tsx
import { useDroppable } from "@dnd-kit/core";

export function StatusColumn({ id, title, tasks }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`status-column ${isOver ? 'status-column--drag-over' : ''}`}
    >
      <div className="status-column__header">
        <h3>{title}</h3>
        <span className="status-column__count">{tasks.length}</span>
      </div>

      <div className="status-column__tasks">
        {tasks.map(task => <DraggableTaskItem key={task.id} task={task} />)}
      </div>
    </div>
  );
}
```

#### 4. Stress Indicator

```typescript
// components/StressIndicator.tsx
export function StressIndicator({ burden }: { burden: number }) {
  const level = burden > 30 ? 'high' : burden > 10 ? 'medium' : 'low';

  return (
    <div className="stress-indicator">
      <div className={`stress-indicator__dot stress-indicator__dot--${level}`} />
      <span className="stress-indicator__value">{burden.toFixed(1)}</span>
    </div>
  );
}
```

### Keyboard Shortcuts

```
Cmd/Ctrl + K  → Command palette
C             → Create task
L             → Create list
E             → Edit selected task
Backspace     → Delete selected task
1-4           → Change status (backlog, todo, in progress, done)
S             → Set stress level
D             → Set due date
Cmd/Ctrl + ↵  → Complete task
```

### CSS Styling

**Theme colors (CSS variables):** All UI chrome (backgrounds, borders, text)
**Direct colors:** Stress indicators (semantic), user-defined labels (user choice)

```css
/* Use theme variables */
.task-item {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
}

/* Direct colors for semantic meaning */
.stress-indicator__dot--high {
  background: hsl(0, 84%, 60%); /* red */
}

/* User-defined colors (inline styles) */
<span style={{ backgroundColor: label.color }}>
  {label.name}
</span>
```

### Stress Debt Dashboard

```typescript
// components/StressDebtDashboard.tsx
export function StressDebtDashboard({ tasks }: { tasks: Task[] }) {
  const totalDebt = calculateTotalStressDebt(tasks);
  const topStressors = tasks
    .map(t => ({ task: t, burden: calculateMentalBurden(t) }))
    .sort((a, b) => b.burden - a.burden)
    .slice(0, 5);

  return (
    <div className="stress-dashboard">
      <div className="stress-dashboard__total">
        <h2>Total Stress Debt</h2>
        <div className="stress-dashboard__score">{totalDebt.toFixed(1)}</div>
      </div>

      <div className="stress-dashboard__top-stressors">
        <h3>Highest Burden Tasks</h3>
        {topStressors.map(({ task, burden }) => (
          <div key={task.id}>
            <span>{task.title}</span>
            <StressIndicator burden={burden} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Implementation Checklist

### Phase 1: Database & Backend

- [x] Create `db/centralDbMigrations.ts` with central DB schema (user, lists, list_members)
- [x] Create `db/listDbMigrations.ts` with list DB schema (tasks, labels, recurring_tasks)
- [ ] Add `recurring_task_exceptions` table to `db/listDbMigrations.ts`
- [ ] Add index on `recurring_task_exceptions` for (recurringTaskId, originalDate)
- [x] Create `db/centralDbDurableObject.ts` extending `SqliteDurableObject`
- [x] Create `db/listDbDurableObject.ts` extending `SqliteDurableObject`
- [x] Create `db/index.ts` with `db` (central) and `getListDb(listId)` accessors
- [ ] Add database bindings to `wrangler.toml`
- [ ] Create date serialization utilities in `lib/dates.ts`

### Phase 2: Mental Burden & Recurring Tasks

- [ ] Implement `lib/stress-debt.ts` with burden calculations
- [ ] Implement `lib/recurring-cron.ts` with spawning logic
- [ ] Add cron trigger to `wrangler.jsonc`
- [ ] Add scheduled handler to `worker.tsx`
- [ ] Test cron locally with curl

### Phase 3: API Routes

- [ ] Create middleware in `lib/middleware/permissions.ts`
- [ ] Create list handlers in `api/lists/handlers.ts`
- [ ] Create list routes in `api/lists/routes.ts`
- [ ] Create task handlers and routes
- [ ] Create recurring task handlers and routes
- [ ] Mount all routes in `worker.tsx`

### Phase 4: UI Components

- [ ] Install `@dnd-kit/core` and `@dnd-kit/sortable`
- [ ] Create `TaskList` component with drag-and-drop
- [ ] Create `StatusColumn` component with drop zones
- [ ] Create `DraggableTaskItem` component
- [ ] Create `TaskItem` component with stress indicator
- [ ] Create `StressIndicator` component
- [ ] Create `CommandPalette` component
- [ ] Add CSS styles in `styles/task-list.css`
- [ ] Implement keyboard shortcuts

### Phase 5: Real-time Sync

- [ ] Integrate `useSyncedState` in task list components
- [ ] Test multi-user collaboration
- [ ] Add collaborator avatars/presence indicators
- [ ] Test offline/online sync behavior

### Phase 6: Polish

- [ ] Add stress debt dashboard
- [ ] Add label filtering UI
- [ ] Add recurring task management UI
- [ ] Implement all keyboard shortcuts
- [ ] Add loading states and optimistic updates
- [ ] Test performance with large task lists
- [ ] Add error handling and user feedback

---

## Future Enhancements

- **Role-based permissions:** Owner, Editor, Viewer roles
- **AI stress suggestions:** Auto-suggest stress levels based on history
- **Trend analytics:** Stress debt over time, completion rates
- **Notifications:** Reminders for high-burden tasks, overdue items
- **Subtasks:** Break large tasks into smaller pieces
- **Comments:** Discussion threads on tasks
- **File attachments:** Link files to tasks
- **Mobile app:** Native iOS/Android with offline support
- **Email integration:** Create tasks from emails
- **Zapier/webhook integration:** Connect to other tools

---

## Technical Decisions Summary

| Decision                    | Choice                               | Rationale                                                        |
| --------------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| **Database**                | Durable Objects (SQLite)             | Isolated instances, real-time sync, rwsdk integration            |
| **Architecture**            | Two DOs (Central + List)             | Central for auth/membership, List per collaborative list         |
| **Date storage**            | Unix epoch millis (INTEGER)          | Compact, fast, easy conversion                                   |
| **Real-time sync**          | useSyncedState                       | Built-in to rwsdk, WebSocket-based, no custom logic              |
| **Query builder**           | Kysely                               | Type-safe, rwsdk default, no code generation                     |
| **Permissions**             | Simple (v1)                          | Member = full access, add roles later                            |
| **Recurring tasks**         | Calculation-based (no mutable state) | Pattern is immutable rule, calculate what should exist           |
| **Recurring task spawning** | Hybrid (JIT + cron)                  | Just-in-time when list loads + daily cron backup                 |
| **Recurring exceptions**    | recurring_task_exceptions table      | Supports skip AND reschedule, optional Task link (0-or-1:0-or-1) |
| **Pattern updates**         | Direct UPDATE on pattern             | Future spawns use new pattern, past tasks unchanged              |
| **UI framework**            | React + rwsdk                        | Server components, real-time hooks                               |
| **Drag-and-drop**           | @dnd-kit                             | Accessible, performant, React-friendly                           |
| **Styling**                 | CSS with theme variables             | Consistent theming, user preference support                      |
| **Stress calculation**      | User input + system age              | User control with automated aging                                |

---

## Conclusion

This design provides a solid foundation for a collaborative task management system with a unique focus on stress debt tracking. The two-database Durable Object architecture cleanly separates concerns:

- **CentralDB:** Single source of truth for users, lists, and membership
- **ListDB:** Per-list data isolation for optimal performance and scalability

Key architectural decisions:

**Calculation-based recurring tasks** eliminate mutable state. The pattern is an immutable rule (except for user edits), and we calculate what should exist rather than tracking "next occurrence". This makes pattern updates trivial and exception handling straightforward.

**Recurring task exceptions** support both skip and reschedule operations following minimal modeling principles. The `recurring_task_exceptions` table handles both scenarios with an optional link to affected tasks (0-or-1:0-or-1 cardinality), working whether the task instance exists yet or not.

**Minimal modeling** guided our schema design, ensuring clean separation between Anchors (User, List, Task, RecurringPattern, RecurringTaskException) and their relationships. The two-sentence validation test confirmed our cardinalities, and the physical schema directly reflects the logical model.

The mental burden calculation gives users visibility into the psychological weight of their tasks, helping them prioritize and manage stress more effectively. The Linear-inspired UX ensures a fast, keyboard-driven experience with real-time collaboration via `useSyncedState`.

Ready for implementation with clear separation of concerns, proper middleware, and a scalable architecture that can grow with future enhancements.
