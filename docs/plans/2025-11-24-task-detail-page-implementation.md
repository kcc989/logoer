# Task Detail Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-page task detail view with editable fields, comments with @mentions, and inline label creation.

**Architecture:** Two-column layout (Linear-style) with main content (title, description, comments) on the left and properties sidebar (status, assignee, labels, due date, stress level) on the right. All field edits auto-save. Comments support @mentions for users, tasks, and dates stored as structured IDs.

**Tech Stack:** rwsdk (realtime, routing, db), React, TanStack Query, Kysely, Zod, shadcn/ui

---

## Task 1: Add Comments Tables to ListDatabase

**Files:**
- Modify: `src/db/listDbMigrations.ts`

**Step 1: Add migration for comments and comment_mentions tables**

Add a new migration entry after the existing `001_initial_schema`:

```typescript
'002_add_comments': {
  async up(db) {
    return [
      await db.schema
        .createTable('comments')
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('taskId', 'text', (col) =>
          col.notNull().references('tasks.id').onDelete('cascade')
        )
        .addColumn('authorId', 'text', (col) => col.notNull())
        .addColumn('content', 'text', (col) => col.notNull())
        .addColumn('createdAt', 'integer', (col) => col.notNull())
        .addColumn('updatedAt', 'integer', (col) => col.notNull())
        .execute(),

      await db.schema
        .createIndex('idx_comments_task_id')
        .on('comments')
        .column('taskId')
        .execute(),

      await db.schema
        .createTable('comment_mentions')
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('commentId', 'text', (col) =>
          col.notNull().references('comments.id').onDelete('cascade')
        )
        .addColumn('mentionType', 'text', (col) => col.notNull())
        .addColumn('mentionValue', 'text', (col) => col.notNull())
        .addColumn('startIndex', 'integer', (col) => col.notNull())
        .addColumn('length', 'integer', (col) => col.notNull())
        .execute(),

      await db.schema
        .createIndex('idx_comment_mentions_comment_id')
        .on('comment_mentions')
        .column('commentId')
        .execute(),
    ];
  },
  async down(db) {
    await db.schema.dropTable('comment_mentions').ifExists().execute();
    await db.schema.dropTable('comments').ifExists().execute();
  },
},
```

**Step 2: Run types generation**

Run: `pnpm run types:generate`

**Step 3: Commit**

```bash
git add src/db/listDbMigrations.ts
git commit -m "feat: add comments and comment_mentions tables to list database"
```

---

## Task 2: Create Comments Zod Schemas

**Files:**
- Create: `src/schemas/comments.ts`
- Modify: `src/schemas/index.ts`

**Step 1: Create comments schema file**

```typescript
// src/schemas/comments.ts
import { z } from 'zod';
import { userPublicSchema } from './users';

export const commentMentionTypeSchema = z.enum(['user', 'task', 'date']);

export type CommentMentionType = z.infer<typeof commentMentionTypeSchema>;

export const commentMentionSchema = z.object({
  id: z.string(),
  commentId: z.string(),
  mentionType: commentMentionTypeSchema,
  mentionValue: z.string(),
  startIndex: z.number().int(),
  length: z.number().int(),
});

export type CommentMention = z.infer<typeof commentMentionSchema>;

export const commentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  authorId: z.string(),
  content: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Comment = z.infer<typeof commentSchema>;

export const commentWithDetailsSchema = commentSchema.extend({
  mentions: z.array(commentMentionSchema),
  author: userPublicSchema,
});

export type CommentWithDetails = z.infer<typeof commentWithDetailsSchema>;

export const createCommentInputSchema = z.object({
  content: z.string().min(1),
  mentions: z.array(z.object({
    mentionType: commentMentionTypeSchema,
    mentionValue: z.string(),
    startIndex: z.number().int(),
    length: z.number().int(),
  })).optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;
```

**Step 2: Export from index**

Add to `src/schemas/index.ts`:

```typescript
export * from './comments';
```

**Step 3: Commit**

```bash
git add src/schemas/comments.ts src/schemas/index.ts
git commit -m "feat: add comments Zod schemas"
```

---

## Task 3: Create Task API Handlers (Get Single, Update, Delete)

**Files:**
- Modify: `src/app/api/tasks/handlers.ts`
- Modify: `src/app/api/tasks/routes.ts`

**Step 1: Add getTask, updateTask, deleteTask handlers**

Add to `src/app/api/tasks/handlers.ts`:

```typescript
import {
  UpdateTaskInput,
  updateTaskInputSchema,
} from '@/schemas/tasks';

async function getTaskRoute({ ctx, params }: RequestInfo) {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  if (!ctx.listId) {
    throw new NotFoundError('List not found');
  }

  const task = await getTask(ctx.listId, params.taskId);

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  return task;
}

export async function getTask(listId: string, taskId: string) {
  const listDb = await getListDb({ listId });

  const task = await listDb
    .selectFrom('tasks')
    .selectAll()
    .where('id', '=', taskId)
    .executeTakeFirst();

  if (!task) return null;

  // Get labels for this task
  const taskLabels = await listDb
    .selectFrom('task_labels')
    .innerJoin('labels', 'task_labels.labelId', 'labels.id')
    .where('task_labels.taskId', '=', taskId)
    .select([
      'labels.id',
      'labels.name',
      'labels.color',
      'labels.createdAt',
      'labels.updatedAt',
    ])
    .execute();

  return taskWithLabelsSchema.parse({
    ...task,
    labels: taskLabels,
  });
}

async function updateTaskRoute({ ctx, params, request }: RequestInfo) {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  if (!ctx.listId) {
    throw new NotFoundError('List not found');
  }

  const validationResult = updateTaskInputSchema.safeParse(await request.json());
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.message);
  }

  const task = await updateTask(ctx.listId, params.taskId, validationResult.data);

  return task;
}

export async function updateTask(
  listId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<Task> {
  const listDb = await getListDb({ listId });

  const { labelIds, ...taskData } = input;

  // Update task fields
  const task = await listDb
    .updateTable('tasks')
    .set({
      ...taskData,
      updatedAt: Date.now(),
    })
    .where('id', '=', taskId)
    .returningAll()
    .executeTakeFirstOrThrow();

  // Update labels if provided
  if (labelIds !== undefined) {
    // Remove existing labels
    await listDb
      .deleteFrom('task_labels')
      .where('taskId', '=', taskId)
      .execute();

    // Add new labels
    if (labelIds.length > 0) {
      await listDb
        .insertInto('task_labels')
        .values(labelIds.map((labelId) => ({ taskId, labelId })))
        .execute();
    }
  }

  // Notify subscribers
  await notifyListSubscribers(listId);

  return taskSchema.parse(task);
}

async function deleteTaskRoute({ ctx, params }: RequestInfo) {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  if (!ctx.listId) {
    throw new NotFoundError('List not found');
  }

  await deleteTask(ctx.listId, params.taskId);

  return { success: true };
}

export async function deleteTask(listId: string, taskId: string): Promise<void> {
  const listDb = await getListDb({ listId });

  await listDb
    .deleteFrom('tasks')
    .where('id', '=', taskId)
    .execute();

  await notifyListSubscribers(listId);
}

export const getTaskHandler = routeMapper(getTaskRoute);
export const updateTaskHandler = routeMapper(updateTaskRoute);
export const deleteTaskHandler = routeMapper(deleteTaskRoute);
```

