---
name: require-typescript-clean
enabled: true
event: stop
pattern: .*
action: block
---

🚫 **Cannot complete - TypeScript errors must be fixed**

Before finishing this task, you must verify:

**Required checks:**

- [ ] TypeScript type checking was run
- [ ] All TypeScript errors are fixed
- [ ] No type errors remain in the codebase

**How to proceed:**

1. Run TypeScript type checker (e.g., `tsc --noEmit` or `npm run type-check`)
2. Fix all reported type errors
3. Verify zero errors in the output
4. Once all TypeScript errors are resolved, you can complete the task

**Common commands:**

- `npx tsc --noEmit` - Check types without emitting files
- `npm run type-check` - If configured in package.json
- Check build output if TypeScript is part of the build process

**Do not complete the task with TypeScript errors!**
