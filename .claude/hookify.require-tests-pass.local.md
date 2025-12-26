---
name: require-tests-pass
enabled: true
event: stop
pattern: .*
action: block
---

🚫 **Cannot complete - Tests must pass first**

Before finishing this task, you must verify:

**Required checks:**

- [ ] Tests were run
- [ ] All tests passed

**How to proceed:**

1. Run the test suite for this project
2. Verify all tests pass (no failures or errors)
3. Once confirmed, you can complete the task

**If tests fail:**

- Fix the failing tests first
- Do not complete the task with failing tests
- Ensure all tests are green before stopping
