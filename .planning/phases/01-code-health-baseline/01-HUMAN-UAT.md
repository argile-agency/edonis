---
status: partial
phase: 01-code-health-baseline
source: [01-VERIFICATION.md]
started: 2026-10-13T00:00:00Z
updated: 2026-10-13T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. CI green on a real PR
expected: Open a PR against `main`; all `ci.yml` jobs pass, including `Tests (postgres)`, `Tests (mysql)` and `Tests (sqlite)`. Note the database each leg used, whether the empty `image:` service expression on the sqlite leg is harmless, and that the job-level `SESSION_DRIVER=memory` wins over `.env.test`.
result: [pending]

### 2. CI goes red when it should
expected: On a scratch branch cut from the green branch (PR against `main`), add `export const x = {} as any` under `app/` and flip the 403 assertion in `tests/functional/grades.spec.ts` to 200. The lint job and every `Tests (...)` leg fail and the run is red. Close the PR unmerged and delete the branch.
result: [pending]

### 3. Branch protection / required checks
expected: Any required status checks referencing the old `Unit Tests (...)` names are updated to `Tests (...)` (the job was renamed). Decide whether `CI Summary` (echo-only, never fails) should be required or made to fail on any non-success (REVIEW WR-05).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
