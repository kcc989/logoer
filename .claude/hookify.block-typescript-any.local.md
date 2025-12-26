---
name: block-typescript-any
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.tsx?$
  - field: new_text
    operator: contains
    pattern: as any
---

🚫 **TypeScript "as any" detected and blocked**

You're attempting to use `as any` type assertion in a TypeScript file.

**Why this is blocked:**

- `as any` bypasses TypeScript's type safety
- Can hide bugs and type errors
- Makes code harder to maintain

**If you really need to use `as any`:**
Add an eslint-disable comment:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const value = someValue as any;
```

Or for the whole file:

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
```

**Better alternatives:**

- Use specific types: `as User`, `as string[]`
- Use `unknown` type: `as unknown` (then narrow it down)
- Use proper type guards
- Fix the type at the source
