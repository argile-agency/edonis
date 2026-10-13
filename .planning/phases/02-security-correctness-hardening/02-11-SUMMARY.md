---
phase: 02-security-correctness-hardening
plan: 11
subsystem: input validation / courses
tags: [validation, vinejs, mass-assignment, idor, DEBT-05]
requires:
  - "02-01 (withCsrfToken, assertNotCsrfRejected, factories)"
  - "02-04 (courses_controller on CoursePolicy, scopeVisibleCourses)"
provides:
  - "courses_controller.ts passes gate 2: zero request.only/input/all calls"
  - "app/validators/course_admin.ts (courseIndexQueryValidator, rejectCourseValidator, addParticipantValidator)"
  - "app/validators/enrollment_method.ts (createEnrollmentMethodValidator, updateEnrollmentMethodValidator)"
  - "app/validators/course_group.ts (createGroupingValidator, createGroupValidator)"
  - "A9 closed for autoAssignGroupId (create + update) and groupingId"
  - "tests/functional/validation.spec.ts (16 tests)"
affects:
  - "02-14 (addParticipant counter lines left untouched for it)"
  - "02-14 SUMMARY must repeat the Q4 / T-02-53 open decision"
tech-stack:
  added: []
  patterns:
    - "Inertia forms reshape data with form.transform(...) and then post(url)/put(url). The second argument of useForm().post/put is options, not data"
    - "Update actions merge omitUndefined(payload): absent fields are untouched and explicit null clears the column"
    - "A9 lookups run before any write and answer with a French flash plus redirect back"
key-files:
  created:
    - app/validators/course_admin.ts
    - app/validators/enrollment_method.ts
    - app/validators/course_group.ts
    - tests/functional/validation.spec.ts
  modified:
    - app/validators/course.ts
    - app/controllers/courses_controller.ts
    - inertia/pages/courses/create.tsx
    - inertia/pages/courses/edit.tsx
    - inertia/pages/admin/courses/settings.tsx
decisions:
  - "courseIndexQueryValidator accepts '' for status and category, because the listing page sends ?search=&status=&category= by default"
  - "rejectCourseValidator.reason is required (minLength 1, maxLength 2000), because the approval-queue dialog cannot submit an empty reason"
  - "addParticipantValidator.userId uses the Lucid exists rule, so an unknown user id is a validation error instead of a foreign-key 500"
  - "Q4 / T-02-53 (teacher can create a course as published) is deferred — pending user decision. createCourseValidator.status is unchanged"
  - "DEBT-05 is not marked complete in REQUIREMENTS.md: it also spans 02-12 and 02-14, which have not run yet"
metrics:
  duration: "~35 min"
  completed: 2026-10-13
  tasks: 3
  files: 9
---

# Phase 2 Plan 11: Courses controller input validation (DEBT-05) Summary

Every input-reading action in `courses_controller.ts` now goes through `request.validateUsing()`. The course create, edit and admin-settings forms now send what their validators expect:
- `categoryId` is a number or null.
- `tags` is an array.

Enrollment methods and groups can no longer reference another course's group or grouping (A9).

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `6582310` | fix(courses): align course validators with form payloads and validate admin inputs |
| 2 | `d32811c` | fix(courses): validate enrollment method and group input and scope referenced ids to the course |
| 3 | `0189011` | test(courses): cover course input validation and form contracts |

## Open decision for the user

**Q4 / T-02-53: deferred — pending user decision. It is NOT accepted.**

> Should non-admin course creation be forced to `draft` (approval required), or may teachers keep publishing directly?

Today `createCourseValidator.status` accepts `draft | published | archived` from any caller with the `teacher` role. A teacher can therefore create a course directly as `published` and skip the approval workflow. This plan did not change validator or controller behaviour for `status`: `git diff 074f1a7 -- app/validators/course.ts` touches only the two `category` lines. Plan 02-14's SUMMARY must repeat this question in its out-of-scope list.

## What changed

