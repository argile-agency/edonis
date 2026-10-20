---
phase: 02-security-correctness-hardening
plan: 16
subsystem: authorization
tags: [cr-03, courses, policy, information-disclosure, gap-closure]
status: complete
requires: [02-15]
provides:
  - "courses.show sends the module/content tree only to edit-rights holders"
  - "CoursePolicy.view requires a published course (or staff permission / enrolment) on public courses"
affects: [courses.show, enrollments.show (via viewEnrollmentPage)]
tech-stack:
  added: []
  patterns: ["load relations after authorization, only for the role that renders them"]
key-files:
  created:
    - tests/functional/courses_show.spec.ts
  modified:
    - app/controllers/courses_controller.ts
    - app/policies/course_policy.ts
    - tests/functional/authorization.spec.ts
    - tests/functional/enrollments_show.spec.ts
decisions:
  - "Module tree recipients = canEdit only (owner, edit/manage co-instructors, admins); enrolled students get modules: []"
  - "CoursePolicy.view: public+published for everyone; draft/archived public only for view-permission holders and enrolled users; no widening of private/unlisted"
  - "Task 3: user APPROVED the view narrowing (\"Approved.\"); 96cc522 kept"
metrics:
  completed: 2026-10-20
  tasks_done: 3
  tasks_total: 3
requirements: [DEBT-04]
---

# Phase 02 Plan 16: CR-03 course tree leak and unpublished public course visibility Summary

`GET /courses/:id` now loads and sends the module/content tree only to editors (owner, edit/manage co-instructors, admins). In a separate commit that can be reverted alone, `CoursePolicy.view` hides draft and archived public courses from users who are neither staff nor enrolled. The user approved that second change at the Task 3 checkpoint, so it stays.

## Status

- Task 1: done, commit `74770ad` `fix(courses): send the module tree only to course editors`
- Task 2: done, commit `96cc522` `fix(policies): hide unpublished public courses from non-staff viewers` (the SHA to revert on reject)
- Task 3 (checkpoint:human-verify): done. Decision: **APPROVED**. User reply: "Approved." Commit `96cc522` is kept; no revert, and no new test run was needed (functional 190/190 and unit 28/28 were already green on this tree).

3 of 3 tasks complete.

## What changed

- `CoursesController.show`: the `.preload('modules', ...)` block was removed from the initial query. After `authorize('view')` and `canEdit`, the tree is loaded with `course.load('modules', ...)` (same callback) only when `canEdit` is true. The page receives `modules: canEdit ? ... : []`. Bodies, file URLs and external URLs are no longer read from the database for other viewers. They are also gone from `course.serialize()`, which used to carry the preloaded `modules` relation to every viewer.
- `CoursePolicy.view`: returns true for a public published course, then for `hasPermission(user, 'view')`, then for a public course where the user is enrolled. Admins pass via `before`. The cheap synchronous check runs first. `viewAsStaff`, `learn`, `viewEnrollmentPage` and `scopeVisibleCourses` are unchanged. Only one caller exists: `CoursesController.show` (checked with grep), plus `viewEnrollmentPage`, which reuses `view`.

## TDD evidence

- Task 1 RED: on the unchanged code, A (non-enrolled student) and B (enrolled student) failed with `expected [ { id: 1, courseId: 1, ... } ] to deeply equal []`; C and D passed. GREEN: 4/4, plus `authorization_courses.spec.ts`, 15/15 in total.
- Task 2 RED: three failures on the old policy: the policy test (`expected true to be false` on the public draft), courses.show on a public draft (`expected 200 to equal 403`), and enrollments.show on a public draft (`expected 200 to equal 403`). GREEN after the policy change.
- Full suites after Task 2: functional 190/190, unit 28/28 (218 = 209 baseline + 9 new). `typecheck` 0, `eslint` on app/tests/start/inertia/config/database 0, `check:debt` 0.

## Deviations from Plan

1. **Deliberate deviation from the verifier's wording (planner decision, kept).** The module tree is sent only when `canEdit`, because `inertia/pages/courses/show.tsx` renders `modules` only inside the edit tab. The "titles-only outline for non-editors" was dropped on purpose: no page renders it. Enrolled students now get `modules: []` and read material through the AS3-gated outline and learn routes.
2. Task 1 and Task 2 each went in as one `fix(...)` commit, with no separate `test(...)` RED commit, so Task 2 stays revertable alone. RED was checked by running the tests before each change (above).
3. Correction to the checkpoint brief: the seeded draft course (AI301) is `private` and the seeded archived course (SCI201) is `unlisted`. **No seeded course is a public draft or a public archived course.** So the visibility change hides none of the demo courses that were visible before; those two were already blocked for non-staff by `view`. The optional read-only query on the dev database (public courses that are not published) was **not** run, so non-seeded dev data was not checked.

## Known follow-ups (not fixed here)

- (b) A student enrolled in a **private** course gets a 403 on courses.show, yet `enrollWithKey` redirects there after enrolling. This was already true before this plan: `view` has no enrolled exception for private or unlisted courses, and the plan explicitly does not add one.
- (c) The flash-and-redirect-back refusals on a private course closed for enrolment now land on the 403 page. This comes from 02-15's `viewEnrollmentPage` and is unchanged here.
- (d) Instructor PII in `course.serialize()` (CR-01) is still exposed on courses.show and enrollments.show until CR-01 is fixed (T-02-16-05, accepted). Related: `permissions` preloads `user`, so collaborator identities also reach every viewer of courses.show. That belongs with CR-01 too.

## Threat Flags

None. No new surface; T-02-16-01 to 04 are mitigated as planned.

## Self-Check: PASSED

- FOUND: tests/functional/courses_show.spec.ts, app/controllers/courses_controller.ts, app/policies/course_policy.ts
- FOUND commits: 74770ad, 96cc522
