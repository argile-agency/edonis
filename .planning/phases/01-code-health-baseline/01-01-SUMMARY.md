---
phase: 01-code-health-baseline
plan: 01
subsystem: types / error-handling / course-content
tags: [typescript, lucid, debt, as-any, exception-handler]
requires: []
provides:
  - "14 of 16 `as any` casts removed from app/ (Clusters A, B, C)"
  - "Module-level structural guards hasCode / hasStatus / hasHeaders in the exception handler"
  - "Working max+1 order assignment for new course modules and contents"
affects:
  - app/models/user.ts
  - app/models/cohort.ts
  - app/models/course_category.ts
  - app/controllers/dashboard_controller.ts
  - app/exceptions/handler.ts
  - app/controllers/course_contents_controller.ts
tech-stack:
  added: []
  patterns:
    - "Annotated concrete local (`const self: User = this`) to evaluate ExtractModelRelations inside model methods"
    - "Structural `in`-narrowing type guards for `unknown` errors (no package imports, no assertions)"
    - "Lucid `pojo<T>()` for aliased aggregate result typing"
key-files:
  created:
    - .planning/phases/01-code-health-baseline/deferred-items.md
  modified:
    - app/models/user.ts
    - app/models/cohort.ts
    - app/models/course_category.ts
    - app/controllers/dashboard_controller.ts
    - app/exceptions/handler.ts
    - app/controllers/course_contents_controller.ts
decisions:
  - "Type guards use `'prop' in error` narrowing so the guard bodies need no assertion at all (stricter than the plan's allowance of a named-type cast)"
  - "Kept `pojo<{ maxOrder: number | null }>()` without the string/Number() fallback: `order` is `integer().unsigned()` and pg / mysql2 (default options) / better-sqlite3 all return MAX(int) as a JS number"
  - "Task 3 committed as `fix(courses)` rather than `chore(types)` because `pojo()` changes runtime behaviour (see Deviations)"
metrics:
  duration: "~15 min"
  completed: 2026-10-10
  tasks: 3
  files: 6
---

# Phase 01 Plan 01: Remove `as any` Clusters A/B/C Summary

Removed 14 of the 16 `as any` casts in `app/`. The fixes are annotated `this`-locals for Lucid relation loads, three structural type guards in the HTTP exception handler, and `pojo<T>()` typing for the aliased max-order aggregates. The last change also fixes a latent bug: new modules and contents were always given `order = 1`.

## Results

| Check | Result |
|-------|--------|
| `bun run typecheck` | exit 0 |
| `bun run lint` | exit 0 |
| `grep -rn "as any" app/ --include="*.ts" \| wc -l` | **2** (`app/models/course.ts:272`, `:276`, owned by plan 01-02) |
| `grep -rn "as never\|as unknown as\|@ts-expect-error\|eslint-disable" app/ --include="*.ts"` | no matches |
| Files changed vs base `ea9fae5` | exactly the 6 files in `files_modified`; `app/models/course.ts` untouched |
| `protected debug = !app.inProduction` | present once; `git diff -U0 \| grep -E '^[-+].*(debug\|inProduction)'` empty |
| `this.debug` occurrences in handler | 2 (unchanged reads) |
| `@adonisjs/limiter` import in handler | none |
| `const self: User = this` in user.ts | 3 |
| `preload(` in user/cohort/course_category | 0 / 0 / 0 |
| `pojo<` / `(maxOrder \|\| 0) + 1` in course_contents_controller | 2 / 2 |

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (Cluster A, 7 casts) | `b764e39` | chore(types): remove as any from model relation loads via annotated locals |
| 2 (Cluster B, 5 casts) | `6c3e440` | chore(types): replace as any in exception handler with structural type guards |
| 3 (Cluster C, 2 casts) | `c5d226e` | fix(courses): type max-order aggregates with pojo and stop dropping them into $extras |

### Handler behaviour delta: exact commit-body wording (Task 2, `6c3e440`)