**Validators**
- `course.ts`: `category: vine.string()` became `categoryId: vine.number().positive().optional().nullable()` in both create and update. `category` is not a `Course` column, so `Course.create` used to throw whenever a category was picked.
- `course_admin.ts` (new): the index query string, the reject reason, and the add-participant fields (`userId` exists, `courseRole` enum).
- `enrollment_method.ts` (new): explicit field list with enums and bounds. `methodType` is required on create and absent on update. Fields that are not listed, such as `currentEnrollments`, are dropped.
- `course_group.ts` (new): `name` is required, so a missing name is no longer a NOT NULL 500.

**Controller**
- `index`: validated filters. The category filter applies only when the value is `\d+`. The `await scopeVisibleCourses(query, user)` call is unchanged.
- `rejectCourse`, `addParticipant`, `updateSettings`: validated. The dead `request.input('tags')` block is gone. The `addParticipant` counter lines are left for 02-14.
- `createEnrollmentMethod` / `updateEnrollmentMethod`:
  - `autoAssignGroupId` must belong to the course. The update checks against `method.courseId`, not the URL id.
  - Dates are converted with a `toDateTime` helper.
  - The update merges only the fields that are present.
- `createGroup`: `groupingId` must belong to the course.
- `create` / `edit`: now pass `categories: {id, name}[]`, so the forms can offer real category ids.

**Forms**
- `create.tsx` and `edit.tsx`:
  - The category Select is built from the `categories` prop (it used to be hard-coded label strings).
  - The submit path uses `transform` plus `post(url)` / `put(url)`.
  - `categoryId` is a number or null, and `tags` is split into an array.
- `settings.tsx`: `form.transform` splits `tags` (`split(',')`, trim, filter) and sends `categoryId` as a number or null.

## Enum / contract adjustments (as the plan asked)

- **Index `status`:** `['', 'all', 'draft', 'published', 'archived']`. The plan's list plus `''`, because `inertia/pages/courses/index.tsx` sends `status=''` on a plain "Rechercher". Query strings are never converted to null, and `vine.enum` rejects `''`.
- **Index `category`:** regex `^(all|\d+)?$`. The plan's regex plus `''`, because the page sends `category=''` when "Toutes les catégories" is selected.
- **`reason`:** required. The plan's default is kept, since the dialog disables submit while the reason is empty.

## Verification

- Gate 2: `grep -c "request\.\(only\|input\|all\)(" app/controllers/courses_controller.ts` returns `0`.
- `where('course_id'` count in the controller: 3 before, 5 after.
- Full functional suite: `PORT=3411 DB_FILENAME=./tmp/test-02-11.sqlite3 node ace test functional` passed 90 of 90.
  - Vite logged `Port 24678 is already in use` from another process. It was harmless and the suite still passed.
- `authorization_courses.spec.ts` (02-04): green after Task 1 and after Task 2.
- `bun run typecheck` and `bun run lint` exit 0 (the lint exit code was measured after the last change).
- No other consumer of the narrowed course contract:
  - `createCourseValidator` / `updateCourseValidator` are used only in `courses_controller.ts`.
  - No browser spec selects the old hard-coded category options.
- `validation.spec.ts` gates:
  - 13 `withCsrfToken()` for 13 `client.<verb>(` writes.
  - 0 `assertStatus(500)`.
  - 8 `inputErrorsBag.` assertions.
  - no Vite manifest written.
- **Isolation preconditions confirmed:**
  - `@japa/api-client` derives its base URL from `process.env.HOST` / `process.env.PORT` (`build/index.js:659-660`).
  - `config/database.ts` reads `DB_FILENAME` (line 38).
- **Inertia validation flash:** `renderValidationErrorAsHTML` (session macro) flashes `inputErrorsBag` and redirects back for Inertia GETs as well. The V14 malformed test confirms it.

## TDD Gate Compliance

Task 3 is `tdd="true"`, but the plan orders the implementation (Tasks 1-2) before the spec, so the spec passed on its first run against the new code. To show the tests are not vacuous, the spec was also run against the pre-plan `courses_controller.ts` and `course.ts` (restored from `074f1a7` temporarily, then put back):
- 12 of 16 tests failed: every V1-V7 / V14 negative case, both A9 cases, the V7 settings contract and the create contract.
- The 4 that passed are positive regression guards: the valid self method, a group in its own grouping, the numeric category filter and the empty default filters.

