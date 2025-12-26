# Task Detail Page Design

## Overview

A full-page task detail view allowing users to view and edit all task properties, manage labels, and post comments with @mentions.

## Route

```
/lists/:listId/tasks/:taskId
```

## Layout

Two-column layout inspired by Linear:

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to List                                    [Delete Task] │
├────────────────────────────────────┬────────────────────────────┤
│                                    │                            │
│  Task Title (editable)             │  Status: [Dropdown]        │
│                                    │                            │
│  Description (markdown editor)     │  Assignee: [User Select]   │
│                                    │                            │
│                                    │  Labels: [Multi-select]    │
│                                    │    + Create new label      │
│                                    │                            │
│                                    │  Due Date: [Date Picker]   │
│                                    │                            │
│                                    │  Stress Level: [1-10]      │
│                                    │                            │
├────────────────────────────────────┤                            │
│                                    │                            │
│  Comments                          │                            │
│  ─────────────────────────────     │                            │
│                                    │                            │
│  [Avatar] User Name · 2h ago       │                            │
│  Comment text with @mentions...    │                            │
│                                    │                            │
│  [Avatar] User Name · 1h ago       │                            │
│  Another comment...                │                            │
│                                    │                            │
│  ┌─────────────────────────────┐   │                            │
│  │ Add a comment...            │   │                            │
│  │ @mention users, tasks, dates│   │                            │
│  └─────────────────────────────┘   │                            │
│                        [Post]      │                            │
│                                    │                            │
└────────────────────────────────────┴────────────────────────────┘
```

## Data Model

### Comments Table (in ListDatabase)

```sql
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_comments_task_id ON comments(task_id);
```

### Comment Mentions Table

```sql
CREATE TABLE comment_mentions (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  mention_type TEXT NOT NULL CHECK (mention_type IN ('user', 'task', 'date')),
  -- For user mentions: user ID
  -- For task mentions: task ID
  -- For date mentions: ISO date string
  mention_value TEXT NOT NULL,
  -- Position in the comment text where mention starts
  start_index INTEGER NOT NULL,
  -- Length of the mention placeholder in text
  length INTEGER NOT NULL
);

CREATE INDEX idx_comment_mentions_comment_id ON comment_mentions(comment_id);
```

### Zod Schemas

```typescript
// src/schemas/comments.ts

export const commentMentionTypeSchema = z.enum(['user', 'task', 'date']);

export const commentMentionSchema = z.object({
  id: z.string(),
  commentId: z.string(),
  mentionType: commentMentionTypeSchema,
  mentionValue: z.string(),
  startIndex: z.number().int(),
  length: z.number().int(),
});

export const commentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  authorId: z.string(),
  content: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const commentWithMentionsSchema = commentSchema.extend({
  mentions: z.array(commentMentionSchema),
  author: userPublicSchema,
});

