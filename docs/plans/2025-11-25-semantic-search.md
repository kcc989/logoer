# Semantic Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add semantic + keyword hybrid search for tasks using ChromaDB Cloud and Jina AI embeddings.

**Architecture:** Single ChromaDB collection with `listId` metadata for authorization filtering. Tasks are synced to ChromaDB asynchronously via Cloudflare Queues when created/updated/deleted. Search queries filter by user's accessible `listIds` and return task IDs which are then hydrated from SQLite.

**Tech Stack:** ChromaDB Cloud, Jina AI embeddings, Cloudflare Queues, rwsdk

---

## Task 1: Install Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install ChromaDB and Jina packages**

Run:

```bash
pnpm add chromadb @chroma-core/jina @chroma-core/chroma-cloud-splade
```

**Step 2: Verify installation**

Run: `pnpm list chromadb @chroma-core/jina @chroma-core/chroma-cloud-splade`

Expected: All three packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add chromadb and jina ai dependencies"
```

---

## Task 2: Add Environment Variables

**Files:**

- Modify: `.dev.vars`
- Modify: `wrangler.jsonc`
- Run: `pnpm generate` after wrangler changes

**Step 1: Add secrets to .dev.vars**

Add to `.dev.vars`:

```
CHROMA_TENANT=your-tenant-here
CHROMA_DATABASE=your-database-here
CHROMA_API_KEY=your-api-key-here
JINA_API_KEY=your-jina-api-key-here
```

Note: Get these values from:

- ChromaDB Cloud dashboard: https://cloud.trychroma.com
- Jina AI dashboard: https://cloud.jina.ai

**Step 2: Update wrangler.jsonc with queue configuration**

Add to `wrangler.jsonc` after the `migrations` array:

```jsonc
  "queues": {
    "producers": [
      {
        "binding": "SEARCH_SYNC_QUEUE",
        "queue": "search-sync-queue"
      }
    ],
    "consumers": [
      {
        "queue": "search-sync-queue",
        "max_batch_size": 10,
        "max_batch_timeout": 5
      }
    ]
  }
```

**Step 3: Create the queue in Cloudflare**

Run:

```bash
npx wrangler queues create search-sync-queue
```

Expected: Queue created successfully message

**Step 4: Generate types**

Run:

```bash
pnpm generate
```

Expected: Types regenerated, `SEARCH_SYNC_QUEUE` binding now typed in `Env`

**Step 5: Commit**

```bash
git add wrangler.jsonc
git commit -m "feat: add search sync queue configuration"
```

---

## Task 3: Create Search Types

**Files:**

- Create: `src/lib/search/types.ts`

**Step 1: Create the types file**

Create `src/lib/search/types.ts`:

```typescript
export interface TaskForSearch {
  id: string;
  title: string;
  description: string;
  status: string;
  dueDate: number;
  assignedToUserId: string | null;
  createdAt: number;
  listId: string;
  labels: Array<{ id: string; name: string }>;
}

export type SearchSyncMessage =
  | { type: 'SYNC_TASK'; task: TaskForSearch }
  | { type: 'REMOVE_TASK'; taskId: string }
  | { type: 'SYNC_TASKS_BATCH'; tasks: TaskForSearch[] };

export interface SearchFilters {
  listIds: string[];
  assigneeId?: string;
  labelIds?: string[];
  status?: string;
  dueBefore?: number;
  dueAfter?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  listId: string;
  assigneeId: string;
  status: string;
  dueDate: number;
}
```

**Step 2: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/search/types.ts
git commit -m "feat: add search types for chromadb integration"
```

---

## Task 4: Create ChromaDB Client

**Files:**

- Create: `src/lib/search/chromaClient.ts`

**Step 1: Create the client file**

Create `src/lib/search/chromaClient.ts`:

