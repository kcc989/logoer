---
name: require-use-client-with-hooks
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.tsx$
  - field: file_content
    operator: popover
    pattern: \buse[A-Z]\w*\(
  - field: file_content
    operator: not_contains
    pattern: 'use client'
---

🚫 **React Hook detected without "use client" directive!**

You're using React Hooks in a `.tsx` file, but the "use client" directive is missing.

**Why this matters:**

- React hooks can only be used in Client Components
- Server Components cannot use hooks like `useState`, `useEffect`, etc.
- The "use client" directive tells Next.js this is a Client Component

**How to fix:**
Add this at the very top of your file:

```tsx
'use client';

import React from 'react';
// ... rest of your imports and code
```

**Common hooks that require "use client":**

- `useState`, `useEffect`, `useContext`
- `useReducer`, `useCallback`, `useMemo`
- `useRef`, `useLayoutEffect`
- Any custom hooks (they all start with `use`)