There is no separate `test(...)` commit before the `fix(...)` commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inertia forms never sent their transformed payload**
- **Found during:** Task 1.
- **Issue:** `create.tsx` called `post('/courses', payload)` and `edit.tsx` called `put(url, payload)`. In Inertia's `useForm`, the second argument is options, so the raw form was sent and `tags` arrived as a comma string. The validator rejected it.
- **Fix:** `transform(...)` then `post(url)` / `put(url)`.
- **Files modified:** `inertia/pages/courses/create.tsx`, `inertia/pages/courses/edit.tsx`.
- **Commit:** `6582310`.

**2. [Rule 3 - Blocking] The create and edit forms had no category ids to send**
- **Found during:** Task 1.
- **Issue:** Both Selects offered hard-coded labels ("Computer Science", ...), and `create()` / `edit()` passed no categories. A numeric `categoryId` could never be selected.
- **Fix:** `create()` and `edit()` pass `categories: {id, name}[]`, and the Selects render from that prop.
- **Files modified:** `courses_controller.ts`, `create.tsx`, `edit.tsx`.
- **Commit:** `6582310`.

**3. [Rule 1 - Bug] edit.tsx would silently drop the category after the validator change**
- **Found during:** Task 1.
- **Issue:** `edit.tsx` is not in `files_modified`, but it posts to `updateCourseValidator`. Once `category` was removed, VineJS would strip the field (T-02-52).
- **Fix:** `edit.tsx` gets the same `categoryId` / `tags` contract as `create.tsx`. No parallel plan touches `edit.tsx`; this was checked against the 02-12, 02-13 and 02-14 `files_modified` lists.
- **Commit:** `6582310`.

**4. [Rule 2 - Missing validation] Unknown participant id**
- **Found during:** Task 1.
- **Issue:** `addParticipantValidator.userId` has the Lucid `exists({ table: 'users', column: 'id' })` rule, so a numeric but unknown id is a 302 with `inputErrorsBag.userId` instead of a foreign-key 500.
- **Test:** `V6: an unknown participant id ...`.
- **Commit:** `6582310`.

**5. [Rule 2] Extra tests beyond the plan's list**
- **Added:**
  - V2/A9: an update cannot point at another course's group.
  - V4: a group in its own grouping is created with typed values.
  - V6: unknown user id.
  - V14: the page's default empty filters return 200.
- **Total:** 16 tests (the plan asked for at least 11).
- **Commit:** `0189011`.

## Deferred Issues (out of scope, not fixed)

- **Wrong page names (pre-existing):** `manageEnrollmentMethods` renders `courses/enrollment-methods` and `manageGroups` renders `courses/groups`. The pages actually live at `inertia/pages/courses/enrollment/methods.tsx` and `inertia/pages/courses/enrollment/groups.tsx`, so both GET pages probably fail to resolve their component. The write routes covered here are not affected.
  - This is recorded here rather than in a shared `deferred-items.md`, to avoid add/add merge conflicts between the parallel worktrees.
- **Frontend type errors (pre-existing):** `npx tsc -p inertia/tsconfig.json` reports 205 errors. `bun run typecheck` only checks the backend. None of the 205 are in the files this plan touched.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or trust boundary. The `create` / `edit` pages now also receive category `{id, name}` pairs, which the listing page already exposes.

## Self-Check: PASSED

- **Files exist** (confirmed by `git diff --name-only 074f1a7 HEAD`):
  - `app/validators/course_admin.ts`, `app/validators/enrollment_method.ts` and `app/validators/course_group.ts`
  - `tests/functional/validation.spec.ts`
  - this SUMMARY
  - the modified `course.ts`, `courses_controller.ts`, `create.tsx`, `edit.tsx` and `settings.tsx`
- **Commits exist on the branch** (confirmed by `git log 074f1a7..HEAD`): `6582310`, `d32811c`, `0189011`, `a5339df`.