```typescript
import { env } from 'cloudflare:workers';
import { ChromaClient, Schema, SparseVectorIndexConfig, K } from 'chromadb';
import { JinaEmbeddingFunction } from '@chroma-core/jina';
import { ChromaCloudSpladeEmbeddingFunction } from '@chroma-core/chroma-cloud-splade';

export function createChromaClient() {
  return new ChromaClient({
    tenant: env.CHROMA_TENANT,
    database: env.CHROMA_DATABASE,
    auth: { provider: 'token', credentials: env.CHROMA_API_KEY },
  });
}

export function createJinaEmbedder() {
  return new JinaEmbeddingFunction({
    jinaai_api_key: env.JINA_API_KEY,
    model_name: 'jina-embeddings-v2-base-en',
  });
}

export async function getTasksCollection() {
  const client = createChromaClient();
  const embedder = createJinaEmbedder();

  const schema = new Schema();
  const sparseEf = new ChromaCloudSpladeEmbeddingFunction({
    apiKeyEnvVar: 'CHROMA_API_KEY',
  });
  schema.createIndex(
    new SparseVectorIndexConfig({
      sourceKey: K.DOCUMENT,
      embeddingFunction: sparseEf,
    }),
    'sparse_embedding'
  );

  return client.getOrCreateCollection({
    name: 'tasks',
    embeddingFunction: embedder,
    schema,
  });
}
```

**Step 2: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors (or only errors unrelated to this file)

**Step 3: Commit**

```bash
git add src/lib/search/chromaClient.ts
git commit -m "feat: add chromadb client with jina embeddings"
```

---

## Task 5: Create Task Document Builder

**Files:**

- Create: `src/lib/search/taskDocument.ts`

**Step 1: Create the document builder**

Create `src/lib/search/taskDocument.ts`:

```typescript
import type { TaskForSearch } from './types';

export function buildTaskDocument(task: TaskForSearch): string {
  const labelNames = task.labels.map((l) => l.name).join(', ');
  const labelSuffix = labelNames ? ` | Labels: ${labelNames}` : '';
  return `${task.title} | ${task.description}${labelSuffix}`;
}

export function buildTaskMetadata(task: TaskForSearch) {
  return {
    listId: task.listId,
    assigneeId: task.assignedToUserId ?? '',
    labelIds: task.labels.map((l) => l.id),
    status: task.status,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
  };
}
```

**Step 2: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/search/taskDocument.ts
git commit -m "feat: add task document builder for search indexing"
```

---

## Task 6: Create Task Search Functions

**Files:**

- Create: `src/lib/search/taskSearch.ts`

**Step 1: Create the search functions file**

Create `src/lib/search/taskSearch.ts`:

```typescript
import { Search, K, Knn, Rrf } from 'chromadb';
import { getTasksCollection } from './chromaClient';
import { buildTaskDocument, buildTaskMetadata } from './taskDocument';
import type { TaskForSearch, SearchFilters, SearchResult } from './types';

// Sync functions

export async function syncTaskToSearch(task: TaskForSearch): Promise<void> {
  const collection = await getTasksCollection();
  await collection.upsert({
    ids: [task.id],
    documents: [buildTaskDocument(task)],
    metadatas: [buildTaskMetadata(task)],
  });
}

export async function removeTaskFromSearch(taskId: string): Promise<void> {
  const collection = await getTasksCollection();
  await collection.delete({ ids: [taskId] });
}

export async function syncTasksToSearch(tasks: TaskForSearch[]): Promise<void> {
  if (tasks.length === 0) return;
  const collection = await getTasksCollection();
  await collection.upsert({
    ids: tasks.map((t) => t.id),
    documents: tasks.map(buildTaskDocument),
    metadatas: tasks.map(buildTaskMetadata),
  });
}

// Search function