**Step 2: Add routes**

Update `src/app/api/tasks/routes.ts`:

```typescript
import { requireAuth } from '@/lib/middleware/auth';
import { requireListAccess } from '@/lib/middleware/lists';
import { prefix, route } from 'rwsdk/router';
import {
  createTaskHandler,
  getTasksHandler,
  getTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
} from './handlers';

export const taskRoutes = prefix('/lists/:listId/tasks', [
  route('/', {
    get: [requireAuth, requireListAccess, getTasksHandler],
    post: [requireAuth, requireListAccess, createTaskHandler],
  }),
  route('/:taskId', {
    get: [requireAuth, requireListAccess, getTaskHandler],
    patch: [requireAuth, requireListAccess, updateTaskHandler],
    delete: [requireAuth, requireListAccess, deleteTaskHandler],
  }),
]);
```

**Step 3: Commit**

```bash
git add src/app/api/tasks/handlers.ts src/app/api/tasks/routes.ts
git commit -m "feat: add getTask, updateTask, deleteTask API handlers"
```

---

## Task 4: Create Comments API Handlers

**Files:**
- Create: `src/app/api/comments/handlers.ts`
- Create: `src/app/api/comments/routes.ts`
- Modify: `src/worker.tsx`

**Step 1: Create comments handlers**

```typescript
// src/app/api/comments/handlers.ts
import { getListDb, db } from '@/db';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/errors';
import {
  Comment,
  CommentWithDetails,
  commentSchema,
  commentWithDetailsSchema,
  createCommentInputSchema,
  CreateCommentInput,
} from '@/schemas/comments';
import { nanoid } from 'nanoid';
import { RequestInfo } from 'rwsdk/worker';
import { routeMapper } from '../routeMapper';
import { env } from 'cloudflare:workers';
import { renderRealtimeClients } from 'rwsdk/realtime/worker';

async function notifyListSubscribers(listId: string) {
  await renderRealtimeClients({
    durableObjectNamespace: env.REALTIME_DURABLE_OBJECT,
    key: `/lists/${listId}`,
  });
}

async function getCommentsRoute({ ctx, params }: RequestInfo) {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  if (!ctx.listId) {
    throw new NotFoundError('List not found');
  }

  const comments = await getComments(ctx.listId, params.taskId);

  return comments;
}

export async function getComments(
  listId: string,
  taskId: string
): Promise<CommentWithDetails[]> {
  const listDb = await getListDb({ listId });

  const comments = await listDb
    .selectFrom('comments')
    .selectAll()
    .where('taskId', '=', taskId)
    .orderBy('createdAt', 'asc')
    .execute();

  // Get all mentions for these comments
  const commentIds = comments.map((c) => c.id);
  const mentions =
    commentIds.length > 0
      ? await listDb
          .selectFrom('comment_mentions')
          .selectAll()
          .where('commentId', 'in', commentIds)
          .execute()
      : [];

  // Get author info from central db
  const authorIds = [...new Set(comments.map((c) => c.authorId))];
  const authors =
    authorIds.length > 0
      ? await db
          .selectFrom('user')
          .select(['id', 'name', 'email', 'image', 'username'])
          .where('id', 'in', authorIds)
          .execute()
      : [];

  const authorMap = new Map(authors.map((a) => [a.id, a]));
  const mentionsByComment = new Map<string, typeof mentions>();
  for (const mention of mentions) {
    const existing = mentionsByComment.get(mention.commentId) || [];
    existing.push(mention);
    mentionsByComment.set(mention.commentId, existing);
  }

  return comments.map((comment) =>
    commentWithDetailsSchema.parse({
      ...comment,
      mentions: mentionsByComment.get(comment.id) || [],
      author: authorMap.get(comment.authorId) || {
        id: comment.authorId,
        name: null,
        email: null,
        image: null,
        username: null,
      },
    })
  );
}

async function createCommentRoute({ ctx, params, request }: RequestInfo) {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  if (!ctx.listId) {
    throw new NotFoundError('List not found');
  }

  const validationResult = createCommentInputSchema.safeParse(
    await request.json()
  );
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.message);
  }

  const comment = await createComment(
    ctx.listId,
    params.taskId,
    ctx.user.id,
    validationResult.data
  );

  return comment;
}

export async function createComment(
  listId: string,
  taskId: string,
  authorId: string,
  input: CreateCommentInput
): Promise<Comment> {
  const listDb = await getListDb({ listId });

  const commentId = nanoid();
  const now = Date.now();

  const comment = await listDb
    .insertInto('comments')
    .values({
      id: commentId,
      taskId,
      authorId,
      content: input.content,
      createdAt: now,
      updatedAt: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // Insert mentions if provided
  if (input.mentions && input.mentions.length > 0) {
    await listDb
      .insertInto('comment_mentions')
      .values(
        input.mentions.map((m) => ({
          id: nanoid(),
          commentId,
          mentionType: m.mentionType,
          mentionValue: m.mentionValue,
          startIndex: m.startIndex,
          length: m.length,
        }))
      )
      .execute();
  }

  await notifyListSubscribers(listId);

  return commentSchema.parse(comment);
}

async function deleteCommentRoute({ ctx, params }: RequestInfo) {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  if (!ctx.listId) {
    throw new NotFoundError('List not found');
  }

  await deleteComment(ctx.listId, params.commentId);

  return { success: true };
}

export async function deleteComment(
  listId: string,
  commentId: string
): Promise<void> {
  const listDb = await getListDb({ listId });

  await listDb
    .deleteFrom('comments')
    .where('id', '=', commentId)
    .execute();

  await notifyListSubscribers(listId);
}

export const getCommentsHandler = routeMapper(getCommentsRoute);
export const createCommentHandler = routeMapper(createCommentRoute);
export const deleteCommentHandler = routeMapper(deleteCommentRoute);
```

