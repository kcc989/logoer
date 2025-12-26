Here's a quick overview of the code you'd need:

## 1. Worker Setup (`src/worker.tsx`)

```ts
import { SyncedStateServer, syncedStateRoutes } from 'rwsdk/use-synced-state/worker';
import { requestInfo } from 'rwsdk/worker';
import { db } from './db';

// Conditional key scoping
SyncedStateServer.registerKeyHandler(async (key) => {
  // User is already loaded in context by middleware
  const userId = requestInfo.ctx.user?.id;

  if (!userId) {
    throw new Error('Authentication required');
  }

  // Multiplayer lists - shared across users
  if (key.startsWith('list-')) {
    const listId = key.replace('list-', '');

    // Check access using list_members table
    const member = await db
      .selectFrom('list_members')
      .select('id')
      .where('listId', '=', listId)
      .where('userId', '=', userId)
      .executeTakeFirst();

    if (!member) {
      throw new Error('Access denied to list');
    }

    return key; // Unscoped - shared
  }

  // User-scoped state
  return `user:${userId}:${key}`;
});

// Optional: logging
SyncedStateServer.registerSetStateHandler((key, value) => {
  console.log('State updated', { key, value });
});

SyncedStateServer.registerGetStateHandler((key, value) => {
  console.log('State retrieved', { key, exists: value !== undefined });
});

export default defineApp([
  ...syncedStateRoutes(() => requestInfo.env.STATE_COORDINATOR),
  // your other routes...
]);
```

## 2. Worker Export (`src/worker.tsx`)

```ts
export { SyncedStateServer } from 'rwsdk/use-synced-state/worker';
```

## 3. Wrangler Config (`wrangler.jsonc`)

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "STATE_COORDINATOR",
        "class_name": "SyncStateServer",
      },
    ],
  },
}
```

## 4. Server Function to Get User's Lists (`src/lib/services/lists.ts`)

Add a new server function that gets lists for a user (uses same logic as the API):

```ts
export async function getListsByUser(userId: string): Promise<ListWithMembers[]> {
  return db
    .selectFrom('lists')
    .innerJoin('list_members', 'lists.id', 'list_members.listId')
    .where('list_members.userId', '=', userId)
    .selectAll('lists')
    .select((eb) => [
      eb
        .selectFrom('list_members as lm')
        .innerJoin('user', 'lm.userId', 'user.id')
        .where('lm.listId', '=', eb.ref('lists.id'))
        .select([
          'lm.id',
          'lm.listId',
          'lm.userId',
          'lm.role',
          'lm.joinedAt',
          'user.name',
          'user.email',
          'user.username',
        ])
        .as('members'),
    ])
    .execute();
}
```

## 5. Lists Page (Server Component) (`src/app/pages/lists/page.tsx`)

```tsx
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getListsByUser } from '@/lib/services/lists';
import { ListsOverview } from '@/components/lists/lists-overview';

export default async function ListsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return <div>Please log in</div>;
  }

  // Load initial data from database
  const initialLists = await getListsByUser(session.user.id);

  return <ListsOverview initialLists={initialLists} />;
}
```

## 6. Lists Overview Component (user-scoped) (`src/components/lists/lists-overview.tsx`)

**Important:** This state is user-scoped, meaning each user has their own independent `user-lists-overview` state that only contains lists where they are a member.

```tsx
'use client';

import { useSyncedState } from 'rwsdk/use-synced-state';
import type { ListWithMembers } from '@/lib/schema/types';

export const ListsOverview = ({
  initialLists,
}: {
  initialLists: ListWithMembers[];
}) => {
  // Key: "user-lists-overview" -> "user:123:user-lists-overview"
  // Each user has their own state containing only their lists
  // Initial data loaded from server component
  const [lists] = useSyncedState<ListWithMembers[]>(
    initialLists,
    'user-lists-overview'
  );

  return (
    <div>
      <h1>My Lists</h1>
      {lists.map((list) => (
        <a key={list.id} href={`/lists/${list.id}`}>
          {list.name} ({list.members?.length ?? 0} members)
        </a>
      ))}
    </div>
  );
};
```

## 7. Individual List Component (multiplayer)

```tsx
'use client';

import { useSyncedState } from 'rwsdk/use-synced-state';
import type { Task, List } from '@/lib/schema/types';

type ListWithTasks = List & {
  tasks: Task[];
};

export const ListDetail = ({
  listId,
  currentUserId,
}: {
  listId: string;
  currentUserId: string;
}) => {
  // Key: "list-abc123" -> "list-abc123" (shared/multiplayer)
  const [list, setList] = useSyncedState<ListWithTasks | null>(
    null,
    `list-${listId}`
  );

  const addTask = (text: string) => {
    setList((prev) => ({
      ...prev!,
      tasks: [
        ...prev!.tasks,
        {
          id: crypto.randomUUID(),
          listId,
          text,
          completed: false,
          createdBy: currentUserId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    }));
  };

  const toggleTask = (taskId: string) => {
    setList((prev) => ({
      ...prev!,
      tasks: prev!.tasks.map((task) =>
        task.id === taskId
          ? { ...task, completed: !task.completed, updatedAt: Date.now() }
          : task
      ),
    }));
  };

  const removeTask = (taskId: string) => {
    setList((prev) => ({
      ...prev!,
      tasks: prev!.tasks.filter((task) => task.id !== taskId),
    }));
  };

  if (!list) return <div>Loading...</div>;

  return (
    <div>
      <h1>{list.name}</h1>
      {list.tasks.map((task) => (
        <div key={task.id}>
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => toggleTask(task.id)}
          />
          {task.text}
          <button onClick={() => removeTask(task.id)}>×</button>
        </div>
      ))}
      <input
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            addTask(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />
    </div>
  );
};
```

## Key Points

**State Scoping:**

- `"user-lists-overview"` → per-user (transformed to `"user:123:user-lists-overview"`)
- `"list-{listId}"` → shared/multiplayer (stays as `"list-abc123"`)

**Real-time Updates:**

- All users viewing `list-abc123` see changes instantly
- Each user sees their own `user-lists-overview`

**Authorization:**

- Worker uses Better Auth session from `auth.api.getSession()`
- Validates list access via `list_members` table (checks `listId` + `userId`)
- Throws error if user doesn't have permission

**Database Architecture:**

- Central DB (`DATABASE` binding) contains:
  - `user` table (from Better Auth)
  - `session` table (Better Auth sessions)
  - `lists` table
  - `list_members` table (with `role`: 'member' or 'owner')
- List-specific DB (`LIST_DATABASE` binding) contains per-list data:
  - `tasks` table
  - `labels` table
  - `recurring_tasks` table

**Initial Data & Updates:**

- **User Lists Overview** (`user-lists-overview`):
  - User-scoped state - each user has their own independent copy
  - Hydrate from `/api/lists` endpoint which returns only lists where user is a member (via `list_members` table)
  - When a user is added/removed from a list, update their `user-lists-overview` state accordingly
  - Users only see and receive updates for lists they are members of

- **Individual List** (`list-{listId}`):
  - Shared/multiplayer state - all members of the list see the same data
  - Hydrate from database on initial load (tasks, list details)
  - Real-time updates propagate to all active users viewing that list
  - Access controlled by `list_members` check in key handler

**State Update Patterns:**

When list membership changes:
```ts
// User added to list - update their overview
const userOverviewKey = `user:${newUserId}:user-lists-overview`;
// Push the new list to their overview state

// User removed from list - update their overview
const userOverviewKey = `user:${removedUserId}:user-lists-overview`;
// Remove the list from their overview state
```