export async function searchTasks(
  query: string,
  filters: SearchFilters,
  limit = 20
): Promise<SearchResult[]> {
  const collection = await getTasksCollection();

  // Start with list authorization filter (required)
  let whereClause = K('listId').in(filters.listIds);

  if (filters.assigneeId) {
    whereClause = whereClause.and(K('assigneeId').eq(filters.assigneeId));
  }
  if (filters.status) {
    whereClause = whereClause.and(K('status').eq(filters.status));
  }
  if (filters.dueBefore) {
    whereClause = whereClause.and(K('dueDate').lte(filters.dueBefore));
  }
  if (filters.dueAfter) {
    whereClause = whereClause.and(K('dueDate').gte(filters.dueAfter));
  }

  const hybridRank = Rrf({
    ranks: [
      Knn({ query, returnRank: true, limit: 100 }),
      Knn({ query, key: 'sparse_embedding', returnRank: true, limit: 100 }),
    ],
    weights: [0.7, 0.3],
    k: 60,
  });

  const search = new Search()
    .where(whereClause)
    .rank(hybridRank)
    .limit(limit)
    .select(K.SCORE, 'listId', 'assigneeId', 'status', 'dueDate');

  const results = await collection.search(search);

  return results.rows()[0].map((row) => ({
    id: row.id,
    score: row.score ?? 0,
    listId: row.metadata.listId as string,
    assigneeId: row.metadata.assigneeId as string,
    status: row.metadata.status as string,
    dueDate: row.metadata.dueDate as number,
  }));
}
```

**Step 2: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors (or only errors unrelated to this file)

**Step 3: Commit**

```bash
git add src/lib/search/taskSearch.ts
git commit -m "feat: add task search and sync functions"
```

---

## Task 7: Create Search Index File

**Files:**

- Create: `src/lib/search/index.ts`

**Step 1: Create the index file**

Create `src/lib/search/index.ts`:

```typescript
export * from './types';
export * from './chromaClient';
export * from './taskDocument';
export * from './taskSearch';
```

**Step 2: Commit**

```bash
git add src/lib/search/index.ts
git commit -m "feat: add search module index"
```

---

## Task 8: Add getUserAccessibleListIds Query

**Files:**

- Modify: `src/queries/lists.ts`

**Step 1: Add the server-side query function**

The existing `src/queries/lists.ts` is a client-side file. We need to add a server-side query.

Create `src/app/api/lists/queries.ts`:

```typescript
import { db } from '@/db';

export async function getUserAccessibleListIds(
  userId: string
): Promise<string[]> {
  const memberships = await db
    .selectFrom('list_members')
    .select('listId')
    .where('userId', '=', userId)
    .execute();

  return memberships.map((m) => m.listId);
}
```

**Step 2: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/lists/queries.ts
git commit -m "feat: add getUserAccessibleListIds query"
```

---

## Task 9: Create Search API Handler

**Files:**

- Create: `src/app/api/search/handlers.ts`

**Step 1: Create the handlers file**

Create `src/app/api/search/handlers.ts`:

```typescript
import { searchTasks, type SearchFilters } from '@/lib/search';
import { getUserAccessibleListIds } from '@/app/api/lists/queries';
import { UnauthorizedError } from '@/errors';
import { RequestInfo } from 'rwsdk/worker';
import { routeMapper } from '../routeMapper';

async function searchRoute({ request, ctx }: RequestInfo) {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  const url = new URL(request.url);

  const query = url.searchParams.get('q');
  if (!query) {
    return { error: 'Missing query parameter "q"' };
  }

  // Get user's accessible lists for authorization
  const accessibleListIds = await getUserAccessibleListIds(ctx.user.id);
  if (accessibleListIds.length === 0) {
    return { results: [] };
  }

  const filters: SearchFilters = {
    listIds: accessibleListIds,
  };

  // Optional: scope to specific list(s) within accessible lists
  const listIdsParam = url.searchParams.get('listIds');
  if (listIdsParam) {
    const requestedListIds = listIdsParam.split(',');
    const unauthorizedLists = requestedListIds.filter(
      (id) => !accessibleListIds.includes(id)
    );
    if (unauthorizedLists.length > 0) {
      throw new UnauthorizedError('Access denied to one or more lists');
    }
    filters.listIds = requestedListIds;
  }

  const assigneeId = url.searchParams.get('assigneeId');
  if (assigneeId) {
    filters.assigneeId = assigneeId;
  }

  const status = url.searchParams.get('status');
  if (status) {
    filters.status = status;
  }

  const dueBefore = url.searchParams.get('dueBefore');
  if (dueBefore) {
    filters.dueBefore = parseInt(dueBefore, 10);
  }

  const dueAfter = url.searchParams.get('dueAfter');
  if (dueAfter) {
    filters.dueAfter = parseInt(dueAfter, 10);
  }

  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

  const results = await searchTasks(query, filters, limit);

  return { results };
}

export const searchHandler = routeMapper(searchRoute);
```

**Step 2: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/search/handlers.ts
git commit -m "feat: add search api handler"
```

---

## Task 10: Create Search API Routes

**Files:**

- Create: `src/app/api/search/routes.ts`

**Step 1: Create the routes file**

Create `src/app/api/search/routes.ts`:

```typescript
import { route } from 'rwsdk/router';
import { searchHandler } from './handlers';