**Step 2: Create comments routes**

```typescript
// src/app/api/comments/routes.ts
import { requireAuth } from '@/lib/middleware/auth';
import { requireListAccess } from '@/lib/middleware/lists';
import { prefix, route } from 'rwsdk/router';
import {
  getCommentsHandler,
  createCommentHandler,
  deleteCommentHandler,
} from './handlers';

export const commentRoutes = prefix('/lists/:listId/tasks/:taskId/comments', [
  route('/', {
    get: [requireAuth, requireListAccess, getCommentsHandler],
    post: [requireAuth, requireListAccess, createCommentHandler],
  }),
  route('/:commentId', {
    delete: [requireAuth, requireListAccess, deleteCommentHandler],
  }),
]);
```

**Step 3: Register routes in worker**

Add to `src/worker.tsx`:

```typescript
import { commentRoutes } from './app/api/comments/routes';

// In the prefix('/api', [...]) array:
prefix('/api', [listRoutes, taskRoutes, commentRoutes]),
```

**Step 4: Commit**

```bash
git add src/app/api/comments/handlers.ts src/app/api/comments/routes.ts src/worker.tsx
git commit -m "feat: add comments API handlers and routes"
```

---

## Task 5: Create Labels API Handler (for inline creation)

**Files:**
- Create: `src/app/api/labels/handlers.ts`
- Create: `src/app/api/labels/routes.ts`
- Modify: `src/worker.tsx`

**Step 1: Create labels handlers**

```typescript
// src/app/api/labels/handlers.ts
import { getListDb } from '@/db';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/errors';
import {
  Label,
  labelSchema,
  createLabelInputSchema,
  CreateLabelInput,
} from '@/schemas/labels';
import { nanoid } from 'nanoid';
import { RequestInfo } from 'rwsdk/worker';
import { routeMapper } from '../routeMapper';
import { env } from 'cloudflare:workers';
import { renderRealtimeClients } from 'rwsdk/realtime/worker';

async function notifyListSubscribers(listId: string) {
  await renderRealtimeClients({
    durableObjectNamespace: env.REALTIME_DURABLE_OBJECT,
    key: `/lists/${listId}`,
  });
}

async function getLabelsRoute({ ctx }: RequestInfo) {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  if (!ctx.listId) {
    throw new NotFoundError('List not found');
  }

  const labels = await getLabels(ctx.listId);

  return labels;
}

export async function getLabels(listId: string): Promise<Label[]> {
  const listDb = await getListDb({ listId });

  const labels = await listDb
    .selectFrom('labels')
    .selectAll()
    .orderBy('name', 'asc')
    .execute();

  return labels.map((label) => labelSchema.parse(label));
}

async function createLabelRoute({ ctx, request }: RequestInfo) {
  if (!ctx.user) {
    throw new UnauthorizedError('User is not authenticated');
  }

  if (!ctx.listId) {
    throw new NotFoundError('List not found');
  }

  const validationResult = createLabelInputSchema.safeParse(await request.json());
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.message);
  }

  const label = await createLabel(ctx.listId, validationResult.data);

  return label;
}

export async function createLabel(
  listId: string,
  input: CreateLabelInput
): Promise<Label> {
  const listDb = await getListDb({ listId });

  const now = Date.now();

  const label = await listDb
    .insertInto('labels')
    .values({
      id: nanoid(),
      name: input.name,
      color: input.color,
      createdAt: now,
      updatedAt: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await notifyListSubscribers(listId);

  return labelSchema.parse(label);
}

export const getLabelsHandler = routeMapper(getLabelsRoute);
export const createLabelHandler = routeMapper(createLabelRoute);
```

**Step 2: Create labels routes**

```typescript
// src/app/api/labels/routes.ts
import { requireAuth } from '@/lib/middleware/auth';
import { requireListAccess } from '@/lib/middleware/lists';
import { prefix, route } from 'rwsdk/router';
import { getLabelsHandler, createLabelHandler } from './handlers';

export const labelRoutes = prefix('/lists/:listId/labels', [
  route('/', {
    get: [requireAuth, requireListAccess, getLabelsHandler],
    post: [requireAuth, requireListAccess, createLabelHandler],
  }),
]);
```

**Step 3: Register routes in worker**

Add to `src/worker.tsx`:

```typescript
import { labelRoutes } from './app/api/labels/routes';

// In the prefix('/api', [...]) array:
prefix('/api', [listRoutes, taskRoutes, commentRoutes, labelRoutes]),
```

**Step 4: Commit**

```bash
git add src/app/api/labels/handlers.ts src/app/api/labels/routes.ts src/worker.tsx
git commit -m "feat: add labels API handlers for list-scoped labels"
```

---

## Task 6: Create React Query Functions for Tasks/Comments/Labels

**Files:**
- Modify: `src/queries/tasks.ts`
- Create: `src/queries/comments.ts`
- Modify: `src/queries/labels.ts`

**Step 1: Add task queries**

Update `src/queries/tasks.ts` with getTask and updateTask:

