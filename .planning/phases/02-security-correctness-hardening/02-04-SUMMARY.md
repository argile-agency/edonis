---
phase: 02-security-correctness-hardening
plan: 04
subsystem: security / course authorization
tags: [authorization, bouncer, policies, idor, DEBT-04]
requires:
  - "02-01 (CoursePolicy, scopeVisibleCourses, factories, shieldApiClient)"
provides:
  - "courses_controller.ts with every authorization decision routed through CoursePolicy / scopeVisibleCourses"
  - "A4 closed: removePermission scoped to the authorized course"
  - "tests/functional/authorization_courses.spec.ts (11 HTTP-level tests)"
affects:
  - "02-11 / 02-14 (validators and counters in courses_controller are untouched and remain theirs)"
tech-stack:
  added: []
  patterns:
    - "authorize-then-scoped-lookup for child rows: load parent, authorize, then query child with where('course_id', parent.id).firstOrFail()"
    - "Write tests split the request into `const req = client.<verb>(url).withCsrfToken()` + `await req...` so the CSRF gate grep survives prettier"
    - "Denial writes use .withInertia() (403/404 come back as Inertia JSON); success writes skip it (Inertia turns 302 into 303 on PUT/PATCH/DELETE)"
key-files:
  created:
    - tests/functional/authorization_courses.spec.ts
  modified:
    - app/controllers/courses_controller.ts
decisions:
  - "removePermission authorizes 'manage' on the course BEFORE the permission lookup, so a non-manager gets 403 without learning whether a permission id exists"
  - "A4 cross-course ids return 404 (scoped firstOrFail), not 403"
  - "DEBT-04 is not marked complete: it also spans 02-01, 02-05, 02-09, 02-10 and 02-14"
metrics:
  duration: "~25 min"
  completed: 2026-10-13
  tasks: 2
  files: 2
---

# Phase 2 Plan 04: Courses controller on CoursePolicy + A4 fix Summary

`courses_controller.ts` now makes no inline authorization decision: 28 role/permission checks are replaced by `bouncer.with('CoursePolicy')` calls and an in-place `scopeVisibleCourses` listing scope. `removePermission` can no longer delete a permission row from another course (IDOR A4).

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (refactor) | `4fe69e6` | refactor(courses): route courses controller authorization through CoursePolicy |
| 1 (A4 fix) | `a857472` | fix(courses): scope permission removal to the authorized course |
| 2 | `1d21783` | test(courses): cover courses routes authorization and A4 regression |

`a857472` touches only `removePermission` (+6/-1), so it can be reverted on its own.

## Action → policy mapping (as applied)

| Action(s) | Policy call |
|---|---|
| `index` | `const query = Course.query().preload('instructor')`, then `await scopeVisibleCourses(query, user)`. The filters chain on `query` with no reassignment (`let` became `const`) |
| `show` | `authorize('view', course)`, then `canEdit = allows('edit')` and `canManage = allows('manage')`. Prop shape unchanged |
| `edit`, `update` | `authorize('edit', course)`. `update` keeps the order findOrFail → authorize → validate |
| `destroy` | `authorize('delete', course)` (owner only, or admin) |
| `publish`, `archive`, `addPermission` | `authorize('manage', course)` |
| `removePermission` | `authorize('manage', course)`, then `CoursePermission.query().where('id', permissionId).where('course_id', course.id).firstOrFail()` |
| `manageEnrollmentMethods`, `createEnrollmentMethod`, `manageGroups`, `createGrouping`, `createGroup` | `authorize('manage', course)` |
| `updateEnrollmentMethod`, `deleteEnrollmentMethod` | `authorize('manage', method.course)` |
| `approvalQueue`, `approveCourse`, `rejectCourse`, `adminIndex`, `showParticipants`, `addParticipant`, `removeParticipant`, `showSettings`, `updateSettings`, `archiveCourse` | `authorize('administer')` (10 sites, defence in depth behind `role: admin`) |

