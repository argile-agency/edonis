---
phase: 01-code-health-baseline
plan: 03
subsystem: testing
tags: [japa, api-client, sqlite, functional-tests, grades, test-isolation]
requires: []
provides:
  - ".env.test pinning NODE_ENV=test runs to a throwaway sqlite DB"
  - "@japa/api-client + auth/session/inertia api_client plugins in tests/bootstrap.ts"
  - "functional-suite-scoped migrate hook and NODE_ENV fail-fast guard"
  - "tests/functional/grades.spec.ts: 4 access-control tests (incl. 403 for non-enrolled)"
  - "DEBT-10 backlog requirement for un-ported gradebook computation scenarios"
affects: [01-05 (CI gate runs `node ace test functional`), 01-04 (also edits app/models/assignment.ts)]
tech-stack:
  added: ["@japa/api-client@3.2.1 (devDependency)"]
  patterns: ["withGlobalTransaction per test (no destructive teardown)", "withInertia() / redirects(0) so no full-HTML render needs a Vite manifest"]
key-files:
  created: [.env.test, tests/functional/grades.spec.ts]
  modified: [.env.example, package.json, bun.lock, tests/bootstrap.ts, app/models/assignment.ts, .planning/REQUIREMENTS.md]
  deleted: [tests/functional/grades.spec.ts.skip]
decisions:
  - "Fixed Assignment.module belongsTo foreignKey (moduleId) as Rule 1: grades.course returned 500 for every enrolled student and instructor"
  - "Migrate hook scoped to the functional suite inside configureSuite, never runner-global (its teardown is migration:reset)"
  - "PORT overridden at runtime only (PORT=38517) to avoid the user's running dev server; .env.test carries no PORT key"
metrics:
  duration: ~10min
  completed: 2026-10-10
  tasks: 3
  files: 9
---

# Phase 1 Plan 03: Functional Test Infrastructure Summary

The functional suite now runs 4 real access-control tests for the grades routes against a throwaway sqlite database (`.env.test`). Each test runs inside a `withGlobalTransaction()` rollback, and the suite never needs a Vite manifest. Writing the suite also exposed a real 500 in the course gradebook, which is now fixed.

## Results

| Check | Result |
|---|---|
| `node ace test functional` | **4 passed (4)**, exit 0, no `NO TESTS EXECUTED` |
| Broken assertion (403 changed to 200) | exit **1** (3 passed, 1 failed) |
| Assertion restored | exit **0** (4 passed) |
| `@japa/api-client` installed version | **3.2.1** (devDependencies `^3.2.1`, not in dependencies, postinstall: none) |
| `tmp/test.sqlite3` after run | present, mtime 01:03 (same as the run). The sqlite DB was used and the dev Postgres was not. |
| `public/assets/.vite/manifest.json` | still absent after the green run |
| `manifest` / `viteReactRefresh` in functional output | 0 occurrences |
| `node ace test unit` | exit 0, `NO TESTS EXECUTED`, no migration and no `test.sqlite3` created (checked before the first functional run) |
| `bun run typecheck` / `bun run lint` | both exit 0 after every task |
| `adonisrc.ts`, `config/session.ts`, `.gitignore` | unmodified |

**Vite port-24678 warning:** it appeared (`WebSocket server error: Port 24678 is already in use`), but the user's own dev server was running the whole time (PID 207, `bin/server.js` from the main checkout, listening on 3333 and 24678). I did not kill a user process, so this run never tested whether the warning goes away once no dev server is running. The warning did not cause any failure. To avoid `EADDRINUSE` on 3333, every run used a runtime `PORT=38517` env override. `.env.test` has no PORT key, as the plan requires.

## Tasks

| # | Task | Commit |
|---|---|---|
| 1 | `.env.test` isolation + `@japa/api-client` dev dependency + `.env.example` doc section | 4c5a42f |
| 2 | Register `apiClient`, `authApiClient`, `sessionApiClient`, `inertiaApiClient`; NODE_ENV guard in `runnerHooks.setup`; `testUtils.db().migrate()` only for `functional` in `configureSuite` | e3dbad7 |
| 3a | (deviation) Fix `Assignment.module` relation foreign key | 0c41acf |
| 3 | Rewrite `grades.spec.ts` (4 tests), add DEBT-10, `git rm` the `.skip` draft | 182fc16 |

## Tests ported (4)

1. Unauthenticated `GET grades.index` with `.redirects(0)` returns 302 with `location: /login`
2. An enrolled student on `grades.course` with `.withInertia()` gets 200 and `inertiaProps.isInstructor === false`
3. A non-enrolled student on `grades.course` gets **403** (the authorization assertion carried over from the draft)
4. The instructor on `grades.course` with `.withInertia()` gets 200 and `inertiaProps.isInstructor === true`

## Draft scenarios deliberately not ported (now tracked as DEBT-10)

These are recorded in `.planning/REQUIREMENTS.md` under Code Health as **DEBT-10** (`| DEBT-10 | Backlog | Pending |`). They are not attached to any ROADMAP phase.

- Student grades index (`grades.index`) course summary
- Student's own graded submission (85/100, feedback) shown in `props.grades`
- Instructor roster: `props.gradebook` length equals the number of enrolled students
- Instructor gradebook matrix: per-student `pointsEarned` (90 / 75)
- Grade categories listed in `position` order
- Overall-grade arithmetic (80/100 + 40/50 gives overall 80, earned 120, total 150)
- Missing submissions (overall null, earned 0, total 0, graded 0)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Assignment.module` relation inferred the wrong foreign key**
- **Found during:** Task 3 (tests 2 and 4 returned 500)
- **Issue:** `@belongsTo(() => CourseModule)` makes Lucid infer `courseModuleId`, but the column and model attribute are `moduleId`. The `.preload('module')` call at `grades_controller.ts:108` threw `E_MISSING_MODEL_ATTRIBUTE` before loading any rows, so the course gradebook returned 500 for **every** enrolled student and instructor, whatever the data. The 403 path ran fine because it returns before the preload.
- **Fix:** `@belongsTo(() => CourseModule, { foreignKey: 'moduleId' })`. This is a one-line change with no import or formatting changes.
- **Other callers:** the two `.preload('module', ...)` calls in `course_contents_controller.ts` are on `CourseContent`, not `Assignment`, so the fix does not affect them.
- **Files modified:** `app/models/assignment.ts` (not listed in this plan's `files_modified`)
- **Commit:** 0c41acf
- **Cross-plan note for the orchestrator:** plan **01-04** (same wave) also lists `app/models/assignment.ts` in `files_modified`. It edits the `rubricData` column near lines 58-66. This plan changed one separate hunk at line 102 (the relation decorator), so expect a clean merge with two hunks.

### Environment adjustments (not code deviations)
- The plan's `<automated>` verify blocks `cd` into the main checkout. I ran equivalent commands inside the worktree instead.
- A runtime `PORT=38517` override was used for every `node ace test` run because the user's dev server held port 3333.

## Known Stubs

None.

## Threat Flags

None. No new network, auth or schema surface was added. `.env.test` contains only a throwaway APP_KEY and has no host, credential or Supabase values.

## Self-Check: PASSED

- FOUND: .env.test, tests/functional/grades.spec.ts, tests/bootstrap.ts
- ABSENT (as intended): tests/functional/grades.spec.ts.skip
- FOUND commits: 4c5a42f, e3dbad7, 0c41acf, 182fc16