```typescript
import { z } from 'zod';
import {
  taskSchema,
  taskWithLabelsSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
  CreateTaskInput,
  UpdateTaskInput,
} from '@/schemas/tasks';
import { createMutationFn, createQueryFnWithParams } from '@/lib/react-query-utils';

export const fetchTask = createQueryFnWithParams(
  (listId: string, taskId: string) => `/api/lists/${listId}/tasks/${taskId}`,
  taskWithLabelsSchema
);

export const createTask = createMutationFn({
  method: 'POST',
  url: (listId: string) => `/api/lists/${listId}/tasks`,
  requestSchema: createTaskInputSchema.omit({ listId: true }),
  responseSchema: taskSchema,
});

export const updateTask = createMutationFn({
  method: 'PATCH',
  url: (listId: string, taskId: string) => `/api/lists/${listId}/tasks/${taskId}`,
  requestSchema: updateTaskInputSchema,
  responseSchema: taskSchema,
});

export const deleteTask = createMutationFn({
  method: 'DELETE',
  url: (listId: string, taskId: string) => `/api/lists/${listId}/tasks/${taskId}`,
  responseSchema: z.object({ success: z.boolean() }),
});
```

**Step 2: Create comments queries**

```typescript
// src/queries/comments.ts
import { z } from 'zod';
import {
  commentSchema,
  commentWithDetailsSchema,
  createCommentInputSchema,
} from '@/schemas/comments';
import {
  createMutationFn,
  createQueryFnWithParams,
} from '@/lib/react-query-utils';

export const fetchComments = createQueryFnWithParams(
  (listId: string, taskId: string) =>
    `/api/lists/${listId}/tasks/${taskId}/comments`,
  z.array(commentWithDetailsSchema)
);

export const createComment = createMutationFn({
  method: 'POST',
  url: (listId: string, taskId: string) =>
    `/api/lists/${listId}/tasks/${taskId}/comments`,
  requestSchema: createCommentInputSchema,
  responseSchema: commentSchema,
});

export const deleteComment = createMutationFn({
  method: 'DELETE',
  url: (listId: string, taskId: string, commentId: string) =>
    `/api/lists/${listId}/tasks/${taskId}/comments/${commentId}`,
  responseSchema: z.object({ success: z.boolean() }),
});
```

**Step 3: Update labels queries for list-scoped labels**

```typescript
// src/queries/labels.ts
import { z } from 'zod';
import { labelSchema, createLabelInputSchema } from '@/schemas/labels';
import {
  createMutationFn,
  createQueryFnWithParams,
} from '@/lib/react-query-utils';

export const fetchLabels = createQueryFnWithParams(
  (listId: string) => `/api/lists/${listId}/labels`,
  z.array(labelSchema)
);

export const createLabel = createMutationFn({
  method: 'POST',
  url: (listId: string) => `/api/lists/${listId}/labels`,
  requestSchema: createLabelInputSchema,
  responseSchema: labelSchema,
});
```

**Step 4: Commit**

```bash
git add src/queries/tasks.ts src/queries/comments.ts src/queries/labels.ts
git commit -m "feat: add React Query functions for tasks, comments, labels"
```

---

## Task 7: Create Task Detail Page Route and Server Component

**Files:**
- Create: `src/app/pages/tasks/TaskDetail.tsx`
- Modify: `src/worker.tsx`

**Step 1: Create TaskDetail server component**

```typescript
// src/app/pages/tasks/TaskDetail.tsx
import { type RequestInfo } from 'rwsdk/worker';
import { AppLayout } from '@/app/app-layout';
import { db } from '@/db';
import { getTask } from '@/app/api/tasks/handlers';
import { getComments } from '@/app/api/comments/handlers';
import { getLabels } from '@/app/api/labels/handlers';
import { TaskDetailContent } from '@/components/tasks/task-detail/task-detail-content';

async function getListMembers(listId: string) {
  const members = await db
    .selectFrom('list_members')
    .innerJoin('user', 'list_members.userId', 'user.id')
    .where('list_members.listId', '=', listId)
    .select([
      'list_members.userId',
      'user.id as user_id',
      'user.name',
      'user.email',
      'user.image',
      'user.username',
    ])
    .execute();

  return members.map((m) => ({
    userId: m.userId,
    user: {
      id: m.user_id,
      name: m.name,
      email: m.email,
      image: m.image,
      username: m.username,
    },
  }));
}

export async function TaskDetail({ params, ctx }: RequestInfo) {
  const { listId, taskId } = params;

  if (!ctx.user?.id) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background ml-64">
          <div className="container mx-auto px-6 py-12">
            <p>Please log in to view this task</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const [task, comments, labels, members] = await Promise.all([
    getTask(listId, taskId),
    getComments(listId, taskId),
    getLabels(listId),
    getListMembers(listId),
  ]);

  if (!task) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background ml-64">
          <div className="container mx-auto px-6 py-12">
            <p>Task not found</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background ml-64">
        <TaskDetailContent
          listId={listId}
          task={task}
          comments={comments}
          labels={labels}
          members={members}
          currentUserId={ctx.user.id}
        />
      </div>
    </AppLayout>
  );
}
```

**Step 2: Add route to worker**

Update `src/worker.tsx`:

```typescript
import { TaskDetail } from '@/app/pages/tasks/TaskDetail';

// Update RealtimeDocument routes:
render(RealtimeDocument, [
  route('/lists/:listId', ListDetail),
  route('/lists/:listId/tasks/:taskId', TaskDetail),
]),
```

**Step 3: Commit**

```bash
git add src/app/pages/tasks/TaskDetail.tsx src/worker.tsx
git commit -m "feat: add TaskDetail page route and server component"
```

---

## Task 8: Create TaskDetailContent Client Component

**Files:**
- Create: `src/components/tasks/task-detail/task-detail-content.tsx`

**Step 1: Create the main content wrapper**