Unused `auth` / `response` destructures and `user` locals were removed. `user` stays in `index`, `show`, `store`, `approveCourse`, `rejectCourse` and `addParticipant`. Validators, `request.only` / `request.input` reads, counter code and flash strings are unchanged.

Behaviour notes:
- **`show`:** this was `if (!canView && visibility !== 'public') forbidden`. `CoursePolicy.view` is `public || hasPermission(view)` and admins pass through `before()`, so the logic is the same.
- **Denials:** they now render `errors/forbidden` (403) through the exception handler, where they used to return plain-text `response.forbidden`. JSON callers still get Bouncer's JSON 403.

## Gates

- `grep -c "hasPermission(\|hasRole(\|instructorId ===\|isInstructor(\|\.roles\.some(\|hasAnyRole(" app/controllers/courses_controller.ts` → 0
- `response.forbidden` → 0. `authorize('administer')` → 10. `await scopeVisibleCourses(query, user)` → 1, and its result is never assigned
- `CoursePermission.findOrFail` → 0
- Spec: `withCsrfToken()` 6 ≥ writes 6. `errors/forbidden` 4. `assertNotCsrfRejected` 4. Banned patterns 0. No Vite manifest created
- `bun run typecheck` and `bun run lint` exit 0
- Full functional suite (`PORT=3404 DB_FILENAME=./tmp/test-02-04.sqlite3 node ace test functional`): **41/41 passed** (this includes 02-01's `authorization.spec.ts`, 12/12). The temp DB was deleted afterwards

## TDD evidence (Task 2, tdd="true")

The A4 fix was committed before the spec, per the plan's task order. To show a real RED, I restored the refactor-commit controller (`git checkout 4fe69e6 -- app/controllers/courses_controller.ts`) and ran the new spec. The A4 test failed with `expected 303 to equal 404`: the cross-course row was deleted and redirected. The other 10 tests passed. With the fixed controller restored (`git checkout HEAD -- ...`), all 11 pass.

## Test isolation

- `@japa/api-client` reads `process.env.HOST` / `PORT`, and `config/database.ts` reads `DB_FILENAME`. `.env.test` is sqlite.
- Every run used `PORT=3404 DB_FILENAME=./tmp/test-02-04.sqlite3`. There were no Vite HMR port conflicts.
- `tests/bootstrap.ts`, `adonisrc.ts`, `.env.test` and `config/shield.ts` were not touched.

## Deviations from Plan

**1. [Rule 3 - Blocking] Write requests split across two statements**
- **Found during:** Task 2
- **Issue:** Prettier (printWidth 100) breaks long one-line `client.delete(...).withCsrfToken()...` chains, which would put `client.<verb>(` on its own line and fail lint.
- **Fix:** Used the `csrf.spec.ts` idiom. Each write builds `const xRequest = client.<verb>(url).withCsrfToken()` on one line, then `await xRequest.loginAs(...).redirects(0)`. The CSRF gate grep still matches 6 of 6.
- **Commit:** `1d21783`

**2. [Rule 3 - Blocking] `.withInertia()` added on denial writes**
- **Found during:** Task 2
- **Issue:** Without `X-Inertia`, the handler's 403/404 page is a full HTML Inertia render, which needs a Vite manifest.
- **Fix:** The denial requests (publish 403, destroy 403, A4 404) chain `.withInertia()` and assert the component (`errors/forbidden` / `errors/not_found`). The success writes deliberately do not, so their 302 is not turned into a 303.
- **Commit:** `1d21783`

Otherwise the plan was executed as written. The spec has 11 tests (the plan asked for at least 9). The listing case was split into 3 tests, and admin-edit and public-show were added as separate tests.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: app/controllers/courses_controller.ts
- FOUND: tests/functional/authorization_courses.spec.ts
- FOUND: 4fe69e6, a857472, 1d21783
