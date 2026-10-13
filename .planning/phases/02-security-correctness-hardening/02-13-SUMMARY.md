---
phase: 02-security-correctness-hardening
plan: 13
subsystem: enrollments
tags: [enrollments, counters, transactions, concurrency, audit, ace-command, DEBT-06]
requires:
  - 02-05 (enrollments_controller policies, validation, AS4 canEnroll)
  - 02-01 (withCsrfToken / assertNotCsrfRejected)
provides:
  - EnrollmentService.enroll / unenroll / recount / tryIncrementMethod / tryIncrementGroup
  - isUniqueViolation (pg / mysql / sqlite)
  - CapacityReachedException, AlreadyEnrolledException
  - node ace enrollment:recount [--dry-run]
affects:
  - app/controllers/enrollments_controller.ts (enrollWithKey, enrollSelf, enrollManual, unenroll)
  - 02-14 (addParticipant / removeParticipant should call the same service)
tech-stack:
  added: []
  patterns:
    - "db.transaction + single conditional UPDATE ... SET x = x + 1 WHERE (max IS NULL OR x < max), checking the affected-row count"
    - "unique-constraint violation caught outside the transaction callback (PG abort semantics)"
    - "audit rows written after the recount transaction commits"
key-files:
  created:
    - app/services/enrollment_service.ts
    - app/helpers/db_errors.ts
    - app/exceptions/capacity_reached_exception.ts
    - app/exceptions/already_enrolled_exception.ts
    - commands/enrollment_recount.ts
    - tests/functional/enrollment_counters.spec.ts
  modified:
    - app/controllers/enrollments_controller.ts
decisions:
  - "Enrolment counters move only through EnrollmentService: one transaction per enrolment, with a conditional atomic increment and an affected-row check (no row locks; portable to SQLite)"
  - "enroll() skips the group step when a membership already exists, so re-enrolling after an unenrol (which keeps memberships until AS5) does not hit unique(group_id,user_id)"
  - "unenroll() decrements counters only when its own DELETE removed the row, so a concurrent double unenrol decrements once"
  - "Manual enrolment with a method now goes through the method capacity guard; over capacity is reported per user as 'Capacité atteinte pour l'utilisateur N'"
metrics:
  duration: ~45min
  completed: 2026-10-13
  tasks: 2
  files: 7
---

# Phase 2 Plan 13: Transactional enrolment counters Summary

Each enrolment now runs in its own `db.transaction`, and the capacity check is part of the counter UPDATE itself (`... WHERE max IS NULL OR current < max`, then check the affected-row count). That means `courses.enrolled_count`, `course_enrollment_methods.current_enrollments` and `course_groups.current_members` can no longer over-fill or drift through enrol and unenrol. The `unique(course_id, user_id)` constraint now catches duplicates, shown as a clean "déjà inscrit" flash on every engine. A new `node ace enrollment:recount [--dry-run]` command repairs past drift and writes an audit row for each fix.

## What was built

**Task 1: EnrollmentService** (commits `549c8f8` RED, `6b78edc` GREEN)
- `tryIncrementMethod` / `tryIncrementGroup` run a single conditional `increment` and return the raw affected-row count.
- `enroll()`, inside `db.transaction`:
  - takes a method seat, throwing `CapacityReachedException` when the method is full
  - creates the enrolment row
  - increments `enrolled_count`
  - adds the group membership only if the group has room and the user is not already a member
- A unique violation is caught *outside* the transaction callback and mapped to `AlreadyEnrolledException`.
- `unenroll()`: inside a transaction, deletes the enrolment row. If its own DELETE removed the row, it decrements the course counter and the method counter, each guarded with `> 0`. Group memberships are deliberately untouched (AS5, plan 02-14).
- `recount({ dryRun })`: grouped `COUNT(*)` for each of the three counters. Rows with no source rows count as 0, and all values are normalised with `Number()`. Updates run in one transaction. After commit, one `cli.enrollment.recount` audit row is written per change (`resource_type` = table name, metadata `{ column, stored, actual }`). A dry run writes nothing.
- `isUniqueViolation` recognises PG `23505`, MySQL `ER_DUP_ENTRY` / errno 1062, SQLite `SQLITE_CONSTRAINT_UNIQUE`, and `SQLITE_CONSTRAINT` with "UNIQUE" in the message.

**Task 2: controller rewiring and command** (commits `fbf3745` RED, `fa373bd` fix, `bc5abee` command)
- `enrollWithKey` / `enrollSelf`: the existing UX pre-checks are kept (`isAvailable`, method type, key, AS4). The "already enrolled" pre-query is gone. They now call `EnrollmentService.enroll` through a small `enrollmentRefusal()` helper that maps the two exceptions to the existing French flashes.
- `enrollManual`: one `EnrollmentService.enroll` call (one transaction) per user. Each failure is reported per user: "est déjà inscrit", "Capacité atteinte pour l'utilisateur N" or "Erreur pour l'utilisateur N". The post-loop counter block is removed.
- `unenroll`: the policy check is unchanged, then `EnrollmentService.unenroll(enrollment)`.
- `commands/enrollment_recount.ts` prints `table#id column stored→actual`, the total, and `audited N change(s) as cli.enrollment.recount`.

## Verification

- `enrollment_counters.spec.ts`:
  - 9 service invariant tests: capacity, raw affected rows 0/1, duplicate, group auto-assign, re-enrol after unenrol, unenrol decrements, never negative, recount dry and real runs with audit rows, `isUniqueViolation`
  - 4 HTTP tests: capacity flash, duplicate flash on an unlimited method, manual partial success, unenrol decrements