```typescript
// src/components/tasks/task-detail/task-detail-content.tsx
'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { deleteTask } from '@/queries/tasks';
import { TaskWithLabels } from '@/schemas/tasks';
import { CommentWithDetails } from '@/schemas/comments';
import { Label } from '@/schemas/labels';
import { TaskMainColumn } from './task-main-column';
import { TaskPropertiesSidebar } from './task-properties-sidebar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Member {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    username: string | null;
  };
}

interface TaskDetailContentProps {
  listId: string;
  task: TaskWithLabels;
  comments: CommentWithDetails[];
  labels: Label[];
  members: Member[];
  currentUserId: string;
}

export function TaskDetailContent({
  listId,
  task,
  comments,
  labels,
  members,
  currentUserId,
}: TaskDetailContentProps) {
  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(listId, task.id)(),
    onSuccess: () => {
      window.location.href = `/lists/${listId}`;
    },
  });

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" asChild>
          <a href={`/lists/${listId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to List
          </a>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete task?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the task
                and all its comments.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-8">
        <TaskMainColumn
          listId={listId}
          task={task}
          comments={comments}
          members={members}
          labels={labels}
          currentUserId={currentUserId}
        />
        <TaskPropertiesSidebar
          listId={listId}
          task={task}
          labels={labels}
          members={members}
        />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-detail/task-detail-content.tsx
git commit -m "feat: add TaskDetailContent component with layout"
```

---

## Task 9: Create TaskMainColumn Component

**Files:**
- Create: `src/components/tasks/task-detail/task-main-column.tsx`

**Step 1: Create main column with title, description, comments**

```typescript
// src/components/tasks/task-detail/task-main-column.tsx
'use client';

import { TaskTitle } from './task-title';
import { TaskDescription } from './task-description';
import { TaskComments } from './task-comments';
import { TaskWithLabels } from '@/schemas/tasks';
import { CommentWithDetails } from '@/schemas/comments';
import { Label } from '@/schemas/labels';

interface Member {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    username: string | null;
  };
}

interface TaskMainColumnProps {
  listId: string;
  task: TaskWithLabels;
  comments: CommentWithDetails[];
  members: Member[];
  labels: Label[];
  currentUserId: string;
}

export function TaskMainColumn({
  listId,
  task,
  comments,
  members,
  labels,
  currentUserId,
}: TaskMainColumnProps) {
  return (
    <div className="space-y-6">
      <TaskTitle listId={listId} taskId={task.id} initialTitle={task.title} />
      <TaskDescription
        listId={listId}
        taskId={task.id}
        initialDescription={task.description}
      />
      <TaskComments
        listId={listId}
        taskId={task.id}
        comments={comments}
        members={members}
        labels={labels}
        currentUserId={currentUserId}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-detail/task-main-column.tsx
git commit -m "feat: add TaskMainColumn component"
```

---

## Task 10: Create TaskTitle Component with Auto-Save

**Files:**
- Create: `src/components/tasks/task-detail/task-title.tsx`

**Step 1: Create editable title with debounced auto-save**

```typescript
// src/components/tasks/task-detail/task-title.tsx
'use client';

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useDebouncedCallback } from 'use-debounce';
import { updateTask } from '@/queries/tasks';
import { Input } from '@/components/ui/input';

interface TaskTitleProps {
  listId: string;
  taskId: string;
  initialTitle: string;
}

export function TaskTitle({ listId, taskId, initialTitle }: TaskTitleProps) {
  const [title, setTitle] = useState(initialTitle);

  const mutation = useMutation({
    mutationFn: (newTitle: string) =>
      updateTask(listId, taskId)({ title: newTitle }),
  });

  const debouncedSave = useDebouncedCallback((newTitle: string) => {
    if (newTitle.trim() && newTitle !== initialTitle) {
      mutation.mutate(newTitle);
    }
  }, 500);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      debouncedSave(newTitle);
    },
    [debouncedSave]
  );

  return (
    <Input
      value={title}
      onChange={handleChange}
      className="text-2xl font-semibold border-0 px-0 focus-visible:ring-0 bg-transparent"
      placeholder="Task title"
    />
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-detail/task-title.tsx
git commit -m "feat: add TaskTitle component with auto-save"
```

---

## Task 11: Create TaskDescription Component with Auto-Save

**Files:**
- Create: `src/components/tasks/task-detail/task-description.tsx`

**Step 1: Create editable description with markdown editor**

```typescript
// src/components/tasks/task-detail/task-description.tsx
'use client';

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useDebouncedCallback } from 'use-debounce';
import { updateTask } from '@/queries/tasks';
import { MarkdownEditor } from '@/components/task-fields/markdown-editor';

interface TaskDescriptionProps {
  listId: string;
  taskId: string;
  initialDescription: string;
}