export const createCommentInputSchema = z.object({
  taskId: z.string(),
  content: z.string().min(1),
  mentions: z.array(z.object({
    mentionType: commentMentionTypeSchema,
    mentionValue: z.string(),
    startIndex: z.number().int(),
    length: z.number().int(),
  })).optional(),
});
```

## Components

### Page Component

```
src/app/lists/[listId]/tasks/[taskId]/
├── page.tsx                 # Route handler with auth
├── TaskDocument.tsx         # Realtime document component
├── TaskDetailContent.tsx    # Main content wrapper
├── TaskHeader.tsx           # Back button, delete action
├── TaskMainColumn.tsx       # Title, description, comments
├── TaskPropertiesSidebar.tsx # Status, assignee, labels, etc.
├── TaskTitle.tsx            # Editable title with auto-save
├── TaskDescription.tsx      # Markdown editor with auto-save
├── TaskComments.tsx         # Comments list
├── CommentItem.tsx          # Single comment with mentions
├── CommentInput.tsx         # New comment form with @mention
└── MentionAutocomplete.tsx  # Autocomplete popover for @mentions
```

### Shared Components

```
src/components/task-fields/
├── StatusSelect.tsx         # Status dropdown (reuse from kanban)
├── AssigneeSelect.tsx       # User selector
├── LabelSelect.tsx          # Multi-select with inline creation
├── DueDatePicker.tsx        # Date picker
└── StressLevelInput.tsx     # 1-10 slider or buttons
```

## @Mentions System

### Mention Types

1. **User mentions** (`@username`)
   - Autocomplete from list members
   - Renders as clickable chip showing user name
   - Click navigates to user profile (future)

2. **Task mentions** (`@task-title`)
   - Autocomplete from tasks in same list
   - Renders as clickable chip showing task title
   - Click navigates to task detail page

3. **Date mentions** (`@date`)
   - Autocomplete with preset options: today, tomorrow, next week
   - Or type specific date
   - Renders as formatted date chip

### Storage Format

Comments store plain text with placeholder markers. Mentions are stored separately with position info:

```typescript
// Example comment
{
  content: "Hey {{0}} can you look at {{1}} by {{2}}?",
  mentions: [
    { mentionType: 'user', mentionValue: 'user_abc123', startIndex: 4, length: 5 },
    { mentionType: 'task', mentionValue: 'task_xyz789', startIndex: 26, length: 5 },
    { mentionType: 'date', mentionValue: '2024-11-28', startIndex: 35, length: 5 },
  ]
}
```

### Rendering

When displaying, replace placeholders with rendered mention components:

```tsx
// Rendered output
<span>Hey </span>
<MentionChip type="user" id="user_abc123">@John</MentionChip>
<span> can you look at </span>
<MentionChip type="task" id="task_xyz789">@Fix login bug</MentionChip>
<span> by </span>
<MentionChip type="date" value="2024-11-28">Nov 28</MentionChip>
<span>?</span>
```

## Auto-Save Behavior

All field changes auto-save with:
- Debounced updates (300ms for text fields)
- Immediate updates for selects/toggles
- Optimistic UI updates
- Error toast on failure with retry

```typescript
// Pattern for auto-save
const debouncedUpdate = useDebouncedCallback(
  async (field: string, value: unknown) => {
    try {
      await updateTask(taskId, { [field]: value });
    } catch (error) {
      toast.error('Failed to save changes');
    }
  },
  300
);
```

## Inline Label Creation

The label selector includes an option to create new labels:

```
┌─────────────────────────────┐
│ 🔍 Search labels...         │
├─────────────────────────────┤
│ ● Bug           (red)       │
│ ○ Feature       (blue)      │
│ ○ Documentation (green)     │
├─────────────────────────────┤
│ + Create "new label name"   │
└─────────────────────────────┘
```

When creating:
1. Show inline form with name (pre-filled) and color picker
2. Create label via API
3. Automatically select the new label
4. Update label list

## Realtime Updates

Use the existing realtime infrastructure:

```typescript
// TaskDocument.tsx
export function TaskDocument({ listId, taskId }: Props) {
  return (
    <RealtimeInit listId={listId}>
      <TaskDetailContent listId={listId} taskId={taskId} />
    </RealtimeInit>
  );
}
```

The task detail page subscribes to realtime updates through the same ListDatabase Durable Object, so:
- Task changes from other users appear immediately
- New comments appear in real-time
- Label changes sync across all views

## API Handlers

### Task Handlers (existing, may need updates)

- `GET /api/lists/:listId/tasks/:taskId` - Get task with details
- `PATCH /api/lists/:listId/tasks/:taskId` - Update task fields

### Comment Handlers (new)

- `GET /api/lists/:listId/tasks/:taskId/comments` - List comments
- `POST /api/lists/:listId/tasks/:taskId/comments` - Create comment
- `DELETE /api/lists/:listId/tasks/:taskId/comments/:commentId` - Delete comment

### Label Handlers (existing, may need updates)

- `POST /api/lists/:listId/labels` - Create label (for inline creation)

## Implementation Tasks

1. **Database & Schema**
   - Add comments and comment_mentions tables to ListDatabase
   - Create Zod schemas for comments
   - Add comment types to Kysely database types

2. **API Layer**
   - Create comment handlers (list, create, delete)
   - Add realtime notifications for comments
   - Ensure task detail endpoint returns full task data

3. **Task Detail Page**
   - Create route and page component
   - Implement TaskDocument with realtime
   - Build two-column layout

4. **Left Column (Main Content)**
   - Editable title with auto-save
   - Markdown description editor with auto-save
   - Comments list with mention rendering
   - Comment input with @mention autocomplete

5. **Right Column (Properties)**
   - Status dropdown
   - Assignee selector
   - Label multi-select with inline creation
   - Due date picker
   - Stress level input

6. **@Mentions System**
   - Autocomplete popover component
   - User/task/date mention providers
   - Mention chip rendering
   - Storage and retrieval logic

7. **Polish**
   - Loading states
   - Error handling
   - Keyboard navigation
   - Mobile responsiveness