> Behaviour delta: a non-string error.code now yields '' instead of throwing on .toLowerCase(), a non-number error.status now falls back to 500, and a non-numeric retry-after header now yields undefined instead of NaN. The debug disclosure gate is untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `pojo()` changes runtime behaviour: max-order lookup was silently broken**
- **Found during:** Task 3
- **Conflict with plan:** The plan says every edit is "type-only with zero behaviour delta". Its success criteria allow only one documented runtime exception, the error handler. **Task 3 contradicts both.** It is a real runtime change.
- **Issue:** Without `pojo()`, Lucid hydrates the result rows into `CourseModule` / `CourseContent` instances. `BaseModel.$consumeAdapterResult` (`node_modules/@adonisjs/lucid/build/src/orm/base_model/index.js:1195-1247`) puts any key that is not a declared column into `$extras`. So the aliased `maxOrder` landed in `row.$extras.maxOrder`, `(row as any).maxOrder` was always `undefined`, and every module or content created without an explicit `payload.order` got `order = (undefined || 0) + 1 = 1`.
- **Fix:** Applied exactly as the plan specified (`.pojo<{ maxOrder: number | null }>()` + `maxOrderResult[0]?.maxOrder ?? null`). `pojo()` returns raw rows, so `maxOrder` now holds the real `MAX(order)` and new items get `max + 1`, which the original code intended. The plan's acceptance criteria require `pojo<` ×2, so preserving the bug would not have met them.
- **Type-safety check:** `order` is `table.integer('order').unsigned()` in both migrations. pg returns `max(int4)` as a number, mysql2 with default options (no `bigNumberStrings` / `decimalNumbers` in `config/database.ts`) returns INT/BIGINT as a number, and better-sqlite3 returns an integer. The `number | null` generic is therefore accurate, and the pre-authorised `number | string | null` + `Number(...)` fallback was not needed. `(maxOrder || 0) + 1` is unchanged.
- **Commit type:** used `fix(courses)` instead of `chore(types)` and stated the behaviour change in the commit body.
- **Orchestrator flag:** any test, fixture or seeder that expects newly created modules or contents to default to `order = 1` would now see `max + 1`. No such assertion exists in the current phase plans or `tests/`.
- **Files modified:** `app/controllers/course_contents_controller.ts`
- **Commit:** `c5d226e`

### Minor implementation choices (within plan latitude)

- **Guard bodies use `in`-narrowing instead of a named-type cast.** The plan allowed `(error as ErrorWithCode).code`. TypeScript's `'code' in error` narrowing makes that cast unnecessary, so the guards contain no assertion of any kind.
- **Prettier reflowed `hasCode`** onto fewer lines (lint enforces prettier). Formatting only.

## Deferred Issues

Logged in `.planning/phases/01-code-health-baseline/deferred-items.md` (out of scope and present before this plan):

1. The 429 page reads `headers['retry-after']`, but `@adonisjs/limiter` sets `"Retry-After"` (capitalised, numeric). `retryAfter` has therefore always been `undefined`. The refactor kept the same key, so this did not change.
2. `ErrorWithHeaders` types header values as `string`, while the limiter's runtime values are numbers. This is harmless because `Number.parseInt` coerces.

## Threat Model Compliance

- **T-01-01 (Information disclosure):** the `debug` gate is provably untouched (empty diff grep). No new keys were added to any `inertia.render('errors/...')` props.
- **T-01-02 (Tampering):** no substitute escape hatches anywhere in `app/`.
- **T-01-03 (DoS):** the `hasCode` guard removes the `.toLowerCase()` crash path for a non-string `code`.
- **T-01-04:** relation `declare` lines are unchanged, and there are no `preload(` substitutions.
- **T-01-SC:** no packages installed (only `bun install` of the existing lockfile into the fresh worktree).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: app/models/user.ts, app/models/cohort.ts, app/models/course_category.ts, app/controllers/dashboard_controller.ts, app/exceptions/handler.ts, app/controllers/course_contents_controller.ts, .planning/phases/01-code-health-baseline/deferred-items.md
- FOUND commits: b764e39, 6c3e440, c5d226e
