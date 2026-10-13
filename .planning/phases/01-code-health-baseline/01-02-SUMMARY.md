---
phase: 01-code-health-baseline
plan: 02
subsystem: courses
tags: [bugfix, luxon, enrollment, unit-tests, debt-02]
status: complete
requires: []
provides:
  - "Course.canEnroll() enforces its start/end date window"
  - "tests/unit/ suite (first unit tests in the repo)"
affects:
  - "Course.serialize() -> canEnroll prop on courses/index and courses/show"
tech-stack:
  added: []
  patterns:
    - "Unit tests build Lucid models in memory (new Course()), no DB"
key-files:
  created:
    - tests/unit/course.spec.ts
  modified:
    - app/models/course.ts
decisions:
  - "Compare Luxon DateTime values directly (this.startDate > now) instead of DateTime.fromJSDate(x as any)"
  - "Fix commit uses a single-line subject (CLAUDE.md / user preference) instead of the plan's multi-line body"
metrics:
  tasks_completed: 2
  tasks_total: 2
  completed: 2026-10-13
---

# Phase 01 Plan 02: canEnroll() date-window fix

`Course.canEnroll()` now compares Luxon `DateTime` values directly. Previously it called `DateTime.fromJSDate()` on a value that was already a Luxon `DateTime`. That returns an invalid DateTime whose `valueOf()` is `NaN`, so both date guards always evaluated `false` and the enrollment window was never enforced. Five in-memory unit tests now cover this.

**Status:** Complete. Task 1 is done and committed. Task 2 (the blocking human checkpoint) was **approved by the operator on 2026-10-13** (no end-date-inclusive follow-up requested).

## Tasks

| Task | Name | Status | Commit |
| ---- | ---- | ------ | ------ |
| 1 | Prove the bug with a unit test, then fix canEnroll() | done | `194dd28` |
| 2 | Pre-merge data check: how many courses lose eligibility | approved 2026-10-13 | n/a |

## RED (before the course.ts edit), verbatim, ANSI stripped, stack frames trimmed

`node ace test unit` exited with code 1:

```
unit / Course.canEnroll - date window (tests/unit/course.spec.ts)
  ✖ refuses enrollment when startDate is in the future (3.68ms)
  ✖ refuses enrollment when endDate is in the past (0.35ms)
  ✔ allows enrollment inside the date window (0.27ms)
  ✔ allows enrollment when both dates are null (0.09ms)
  ✔ refuses enrollment when allowEnrollment is false, even inside the window (0.14ms)
 ERRORS

❯ Course.canEnroll - date window / refuses enrollment when startDate is in the future
- Expected  - 1
+ Received  + 1
- false
+ true
ℹ AssertionError: expected true to be false
 ❯ 30 ┃      assert.isFalse(course.canEnroll())
[1/2]─

❯ Course.canEnroll - date window / refuses enrollment when endDate is in the past
- Expected  - 1
+ Received  + 1
- false
+ true
ℹ AssertionError: expected true to be false
 ❯ 39 ┃      assert.isFalse(course.canEnroll())
[2/2]─

 FAILED
Tests  3 passed, 2 failed (5)
```

## GREEN (after the course.ts edit)

`node ace test unit` exited with code 0:

```
unit / Course.canEnroll - date window (tests/unit/course.spec.ts)
  ✔ refuses enrollment when startDate is in the future (3.57ms)
  ✔ refuses enrollment when endDate is in the past (0.29ms)
  ✔ allows enrollment inside the date window (0.3ms)
  ✔ allows enrollment when both dates are null (0.09ms)
  ✔ refuses enrollment when allowEnrollment is false, even inside the window (0.15ms)
 PASSED
Tests  5 passed (5)
```

## Task 1 verification (run in the worktree)

- `bun run typecheck`: exit 0
- `bun run lint`: exit 0 (after running prettier on the new spec)
- `grep -c "as any" app/models/course.ts`: 0
- `grep -c "DateTime.fromJSDate" app/models/course.ts`: 0
- `course.ts` contains `this.startDate > now` and `this.endDate < now`
- No `as never`, `as unknown as`, `@ts-expect-error` or `eslint-disable` in either file
- The spec contains no `Course.create(`, `testUtils` or `db.`
- Commit `194dd28` touches exactly `app/models/course.ts` and `tests/unit/course.spec.ts`. The `tags` block and `serialize()` are unchanged.