- `enrollments_access.spec.ts` (02-05): all 16 tests still pass.
- Full functional suite (`PORT=3413 DB_FILENAME=./tmp/test-02-13.sqlite3 node ace test functional`): **87 passed**.
- `bun run typecheck` and `bun run lint` exit 0.
- Grep gates:
  - `enrollment_service.ts`: 4× `db.transaction`, 0× `forUpdate`, 1× each `orWhereRaw` capacity clause, 0× `+=`, 0× `as any`
  - controller: 0 read-modify-write counter lines, 4× `EnrollmentService.`, 2× `denies('enroll'`
  - spec: `withCsrfToken()` 6 ≥ write calls 6, `maxEnrollments: null` 6
- `node ace list` shows `enrollment:recount`, and `--help` lists `--dry-run`.
- Test isolation: the api client honours `process.env.PORT`, and `config/database.ts` reads `DB_FILENAME`. Every run logged "WebSocket server error: Port 24678 is already in use" (the user's dev server holds the Vite HMR port), but the suites still ran and passed, so runs did not need to be serialised.
- CI matrix (pg/mysql/sqlite): this plan's tests are the engine proof of AS7 (raw affected-row count is a number) and of unique-violation detection. No CI run URL yet; the orchestrator should record it after merge. Locally, SQLite passes all of them. The PostgreSQL dev DB ran the recount grouped-count queries (output below).

### AS4

AS4 was present (`denies('enroll'` ×2, in `enrollWithKey` and `enrollSelf`) and is preserved unchanged, along with the `Course.findOrFail` it uses.

### Dev DB `node ace enrollment:recount --dry-run` (local PostgreSQL, read-only)

```
[ info ] courses#12 enrolled_count 35→2
[ info ] courses#13 enrolled_count 28→2
[ info ] courses#14 enrolled_count 42→2
[ info ] courses#15 enrolled_count 0→1
[ info ] courses#16 enrolled_count 57→3
[ info ] courses#17 enrolled_count 19→1
[ info ] 6 counter(s) differ (dry run, nothing written)
```

## RELEASE NOTE

The enrolment counters have drifted:
- unenrol never decremented `current_enrollments`
- the seeders write fake `enrolled_count` values (35/28/42/55/18)

After deploying, run these in **each environment** (the deploy pipeline does not run ace commands):

```
node ace enrollment:recount --dry-run
node ace enrollment:recount
```

This changes the displayed demo enrolment numbers to the real counts. Every rewritten counter is audited as `cli.enrollment.recount`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-enrolling after an unenrol would fail as "already enrolled" when the method auto-assigns a group**
- **Found during:** Task 1 design
- **Issue:** `unenroll` keeps group memberships (AS5 is deferred to 02-14). Re-enrolling through a method with `autoAssignGroupId` would hit `unique(group_id, user_id)`. `isUniqueViolation` would then map that to `AlreadyEnrolledException`, rolling back an enrolment the user is entitled to.
- **Fix:** before the conditional group increment, `enroll()` checks for an existing membership inside the transaction and skips both the increment and the insert if one exists. Covered by the test "re-enrolling after unenrol does not collide with the kept group membership".
- **Files:** `app/services/enrollment_service.ts`
- **Commit:** `6b78edc`

**2. [Rule 1 - Bug] Double unenrol could double-decrement**
- **Fix:** `unenroll()` deletes with a query and decrements only when that DELETE removed a row.
- **Commit:** `6b78edc`

**3. [Rule 3 - Blocking] No `#helpers/*` subpath import exists**
- `db_errors.ts` is imported relatively (`../helpers/db_errors.js`), matching the existing `json_column` and `category_tree` imports. `package.json` is unchanged.

**4. Robust affected-row comparison**
- `tryIncrementMethod` returns the raw value, so the spec's `strictEqual(…, 0/1)` proves AS7. `enroll()` compares `Number(seat) < 1`, so an unexpected driver return type can never let an over-capacity enrolment through.

### Behaviour notes (intended by the plan)

- `enrollSelf` now passes `method.autoAssignGroupId`, so self-enrolment auto-assigns a group, like key enrolment already did. Before, only `enrollWithKey` did this.
- Manual enrolment with a method now goes through the method capacity guard, and the method counter is incremented per user inside the transaction.

## Known Stubs

None.

## TDD Gate Compliance

- Task 1: RED `549c8f8` (`test(...)`), then GREEN `6b78edc` (`feat(...)`).
- Task 2: RED `fbf3745` (`test(...)`, where only the unenrol-decrement test failed). Every other HTTP behaviour already held through the old pre-checks; the tests guard against regressions. GREEN `fa373bd` (`fix(...)`), plus `bc5abee` for the command.

## Self-Check: PASSED

All 6 created files exist; commits 549c8f8, 6b78edc, fbf3745, fa373bd, bc5abee are on the branch.

## Requirement status

DEBT-06 stays open in REQUIREMENTS.md: plan 02-14 also lists it, and `courses_controller.ts` `addParticipant`/`removeParticipant` still do read-modify-write counter updates until 02-14 routes them through EnrollmentService.

## Coverage note

Run serially, the HTTP capacity test is answered by the retained `isAvailable()` pre-check. The controller mapping from `CapacityReachedException` to the flash only fires under a real race. The service tests cover the exception itself; no HTTP test exercises that mapping.