export const searchRoutes = [route('/search', searchHandler)];
```

**Step 2: Commit**

```bash
git add src/app/api/search/routes.ts
git commit -m "feat: add search api routes"
```

---

## Task 11: Register Search Routes in Worker

**Files:**

- Modify: `src/worker.tsx`

**Step 1: Import search routes**

Add import at the top of `src/worker.tsx` (around line 31, after other route imports):

```typescript
import { searchRoutes } from './app/api/search/routes';
```

**Step 2: Register routes**

In the `prefix('/api', [...])` section (around line 121-130), add `searchRoutes`:

```typescript
  prefix('/api', [
    listRoutes,
    taskRoutes,
    commentRoutes,
    labelRoutes,
    userInvitationRoutes,
    analyticsRoutes,
    userRoutes,
    avatarRoutes,
    searchRoutes, // Add this line
  ]),
```

**Step 3: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add src/worker.tsx
git commit -m "feat: register search routes in worker"
```

---

## Task 12: Add Queue Consumer to Worker

**Files:**

- Modify: `src/worker.tsx`

**Step 1: Import search sync functions and types**

Add import at top of `src/worker.tsx`:

```typescript
import {
  syncTaskToSearch,
  removeTaskFromSearch,
  syncTasksToSearch,
  type SearchSyncMessage,
} from '@/lib/search';
```

**Step 2: Change default export to object with fetch and queue**

The current export is:

```typescript
export default defineApp<RequestInfo<any, AppContext>>([...]);
```

Change it to:

```typescript
const app = defineApp<RequestInfo<any, AppContext>>([
  // ... all existing routes stay the same
]);

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<SearchSyncMessage>) {
    for (const message of batch.messages) {
      try {
        switch (message.body.type) {
          case 'SYNC_TASK':
            await syncTaskToSearch(message.body.task);
            break;
          case 'REMOVE_TASK':
            await removeTaskFromSearch(message.body.taskId);
            break;
          case 'SYNC_TASKS_BATCH':
            await syncTasksToSearch(message.body.tasks);
            break;
        }
      } catch (error) {
        console.error('Search sync failed:', message.body.type, error);
        // Message will be retried automatically by Cloudflare
      }
    }
  },
} satisfies ExportedHandler<Env>;
```

**Step 3: Add ExportedHandler import**

Add to the cloudflare imports at top:

```typescript
import { env } from 'cloudflare:workers';
```

Also ensure `ExportedHandler` and `MessageBatch` are available. These come from `@cloudflare/workers-types`. Add if needed:

```typescript
/// <reference types="@cloudflare/workers-types" />
```

**Step 4: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors

**Step 5: Commit**

```bash
git add src/worker.tsx
git commit -m "feat: add queue consumer for search sync"
```

---

## Task 13: Add Search Sync to Task Create

**Files:**

- Modify: `src/app/api/tasks/handlers.ts`

**Step 1: Import env and SearchSyncMessage type**

Add imports at top of `src/app/api/tasks/handlers.ts`:

```typescript
import type { TaskForSearch } from '@/lib/search';
```

Note: `env` is already imported.

**Step 2: Create helper to build TaskForSearch from created task**

Add helper function after the existing imports:

```typescript
async function getTaskForSearchSync(
  listId: string,
  taskId: string
): Promise<TaskForSearch> {
  const listDb = await getListDb({ listId });

  const task = await listDb
    .selectFrom('tasks')
    .selectAll()
    .where('id', '=', taskId)
    .executeTakeFirstOrThrow();

  const taskLabels = await listDb
    .selectFrom('task_labels')
    .innerJoin('labels', 'task_labels.labelId', 'labels.id')
    .where('task_labels.taskId', '=', taskId)
    .select(['labels.id', 'labels.name'])
    .execute();

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    dueDate: task.dueDate,
    assignedToUserId: task.assignedToUserId,
    createdAt: task.createdAt,
    listId,
    labels: taskLabels,
  };
}
```

**Step 3: Add queue send to createTask function**

In the `createTask` function (around line 55-88), after the task is created and before returning, add:

```typescript
// Queue search sync (fire-and-forget)
const taskForSearch = await getTaskForSearchSync(listId, task.id);
await env.SEARCH_SYNC_QUEUE.send({
  type: 'SYNC_TASK',
  task: taskForSearch,
});
```

The function should now look like:

```typescript
export async function createTask(
  listId: string,
  input: Omit<CreateTaskInput, 'listId'>
): Promise<Task> {
  const listDb = await getListDb({ listId });

  // ... existing insert code ...

  const task = await listDb
    .insertInto('tasks')
    .values({...})
    .returningAll()
    .executeTakeFirstOrThrow();

  // Queue search sync (fire-and-forget)
  const taskForSearch = await getTaskForSearchSync(listId, task.id);
  await env.SEARCH_SYNC_QUEUE.send({
    type: 'SYNC_TASK',
    task: taskForSearch,
  });

  // Notify all clients viewing this list
  await notifyListSubscribers(listId);

  return taskSchema.parse(task);
}
```

**Step 4: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/tasks/handlers.ts
git commit -m "feat: add search sync on task create"
```

---

## Task 14: Add Search Sync to Task Update

**Files:**

- Modify: `src/app/api/tasks/handlers.ts`

**Step 1: Add queue send to updateTask function**

In the `updateTask` function (around line 187-264), after the labels are updated and before notifying subscribers, add:

```typescript
// Queue search sync (fire-and-forget)
const taskForSearch = await getTaskForSearchSync(listId, taskId);
await env.SEARCH_SYNC_QUEUE.send({
  type: 'SYNC_TASK',
  task: taskForSearch,
});
```

The end of the function should look like:

```typescript
// Update labels if provided
if (labelIds !== undefined) {
  // Remove existing labels
  await listDb.deleteFrom('task_labels').where('taskId', '=', taskId).execute();

  // Add new labels
  if (labelIds.length > 0) {
    await listDb
      .insertInto('task_labels')
      .values(labelIds.map((labelId) => ({ taskId, labelId })))
      .execute();
  }
}

// Queue search sync (fire-and-forget)
const taskForSearch = await getTaskForSearchSync(listId, taskId);
await env.SEARCH_SYNC_QUEUE.send({
  type: 'SYNC_TASK',
  task: taskForSearch,
});

// Notify all clients viewing this list
await notifyListSubscribers(listId);
await notifyListTaskSubscribers(listId, taskId);

return taskSchema.parse(updatedTask);
```

**Step 2: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/tasks/handlers.ts
git commit -m "feat: add search sync on task update"
```

---

## Task 15: Add Search Sync to Task Delete

**Files:**

- Modify: `src/app/api/tasks/handlers.ts`

**Step 1: Add queue send to deleteTask function**

In the `deleteTask` function (around line 280-290), after deleting and before notifying, add:

```typescript
// Queue search removal (fire-and-forget)
await env.SEARCH_SYNC_QUEUE.send({
  type: 'REMOVE_TASK',
  taskId,
});
```

The function should look like:

```typescript
export async function deleteTask(
  listId: string,
  taskId: string
): Promise<void> {
  const listDb = await getListDb({ listId });

  await listDb.deleteFrom('tasks').where('id', '=', taskId).execute();

  // Queue search removal (fire-and-forget)
  await env.SEARCH_SYNC_QUEUE.send({
    type: 'REMOVE_TASK',
    taskId,
  });

  await notifyListSubscribers(listId);
  await notifyListTaskSubscribers(listId, taskId);
}
```

**Step 2: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/tasks/handlers.ts
git commit -m "feat: add search sync on task delete"
```

---

## Task 16: Add Search Sync on Label Rename

**Files:**

- Modify: `src/app/api/labels/handlers.ts`

**Step 1: Add updateLabel function with search re-sync**

The current handlers don't have an update function. Add one:

First, add imports at top:

```typescript
import type { TaskForSearch } from '@/lib/search';
```

Then add the update handler:

```typescript
async function updateLabelRoute({ ctx, request, params }: RequestInfo) {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  if (!ctx.listId) {
    throw new NotFoundError('List not found');
  }

  const labelId = params.labelId;
  if (!labelId) {
    throw new ValidationError('labelId is required');
  }

  const validationResult = createLabelInputSchema.safeParse(
    await request.json()
  );
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.message);
  }

  const label = await updateLabel(ctx.listId, labelId, validationResult.data);

  return label;
}