## Task 2: data check (read-only, automated by executor)

I ran these against the **development** DB from `.env` (Postgres, `localhost:54322`) inside a `BEGIN READ ONLY` transaction that was rolled back. There is no `psql` on the machine, so I used node and `pg`. DB `now()` was 2026-10-09T22:58Z. **Production was not queried** because I have no access to it.

- `SELECT count(*) FROM courses WHERE start_date > now() OR end_date < now();` returned **6**, out of 6 total rows.
- Of those, the courses that are published with enrollment open (the ones that actually flip from enrollable to refused):

| id | code | title | start_date | end_date |
| -- | ---- | ----- | ---------- | -------- |
| 12 | CS101 | Introduction à la Programmation | 2025-10-18 | 2026-01-16 |
| 13 | WEB201 | Développement Web Moderne | 2025-11-02 | 2026-01-31 |
| 16 | BUS101 | Fondamentaux du Marketing Digital | 2025-11-12 | 2026-02-10 |
| 14 | MATH101 | Mathématiques pour Data Science | 2025-11-17 | 2026-02-15 |

That is 4 of the 4 published courses. The other two (AI301 draft, SCI201 archived) were already refused by the status/allowEnrollment guard.

### Things the operator should know

1. **Stale seed data, not real courses.** `database/seeders/course_seeder.ts` sets dates relative to `DateTime.now()` at seed time. The dev DB was seeded around Nov 2025, so every window has since expired. Re-seeding (or a data fix) brings them back into a window. Any long-lived demo environment seeded the same way (for example demo.edonis.org) will likely show **every published course as non-enrollable**. Production was not checked.
2. **Actual consumer impact is currently nil.** `canEnroll` is declared in the prop interfaces of `inertia/pages/courses/index.tsx:45` and `show.tsx:122`, but nothing renders or branches on it. No controller or service calls `course.canEnroll()` as a server-side gate either. (`CourseEnrollmentMethod.canEnroll()` is a separate method.) The fix changes the serialized prop value only. It does not block any enroll button or route today. This contradicts the plan's statement that the change is "directly user-visible".
3. **End date is exclusive.** `@column.date()` loads as local midnight, so a course whose `end_date` is today is already refused from 00:00 that day. The plan's note only covers the start-today case. SQL `end_date < now()` behaves the same way, so the count above is consistent. No dev rows end today. The operator should accept "end_date is exclusive" or schedule a follow-up (for example `this.endDate.endOf('day') < now`).

## Deviations from Plan

**1. [CLAUDE.md] Commit message is a single line, with no body**
- **Plan asked for:** a multi-line `fix(courses):` body mentioning `fromJSDate` and the behaviour change.
- **Done instead:** `fix(courses): enforce canEnroll date window (fromJSDate on a Luxon DateTime was always invalid)`, because CLAUDE.md, the user's memory and the orchestrator all require brief single-line commits with no Co-Authored-By trailer. The criterion `%b contains fromJSDate` is intentionally unmet. `fromJSDate` is in the subject, and the full explanation is in the release note below.

**2. [Rule 3] Prettier formatting of the new spec**
- `bun run lint` flagged one prettier/prettier error in the new spec, which was fixed before commit.

**3. [Orchestration] Verify command run in the worktree, not the main checkout**
- The plan's `<verify>` command `cd`s into the main checkout. The same checks were run inside the worktree instead.

## Release Note (for whoever ships Phase 1)

> `Course.canEnroll()` has never enforced its start/end date window, because `DateTime.fromJSDate()` returns an invalid DateTime when given a Luxon `DateTime`. After this change, courses with a future `start_date` or a past `end_date` will report `canEnroll: false`. On the dev DB this affects **6 / 6** courses (4 published and enrollment-open), all because the seed data is stale. **Row count:** 6 (dev). Operator approval: **approved 2026-10-13**.

## Known Stubs

None.

## Self-Check

- `tests/unit/course.spec.ts`: FOUND
- `app/models/course.ts` fix: FOUND
- commit `194dd28`: FOUND
- Task 2 approval: APPROVED 2026-10-13 (operator)
