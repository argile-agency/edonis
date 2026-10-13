---
phase: 01-code-health-baseline
plan: 04
subsystem: models, lint
tags: [debt-01, debt-02, eslint, lucid, json-columns, refactor]
requires: [01-01, 01-02]
provides:
  - "ESLint guard: `as any` under app/**/*.ts fails `bun run lint` (no-restricted-syntax, TSAsExpression > TSAnyKeyword)"
  - "7 identical JSON column hooks now share app/helpers/json_column.ts `jsonColumnConfig`"
affects: [01-05 (the CI lint gate now enforces DEBT-02)]
tech-stack:
  added: []
  patterns:
    - "Core ESLint no-restricted-syntax with an AST selector, scoped by files glob, instead of type-aware typescript-eslint rules"
    - "Shared Lucid column config object via relative import '../helpers/json_column.js'"
key-files:
  created: []
  modified:
    - app/models/assignment.ts
    - app/models/bulk_enrollment_log.ts
    - app/models/course_content.ts
    - app/models/submission.ts
    - eslint.config.js
    - .planning/phases/01-code-health-baseline/deferred-items.md
decisions:
  - "Dedup only the 7 byte-identical JSON column blocks. role.ts, course.ts and app_setting.ts keep their divergent hooks (Phase 2 correctness candidate alongside DEBT-08)"
  - "Guard `as any` with core no-restricted-syntax scoped to app/**/*.ts, not @typescript-eslint/no-explicit-any (51-98 errors) or no-unnecessary-type-assertion (crashes without type info)"
  - "Single-line commit messages per CLAUDE.md, so the exclusion rationale lives in this SUMMARY and deferred-items.md instead of a commit body"
metrics:
  duration: ~10 min
  completed: 2026-10-13
  tasks: 2
  files: 5
---

# Phase 01 Plan 04: JSON Column Dedup and `as any` Lint Guard Summary

Seven byte-identical Lucid JSON column `prepare`/`consume` blocks in four models now share the existing `jsonColumnConfig` helper. A new `no-restricted-syntax` rule (`TSAsExpression > TSAnyKeyword`, scoped to `app/**/*.ts`) makes any new `as any` in backend code fail `bun run lint`. A tripwire test showed the rule fires.

## Tasks

| Task | Commit | Message |
|------|--------|---------|
| 1. Dedup 7 identical JSON column configs | `0952404` | refactor(models): share jsonColumnConfig across 7 identical JSON columns |
| 2. Add the `as any` ESLint guard | `0da44d7` | chore(lint): ban `as any` under app/ via no-restricted-syntax |

## Measured Results

### `@column(jsonColumnConfig)` totals per file (Task 1)

| File | Columns | Count |
|------|---------|-------|
| `app/models/assignment.ts` | `rubricData` | 1 |
| `app/models/bulk_enrollment_log.ts` | `errorDetails`, `importOptions` | 2 |
| `app/models/course_content.ts` | `metadata` | 1 |
| `app/models/submission.ts` | `fileAttachments`, `feedbackAttachments`, `rubricScores` | 3 |
| **Total** | | **7** |

- Each of the four files has exactly one `import { jsonColumnConfig } from '../helpers/json_column.js'`, placed after the `#models/*` imports to match `audit_log.ts`.
- `JSON.parse(value)` now appears 0 times in each of the four edited files. It still appears once in each of `role.ts`, `course.ts` and `app_setting.ts`.
- The Task 1 commit touches only those 4 files. `git diff` shows no change to any `declare` line, and `app/helpers/json_column.ts` is unchanged.
- In `bulk_enrollment_log.ts`, the `ErrorDetail` and `ImportOptions` types are still referenced by their `declare` fields, so no unused-type lint error appeared.

### Anti-dodge grep (Task 2)

- `grep -rn "as any\|as never\|as unknown as\|@ts-expect-error" app/ --include="*.ts" | wc -l` → **0**
- `grep -rn "eslint-disable" app/ --include="*.ts" | wc -l` → **0**
- `grep -c "no-explicit-any\|no-unnecessary-type-assertion" eslint.config.js` → **0**
- The `eqeqeq: ['error', 'always', { null: 'ignore' }]` block and its comment are unchanged. The `eslint.config.js` diff contains only the 15 added lines.
- `@adonisjs/eslint-config` does not set `no-restricted-syntax`. `eslint --print-config app/models/course.ts` shows only the new selector, so the new block does not override any preset rule.
- No dependency was added and `package.json` is unchanged.

### Tripwire: guard deliberately tripped

I appended `export const tripwire = 1 as any` to `app/helpers/json_column.ts` and ran `bun run lint`. It **exited 1**, and the guard was the only error:

```
app/helpers/json_column.ts
  18:30  error  `as any` is banned in app/. Narrow the type properly instead: an annotated local for polymorphic `this`, structural guards for `unknown` errors, `pojo<T>()` for aggregates, or direct Luxon comparison for `DateTime`. See .planning/phases/01-code-health-baseline/01-RESEARCH.md  no-restricted-syntax

✖ 1 problem (1 error, 0 warnings)
error: script "lint" exited with code 1
```

I then restored the file with `git checkout -- app/helpers/json_column.ts`. `bun run lint` **exited 0** and `git status` showed no leftover changes. An earlier attempt with `(1 as any) as number` also exited 1, but it set off `naming-convention` and `prettier` too, so I repeated the test with the clean form above.

### Final gates on the committed tree

- `bun run lint` → exit 0
- `bun run typecheck` → exit 0

## Excluded JSON Column Blocks (Phase 2 correctness candidate, alongside DEBT-08)

These three look like duplicates, but their null/empty handling differs. Moving them onto `jsonColumnConfig` would change runtime behaviour, so they were left alone on purpose:

- **`app/models/role.ts` (`permissions`)**: `prepare` passes strings through unchanged. `jsonColumnConfig` would **double-encode** an already-serialized string.
- **`app/models/course.ts` (`tags`)**: uses falsy checks. `jsonColumnConfig` would call `JSON.parse('')` on an empty-string value and throw a **`SyntaxError` at read time**.
- **`app/models/app_setting.ts` (`socialLinks`)**: `prepare` has no null check and stores the literal string `'null'`. `jsonColumnConfig` would store SQL `NULL` instead, a **stored-value change** that needs a backfill.

The same entry is in `deferred-items.md` (item 3, "From 01-04").

## Deviations from Plan

### CLAUDE.md-driven adjustments

**1. The exclusion rationale is not in a commit message body**
- **Plan said:** the Task 1 commit body should name the three excluded files and how each would fail.
- **What was done:** CLAUDE.md, the user's commit-style preference and the orchestrator all require single-line conventional commits with no trailers. Commit `0952404` is therefore subject-only. The rationale is recorded in this SUMMARY ("Excluded JSON Column Blocks") and in `deferred-items.md` item 3, so it is still tracked and visible to the verifier.
- **Acceptance impact:** the "commit message body names all three excluded files" criterion is intentionally not met. All other Task 1 criteria pass.

### Execution notes

- The plan's `<verify>` commands `cd` into the main checkout. They were run from the worktree root instead, with the same commands and assertions.

Otherwise the plan ran as written. No bugs were auto-fixed and no architectural changes were needed.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: app/models/assignment.ts, app/models/bulk_enrollment_log.ts, app/models/course_content.ts, app/models/submission.ts, eslint.config.js
- FOUND: commit 0952404, commit 0da44d7