export async function updateLabel(
  listId: string,
  labelId: string,
  input: CreateLabelInput
): Promise<Label> {
  const listDb = await getListDb({ listId });

  // Update the label
  const label = await listDb
    .updateTable('labels')
    .set({
      name: input.name,
      color: input.color,
      updatedAt: Date.now(),
    })
    .where('id', '=', labelId)
    .returningAll()
    .executeTakeFirstOrThrow();

  // Find all tasks with this label and re-sync them
  const taskIds = await listDb
    .selectFrom('task_labels')
    .select('taskId')
    .where('labelId', '=', labelId)
    .execute();

  if (taskIds.length > 0) {
    const tasks = await listDb
      .selectFrom('tasks')
      .selectAll()
      .where(
        'id',
        'in',
        taskIds.map((t) => t.taskId)
      )
      .execute();

    const tasksForSearch: TaskForSearch[] = await Promise.all(
      tasks.map(async (task) => {
        const taskLabels = await listDb
          .selectFrom('task_labels')
          .innerJoin('labels', 'task_labels.labelId', 'labels.id')
          .where('task_labels.taskId', '=', task.id)
          .select(['labels.id', 'labels.name'])
          .execute();

        return {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          dueDate: task.dueDate,
          assignedToUserId: task.assignedToUserId,
          createdAt: task.createdAt,
          listId,
          labels: taskLabels,
        };
      })
    );

    // Queue batch re-sync
    await env.SEARCH_SYNC_QUEUE.send({
      type: 'SYNC_TASKS_BATCH',
      tasks: tasksForSearch,
    });
  }

  await notifyListSubscribers(listId);

  return labelSchema.parse(label);
}

export const updateLabelHandler = routeMapper(updateLabelRoute);
```

**Step 2: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/labels/handlers.ts
git commit -m "feat: add label update with search re-sync"
```

---

## Task 17: Add Label Update Route

**Files:**

- Modify: `src/app/api/labels/routes.ts`

**Step 1: Read current routes file**

Read `src/app/api/labels/routes.ts` to understand current structure.

**Step 2: Add update route**

Add import for the update handler and the route:

```typescript
import { route } from 'rwsdk/router';
import {
  getLabelsHandler,
  createLabelHandler,
  updateLabelHandler,
} from './handlers';

export const labelRoutes = [
  route('/lists/:listId/labels', [getLabelsHandler, createLabelHandler]),
  route('/lists/:listId/labels/:labelId', [updateLabelHandler]),
];
```

**Step 3: Verify no type errors**

Run: `pnpm tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/labels/routes.ts
git commit -m "feat: add label update route"
```

---

## Task 18: Manual Testing

**Step 1: Start dev server**

Run:

```bash
pnpm dev
```

**Step 2: Test search endpoint**

Using curl or browser, test:

```bash
curl "http://localhost:5173/api/search?q=test"
```

Expected: Should return `{"results":[]}` (empty since no tasks indexed yet) or an authentication error if not logged in.

**Step 3: Create a task through the UI**

1. Log in to the app
2. Create a new task with title "Fix authentication bug" and description "Users cannot log in"
3. Check console/logs for queue message being sent

**Step 4: Search for the task**

```bash
curl "http://localhost:5173/api/search?q=authentication" -H "Cookie: <your-session-cookie>"
```

Expected: Should return the task you created in the results.

**Step 5: Test filters**

```bash
curl "http://localhost:5173/api/search?q=authentication&status=todo" -H "Cookie: <your-session-cookie>"
```

Expected: Results filtered by status.

---

## Task 19: Final Commit

**Step 1: Verify all tests pass**

Run:

```bash
pnpm tsc --noEmit
```

Expected: No type errors

**Step 2: Final commit if needed**

```bash
git status
# If any uncommitted changes:
git add .
git commit -m "feat: complete semantic search implementation"
```

---

## Summary of Files Created/Modified

**New Files:**

- `src/lib/search/types.ts`
- `src/lib/search/chromaClient.ts`
- `src/lib/search/taskDocument.ts`
- `src/lib/search/taskSearch.ts`
- `src/lib/search/index.ts`
- `src/app/api/lists/queries.ts`
- `src/app/api/search/handlers.ts`
- `src/app/api/search/routes.ts`

**Modified Files:**

- `package.json` (dependencies)
- `wrangler.jsonc` (queue config)
- `.dev.vars` (env vars)
- `src/worker.tsx` (routes + queue consumer)
- `src/app/api/tasks/handlers.ts` (sync on create/update/delete)
- `src/app/api/labels/handlers.ts` (sync on label rename)
- `src/app/api/labels/routes.ts` (update route)

**Environment Setup:**

- ChromaDB Cloud account + API key
- Jina AI account + API key
- Cloudflare Queue created: `search-sync-queue`
