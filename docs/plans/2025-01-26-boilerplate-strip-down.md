# Boilerplate Strip-Down Plan

## Overview
Strip the Stress Debt app down to a clean boilerplate with GitHub auth, minimal sidebar, theme system, and fresh shadcn/ui installation.

---

## Phase 1: Remove Task/List-Specific Code

### 1.1 Delete API routes and handlers
- `src/app/api/analytics/` (entire directory)
- `src/app/api/comments/` (entire directory)
- `src/app/api/invitations/` (entire directory)
- `src/app/api/labels/` (entire directory)
- `src/app/api/lists/` (entire directory)
- `src/app/api/recurring-tasks/` (entire directory)
- `src/app/api/search/` (entire directory)
- `src/app/api/tasks/` (entire directory)
- `src/app/api/routeMapper.ts`

### 1.2 Delete pages
- `src/app/pages/Analytics.tsx`
- `src/app/pages/lists/` (entire directory)
- `src/app/pages/tasks/` (entire directory)
- `src/app/pages/Welcome.tsx`

### 1.3 Delete feature components
- `src/components/analytics/` (entire directory)
- `src/components/collaborative-editor/` (entire directory)
- `src/components/command-palette/` (entire directory)
- `src/components/lists/` (entire directory)
- `src/components/settings/default-labels-form.tsx`
- `src/components/sidebar/` (entire directory)
- `src/components/task-fields/` (entire directory)
- `src/components/tasks/` (entire directory)

### 1.4 Delete collaboration system
- `src/collaboration/` (entire directory)

### 1.5 Delete search system
- `src/lib/search/` (if exists, or search-related files in lib)

### 1.6 Delete schemas
- `src/schemas/` - remove task/list/comment schemas, keep any auth-related ones

---

## Phase 2: Simplify Database

### 2.1 Update centralDbMigrations.ts
Keep only better-auth tables:
- `user` (without defaultLabels column)
- `account`
- `session`
- `verification`

Remove migrations:
- `002_lists_table`
- `003_list_members_table`
- `004_list_invitations_table`
- `005_user_settings`

### 2.2 Remove list database entirely
- Delete `src/db/listDbMigrations.ts`
- Delete `src/db/listDbDurableObject.ts`
- Update `src/db/index.ts` to remove ListDatabase references

### 2.3 Update wrangler.jsonc
- Remove LIST_DATABASE durable object binding
- Remove COLLABORATION_ROOM durable object binding
- Remove SEARCH_SYNC_QUEUE binding
- Keep DATABASE (central auth db), STATE_COORDINATOR, REALTIME_DURABLE_OBJECT

---

## Phase 3: Update Worker/Router

### 3.1 Simplify src/worker.tsx
- Remove all task/list API route imports and registrations
- Remove SyncedStateServer handlers for lists
- Remove collaboration WebSocket route
- Remove queue handler for search sync
- Remove CollaborationRoom export
- Remove ListDatabase export
- Keep: auth routes, theme routes, realtime route, synced state routes
- Keep routes: Home, Login, Settings (remove Lists, Analytics, ListDetail, TaskDetail)

---

## Phase 4: Simplify Sidebar

### 4.1 Update src/app/app-sidebar.tsx
- Remove Lists, Analytics, Settings nav items (keep only Home)
- Remove SidebarInvitations import and usage
- Change app name from "Stress Debt" to "App Name" placeholder
- Keep: expand/collapse, theme toggle, sign out

---

## Phase 5: Simplify Pages

### 5.1 Update src/app/pages/Home.tsx
- Replace with minimal placeholder content
- Remove all task/list-related code

### 5.2 Update src/app/pages/Settings.tsx
- Keep only profile editing (avatar, name, username)
- Remove default labels form

### 5.3 Keep src/app/pages/Login.tsx as-is

---

## Phase 6: Fresh shadcn/ui Installation

### 6.1 Delete all UI components
- Delete entire `src/components/ui/` directory

### 6.2 Reset global.css
- Remove custom "Stress Debt" theme
- Use shadcn/ui default CSS variables

### 6.3 Reinstall shadcn/ui
```bash
npx shadcn@latest init
```

### 6.4 Add required components
```bash
npx shadcn@latest add accordion alert alert-dialog avatar badge button calendar card carousel chart checkbox collapsible command dialog dropdown-menu input label menubar navigation-menu pagination popover progress resizable scroll-area select separator sheet sidebar skeleton slider sonner switch table tabs textarea tooltip
```

---

## Phase 7: Clean Up Dependencies

### 7.1 Remove unused dependencies from package.json
Remove:
- `@anthropic-ai/sdk`
- `@chroma-core/chroma-cloud-splade`
- `@chroma-core/jina`
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `@tiptap/*` (all tiptap packages)
- `chromadb`
- `lib0`
- `tippy.js`
- `y-protocols`
- `yjs`
- `recharts`

Keep:
- All `@radix-ui/*` packages (shadcn dependencies)
- `@tanstack/react-query` (useful for data fetching)
- `@tanstack/react-table` (shadcn table component)
- `better-auth`
- `class-variance-authority`, `clsx`, `tailwind-merge` (shadcn utilities)
- `cmdk` (command component)
- `date-fns` (date utilities)
- `embla-carousel-react` (carousel component)
- `kysely` (database)
- `lucide-react` (icons)
- `nanoid` (ID generation)
- `react`, `react-dom`, `react-server-dom-webpack`
- `react-day-picker` (calendar)
- `react-resizable-panels` (resizable component)
- `rwsdk`
- `sonner` (toast)
- `tailwindcss`, `@tailwindcss/*`
- `use-debounce`
- `zod`

### 7.2 Run pnpm install after cleanup

---

## Phase 8: Clean Up Misc Files

### 8.1 Update src/lib/utils.ts
- Keep cn() utility
- Remove any task/list-specific utilities

### 8.2 Clean up remaining lib files
- Keep: `auth.ts`, `auth-client.ts`, `durableObjectAdapter.ts`, `theme.ts`, `utils.ts`
- Remove: `react-query-utils.ts` (if task-specific), search-related files
- Review middleware files - keep auth middleware, remove list-specific middleware

### 8.3 Update app layout files
- `src/app/app-layout.tsx` - simplify if needed
- `src/app/app-main-content.tsx` - simplify if needed

### 8.4 Update Document.tsx and RealtimeDocument.tsx
- Change title from "Stress Debt" to generic placeholder

---

## Phase 9: Verification

### 9.1 Build check
```bash
pnpm build
```

### 9.2 Type check
```bash
pnpm check
```

### 9.3 Lint
```bash
pnpm lint
```

### 9.4 Manual testing
- Start dev server
- Test GitHub OAuth login
- Test theme toggle
- Test sidebar expand/collapse
- Test settings page profile editing