export function TaskDescription({
  listId,
  taskId,
  initialDescription,
}: TaskDescriptionProps) {
  const [description, setDescription] = useState(initialDescription);

  const mutation = useMutation({
    mutationFn: (newDescription: string) =>
      updateTask(listId, taskId)({ description: newDescription }),
  });

  const debouncedSave = useDebouncedCallback((newDescription: string) => {
    if (newDescription !== initialDescription) {
      mutation.mutate(newDescription);
    }
  }, 500);

  const handleChange = useCallback(
    (newDescription: string) => {
      setDescription(newDescription);
      debouncedSave(newDescription);
    },
    [debouncedSave]
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <MarkdownEditor
        value={description}
        onChange={handleChange}
        placeholder="Add a description..."
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-detail/task-description.tsx
git commit -m "feat: add TaskDescription component with auto-save"
```

---

## Task 12: Create TaskPropertiesSidebar Component

**Files:**
- Create: `src/components/tasks/task-detail/task-properties-sidebar.tsx`

**Step 1: Create sidebar with all property editors**

```typescript
// src/components/tasks/task-detail/task-properties-sidebar.tsx
'use client';

import { useMutation } from '@tanstack/react-query';
import { updateTask } from '@/queries/tasks';
import { TaskWithLabels, TaskStatus } from '@/schemas/tasks';
import { Label } from '@/schemas/labels';
import { StatusSelector } from '@/components/task-fields/status-selector';
import { AssigneeSelector } from '@/components/task-fields/assignee-selector';
import { StressLevelSelector } from '@/components/task-fields/stress-level-selector';
import { DueDatePicker } from '@/components/task-fields/due-date-picker';
import { TaskLabelSelector } from './task-label-selector';
import { Card, CardContent } from '@/components/ui/card';

interface Member {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    username: string | null;
  };
}

interface TaskPropertiesSidebarProps {
  listId: string;
  task: TaskWithLabels;
  labels: Label[];
  members: Member[];
}

export function TaskPropertiesSidebar({
  listId,
  task,
  labels,
  members,
}: TaskPropertiesSidebarProps) {
  const mutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) =>
      updateTask(listId, task.id)(updates),
  });

  const handleStatusChange = (status: TaskStatus) => {
    mutation.mutate({ status });
  };

  const handleAssigneeChange = (assignedToUserId: string | null) => {
    mutation.mutate({ assignedToUserId });
  };

  const handleStressLevelChange = (stressLevel: number | null) => {
    mutation.mutate({ stressLevel: stressLevel ?? undefined });
  };

  const handleDueDateChange = (dueDate: number | null) => {
    mutation.mutate({
      dueDate: dueDate ?? undefined,
      dueDateTimezone: dueDate
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined,
    });
  };

  const handleLabelsChange = (labelIds: string[]) => {
    mutation.mutate({ labelIds });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Status
          </label>
          <StatusSelector value={task.status} onChange={handleStatusChange} />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Assignee
          </label>
          <AssigneeSelector
            listId={listId}
            value={task.assignedToUserId}
            onChange={handleAssigneeChange}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Labels
          </label>
          <TaskLabelSelector
            listId={listId}
            value={task.labels.map((l) => l.id)}
            labels={labels}
            onChange={handleLabelsChange}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Due Date
          </label>
          <DueDatePicker value={task.dueDate} onChange={handleDueDateChange} />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Stress Level
          </label>
          <StressLevelSelector
            value={task.stressLevel}
            onChange={handleStressLevelChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-detail/task-properties-sidebar.tsx
git commit -m "feat: add TaskPropertiesSidebar component"
```

---

## Task 13: Create TaskLabelSelector with Inline Creation

**Files:**
- Create: `src/components/tasks/task-detail/task-label-selector.tsx`

**Step 1: Create label selector with inline creation**

```typescript
// src/components/tasks/task-detail/task-label-selector.tsx
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLabel } from '@/queries/labels';
import { Label } from '@/schemas/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Tag, X } from 'lucide-react';

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

interface TaskLabelSelectorProps {
  listId: string;
  value: string[];
  labels: Label[];
  onChange: (labelIds: string[]) => void;
}

export function TaskLabelSelector({
  listId,
  value,
  labels,
  onChange,
}: TaskLabelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(PRESET_COLORS[0]);

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      createLabel(listId)(data),
    onSuccess: (newLabel) => {
      queryClient.invalidateQueries({ queryKey: ['labels', listId] });
      onChange([...value, newLabel.id]);
      setIsCreating(false);
      setNewLabelName('');
      setNewLabelColor(PRESET_COLORS[0]);
    },
  });

  const toggleLabel = (labelId: string) => {
    if (value.includes(labelId)) {
      onChange(value.filter((id) => id !== labelId));
    } else {
      onChange([...value, labelId]);
    }
  };

  const filteredLabels = labels.filter((label) =>
    label.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabels = labels.filter((l) => value.includes(l.id));

  const handleCreateLabel = () => {
    if (newLabelName.trim()) {
      createMutation.mutate({ name: newLabelName.trim(), color: newLabelColor });
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start h-auto min-h-9 py-1.5">
          {selectedLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedLabels.map((label) => (
                <Badge
                  key={label.id}
                  variant="outline"
                  style={{ borderColor: label.color, color: label.color }}
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Add labels
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {isCreating ? (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Create label</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsCreating(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="Label name"
              autoFocus
            />
            <div className="flex gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-6 h-6 rounded-full border-2 ${
                    newLabelColor === color
                      ? 'border-foreground'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewLabelColor(color)}
                />
              ))}
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={handleCreateLabel}
              disabled={!newLabelName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        ) : (
          <div className="p-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search labels..."
              className="mb-2"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredLabels.map((label) => (
                <div
                  key={label.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                  onClick={() => toggleLabel(label.id)}
                >
                  <Checkbox checked={value.includes(label.id)} />
                  <Badge
                    variant="outline"
                    style={{ borderColor: label.color, color: label.color }}
                  >
                    {label.name}
                  </Badge>
                </div>
              ))}
              {filteredLabels.length === 0 && search && (
                <div className="text-sm text-muted-foreground text-center py-2">
                  No labels found
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 justify-start"
              onClick={() => {
                setIsCreating(true);
                setNewLabelName(search);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create {search ? `"${search}"` : 'new label'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-detail/task-label-selector.tsx
git commit -m "feat: add TaskLabelSelector with inline creation"
```

---

## Task 14: Create TaskComments Component

**Files:**
- Create: `src/components/tasks/task-detail/task-comments.tsx`

**Step 1: Create comments list and input**

```typescript
// src/components/tasks/task-detail/task-comments.tsx
'use client';

import { CommentWithDetails } from '@/schemas/comments';
import { Label } from '@/schemas/labels';
import { CommentItem } from './comment-item';
import { CommentInput } from './comment-input';

interface Member {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    username: string | null;
  };
}

interface TaskCommentsProps {
  listId: string;
  taskId: string;
  comments: CommentWithDetails[];
  members: Member[];
  labels: Label[];
  currentUserId: string;
}

export function TaskComments({
  listId,
  taskId,
  comments,
  members,
  labels,
  currentUserId,
}: TaskCommentsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Comments</h3>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              listId={listId}
              taskId={taskId}
              comment={comment}
              members={members}
              labels={labels}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      <CommentInput
        listId={listId}
        taskId={taskId}
        members={members}
        labels={labels}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-detail/task-comments.tsx
git commit -m "feat: add TaskComments component"
```

---

## Task 15: Create CommentItem Component

**Files:**
- Create: `src/components/tasks/task-detail/comment-item.tsx`

**Step 1: Create single comment display with mention rendering**

```typescript
// src/components/tasks/task-detail/comment-item.tsx
'use client';

import { formatDistanceToNow } from 'date-fns';
import { useMutation } from '@tanstack/react-query';
import { deleteComment } from '@/queries/comments';
import { CommentWithDetails, CommentMention } from '@/schemas/comments';
import { Label } from '@/schemas/labels';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface Member {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    username: string | null;
  };
}

interface CommentItemProps {
  listId: string;
  taskId: string;
  comment: CommentWithDetails;
  members: Member[];
  labels: Label[];
  currentUserId: string;
}

function renderMentionChip(mention: CommentMention, members: Member[]) {
  if (mention.mentionType === 'user') {
    const member = members.find((m) => m.userId === mention.mentionValue);
    const name = member?.user?.name || member?.user?.username || 'Unknown';
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-sm font-medium">
        @{name}
      </span>
    );
  }

  if (mention.mentionType === 'task') {
    return (
      <a
        href={`#task-${mention.mentionValue}`}
        className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 text-sm font-medium hover:underline"
      >
        @task
      </a>
    );
  }

  if (mention.mentionType === 'date') {
    const date = new Date(mention.mentionValue);
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 text-sm font-medium">
        {date.toLocaleDateString()}
      </span>
    );
  }

  return null;
}

function renderContentWithMentions(
  content: string,
  mentions: CommentMention[],
  members: Member[]
) {
  if (mentions.length === 0) {
    return <span>{content}</span>;
  }

  // Sort mentions by startIndex
  const sortedMentions = [...mentions].sort(
    (a, b) => a.startIndex - b.startIndex
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  sortedMentions.forEach((mention, i) => {
    // Add text before mention
    if (mention.startIndex > lastIndex) {
      parts.push(
        <span key={`text-${i}`}>
          {content.slice(lastIndex, mention.startIndex)}
        </span>
      );
    }

    // Add mention chip
    parts.push(
      <span key={`mention-${i}`}>{renderMentionChip(mention, members)}</span>
    );

    lastIndex = mention.startIndex + mention.length;
  });

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(<span key="text-end">{content.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

export function CommentItem({
  listId,
  taskId,
  comment,
  members,
  currentUserId,
}: CommentItemProps) {
  const deleteMutation = useMutation({
    mutationFn: () => deleteComment(listId, taskId, comment.id)(),
  });

  const authorName =
    comment.author?.name || comment.author?.username || 'Unknown';
  const authorInitial = authorName[0]?.toUpperCase() || '?';
  const isAuthor = comment.authorId === currentUserId;

  return (
    <div className="flex gap-3 group">
      <Avatar className="h-8 w-8">
        <AvatarImage src={comment.author?.image || undefined} />
        <AvatarFallback>{authorInitial}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{authorName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), {
              addSuffix: true,
            })}
          </span>
          {isAuthor && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="text-sm mt-1">
          {renderContentWithMentions(comment.content, comment.mentions, members)}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-detail/comment-item.tsx
git commit -m "feat: add CommentItem component with mention rendering"
```

---

## Task 16: Create CommentInput Component with @Mention Autocomplete

**Files:**
- Create: `src/components/tasks/task-detail/comment-input.tsx`

**Step 1: Create comment input with @mention autocomplete**

```typescript
// src/components/tasks/task-detail/comment-input.tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createComment } from '@/queries/comments';
import { CreateCommentInput, CommentMentionType } from '@/schemas/comments';
import { Label } from '@/schemas/labels';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';
import { User, FileText, Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface Member {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    username: string | null;
  };
}

interface Mention {
  mentionType: CommentMentionType;
  mentionValue: string;
  startIndex: number;
  length: number;
  displayText: string;
}

interface CommentInputProps {
  listId: string;
  taskId: string;
  members: Member[];
  labels: Label[];
}

const DATE_PRESETS = [
  { label: 'Today', value: () => new Date() },
  { label: 'Tomorrow', value: () => addDays(new Date(), 1) },
  { label: 'Next Week', value: () => addDays(new Date(), 7) },
];

export function CommentInput({
  listId,
  taskId,
  members,
}: CommentInputProps) {
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteType, setAutocompleteType] = useState<'user' | 'date' | null>(null);
  const [autocompleteSearch, setAutocompleteSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mutation = useMutation({
    mutationFn: (input: CreateCommentInput) =>
      createComment(listId, taskId)(input),
    onSuccess: () => {
      setContent('');
      setMentions([]);
    },
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === '@') {
        const cursorPos = e.currentTarget.selectionStart || 0;
        setCursorPosition(cursorPos + 1);
        setShowAutocomplete(true);
        setAutocompleteType(null);
        setAutocompleteSearch('');
      } else if (showAutocomplete && e.key === 'Escape') {
        setShowAutocomplete(false);
      }
    },
    [showAutocomplete]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);

      if (showAutocomplete) {
        const cursorPos = e.target.selectionStart || 0;
        const textAfterAt = newContent.slice(cursorPosition, cursorPos);

        // Check if user typed a space or deleted the @
        if (textAfterAt.includes(' ') || cursorPos < cursorPosition) {
          setShowAutocomplete(false);
        } else {
          setAutocompleteSearch(textAfterAt);
        }
      }
    },
    [showAutocomplete, cursorPosition]
  );

  const insertMention = useCallback(
    (type: CommentMentionType, value: string, displayText: string) => {
      const beforeAt = content.slice(0, cursorPosition - 1);
      const afterSearch = content.slice(cursorPosition + autocompleteSearch.length);

      const mentionPlaceholder = `{{${mentions.length}}}`;
      const newContent = beforeAt + mentionPlaceholder + ' ' + afterSearch;

      setMentions([
        ...mentions,
        {
          mentionType: type,
          mentionValue: value,
          startIndex: cursorPosition - 1,
          length: mentionPlaceholder.length,
          displayText,
        },
      ]);

      setContent(newContent);
      setShowAutocomplete(false);

      // Focus textarea
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    },
    [content, cursorPosition, autocompleteSearch, mentions]
  );

  const handleSubmit = () => {
    if (!content.trim()) return;

    // Convert mentions to API format
    const apiMentions = mentions.map((m) => ({
      mentionType: m.mentionType,
      mentionValue: m.mentionValue,
      startIndex: m.startIndex,
      length: m.length,
    }));

    mutation.mutate({
      content: content.trim(),
      mentions: apiMentions.length > 0 ? apiMentions : undefined,
    });
  };

  const filteredMembers = members.filter((m) => {
    const name = m.user?.name || m.user?.username || '';
    return name.toLowerCase().includes(autocompleteSearch.toLowerCase());
  });

  // Render content with mention placeholders replaced
  const renderPreview = () => {
    let preview = content;
    mentions.forEach((m, i) => {
      preview = preview.replace(`{{${i}}}`, `@${m.displayText}`);
    });
    return preview;
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Popover open={showAutocomplete}>
          <PopoverAnchor asChild>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment... Use @ to mention"
              className="min-h-[80px] resize-none"
            />
          </PopoverAnchor>
          <PopoverContent
            className="w-64 p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {autocompleteType === null ? (
              <div className="p-1">
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted"
                  onClick={() => setAutocompleteType('user')}
                >
                  <User className="h-4 w-4" />
                  Mention user
                </button>
                <button
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted"
                  onClick={() => setAutocompleteType('date')}
                >
                  <Calendar className="h-4 w-4" />
                  Mention date
                </button>
              </div>
            ) : autocompleteType === 'user' ? (
              <div className="p-1 max-h-48 overflow-y-auto">
                {filteredMembers.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No users found
                  </div>
                ) : (
                  filteredMembers.map((member) => {
                    const name =
                      member.user?.name || member.user?.username || 'Unknown';
                    return (
                      <button
                        key={member.userId}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted"
                        onClick={() =>
                          insertMention('user', member.userId, name)
                        }
                      >
                        <User className="h-4 w-4" />
                        {name}
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="p-1">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted"
                    onClick={() =>
                      insertMention(
                        'date',
                        preset.value().toISOString(),
                        preset.label
                      )
                    }
                  >
                    <Calendar className="h-4 w-4" />
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!content.trim() || mutation.isPending}
        >
          {mutation.isPending ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-detail/comment-input.tsx
git commit -m "feat: add CommentInput with @mention autocomplete"
```

---

## Task 17: Create Index Export File

**Files:**
- Create: `src/components/tasks/task-detail/index.ts`

**Step 1: Export all task-detail components**

```typescript
// src/components/tasks/task-detail/index.ts
export { TaskDetailContent } from './task-detail-content';
export { TaskMainColumn } from './task-main-column';
export { TaskPropertiesSidebar } from './task-properties-sidebar';
export { TaskTitle } from './task-title';
export { TaskDescription } from './task-description';
export { TaskComments } from './task-comments';
export { CommentItem } from './comment-item';
export { CommentInput } from './comment-input';
export { TaskLabelSelector } from './task-label-selector';
```

**Step 2: Commit**

```bash
git add src/components/tasks/task-detail/index.ts
git commit -m "feat: add task-detail component exports"
```

---

## Task 18: Install use-debounce Package

**Step 1: Install the package**

Run: `pnpm add use-debounce`

**Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add use-debounce package"
```

---

## Task 19: Update LabelSelector to Accept listId

**Files:**
- Modify: `src/components/task-fields/label-selector.tsx`

**Step 1: Update to use list-scoped labels**

The existing LabelSelector fetches from `/api/labels` which doesn't exist anymore. Update it to accept `listId` and use the list-scoped endpoint:

```typescript
// src/components/task-fields/label-selector.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchLabels } from '@/queries/labels';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tag } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface LabelSelectorProps {
  listId: string;
  value: string[];
  onChange: (labelIds: string[]) => void;
}

export function LabelSelector({ listId, value, onChange }: LabelSelectorProps) {
  const { data: labels, isPending } = useQuery({
    queryKey: ['labels', listId],
    queryFn: () => fetchLabels(listId),
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-[200px] justify-start">
          <Tag className="mr-2 h-4 w-4" />
          {selectedCount > 0 ? (
            <span>{selectedCount} label{selectedCount !== 1 ? 's' : ''}</span>
          ) : (
            <span className="text-muted-foreground">Add labels</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[250px] p-4" align="start">
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
                    <Badge
                      variant="outline"
                      style={{ borderColor: label.color, color: label.color }}
                    >
                      {label.name}
                    </Badge>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Update CreateTaskForm to pass listId**

Update `src/components/command-palette/create-task-form.tsx` to pass `listId` to `LabelSelector` (only render when listId is selected).

**Step 3: Commit**

```bash
git add src/components/task-fields/label-selector.tsx src/components/command-palette/create-task-form.tsx
git commit -m "fix: update LabelSelector to use list-scoped labels"
```

---

## Task 20: Type Check and Fix Issues

**Step 1: Run type check**

Run: `pnpm run types:check`

**Step 2: Fix any type errors**

Address any TypeScript errors that arise from the implementation.

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve TypeScript errors"
```

---

## Task 21: Test the Implementation

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Manual testing checklist**

- [ ] Navigate to a list, click a task card
- [ ] Verify task detail page loads with correct data
- [ ] Edit title - verify auto-save works
- [ ] Edit description - verify auto-save works
- [ ] Change status - verify immediate save
- [ ] Change assignee - verify immediate save
- [ ] Add/remove labels - verify save
- [ ] Create a new label inline
- [ ] Change due date - verify save
- [ ] Change stress level - verify save
- [ ] Post a comment
- [ ] Post a comment with @mention
- [ ] Delete your own comment
- [ ] Delete the task

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete task detail page implementation"
```

---

## Summary

This plan implements a full task detail page with:

1. **Database**: Comments and comment_mentions tables in ListDatabase
2. **API**: CRUD handlers for tasks, comments, and labels (list-scoped)
3. **UI**: Two-column layout with auto-saving fields
4. **Comments**: @mention system for users and dates with autocomplete
5. **Labels**: Inline creation in the label selector

Total tasks: 21
Estimated implementation: Sequential execution with code review between tasks
