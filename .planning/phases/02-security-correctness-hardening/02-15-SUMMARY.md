---
phase: 02-security-correctness-hardening
plan: 15
subsystem: enrollments
status: complete
gap_closure: true
tags: [enrollments, authorization, information-disclosure, CR-02, DEBT-04]
requires:
  - 02-05 (AS4 CoursePolicy.enroll / course.canEnroll)
  - 02-14 (check:debt gate)
provides:
  - enrollmentKey hidden from default CourseEnrollmentMethod serialization (serializeAs null)
  - learner-facing whitelist toLearnerMethod on the enrolment page
  - CoursePolicy.viewEnrollmentPage (canEnroll OR view) applied in EnrollmentsController.show
affects:
  - app/models/course_enrollment_method.ts
  - app/controllers/enrollments_controller.ts
  - app/controllers/courses_controller.ts
  - app/policies/course_policy.ts
  - inertia/pages/enrollments/show.tsx
tech-stack:
  added: []
  patterns:
    - "explicit learner-facing field whitelist instead of model.serialize() for props shown to non-staff"
    - "secret columns use @column({ serializeAs: null }); the manage-authorized page adds the field back explicitly"
key-files:
  created:
    - tests/functional/enrollments_show.spec.ts
  modified:
    - app/models/course_enrollment_method.ts
    - app/controllers/enrollments_controller.ts
    - app/controllers/courses_controller.ts
    - app/policies/course_policy.ts
    - inertia/pages/enrollments/show.tsx
decisions:
  - "viewEnrollmentPage = course.canEnroll() || view: private/unlisted courses open for enrolment stay reachable by shared link"
  - "enrollments.show uses authorize (403 page), not flash+redirect, because it is a GET page"
  - "toLearnerMethod normalizes isEnabled with Boolean() so the prop is a real boolean on SQLite/MySQL too"
metrics:
  duration: ~20min
  completed: 2026-10-20
---

# Phase 02 Plan 15: Close CR-02 (enrolment key leak) Summary

The enrolment page no longer sends the plaintext enrolment key to learners: methods go through a learner-facing whitelist, the model hides `enrollmentKey` from `serialize()`, the manager page adds it back explicitly, and `GET /courses/:id/enroll` is now gated by `CoursePolicy.viewEnrollmentPage`.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Never serialize the enrolment key to learners | 32940f6 | course_enrollment_method.ts, enrollments_controller.ts, courses_controller.ts, enrollments/show.tsx, enrollments_show.spec.ts |
| 2 | Authorize enrollments.show through CoursePolicy.viewEnrollmentPage | 66f3a4d | course_policy.ts, enrollments_controller.ts, enrollments_show.spec.ts |

## TDD evidence

- Task 1 RED (before implementation): Test A failed at `assert.notInclude(serialized, sentinel)` (the sentinel key was in the props); Test B failed with `AssertionError: expected undefined to be true` on `requiresKey`. Test C (manager positive control) passed before and after, as expected.
- Task 2 RED: Test D failed with `AssertionError: expected 200 to equal 403`. E, F, G passed before (they describe flows that must keep working).
- GREEN: 7/7 in the new spec; full unit + functional run 209/209 (202 baseline + 7 new).
- Each task is one commit containing tests and implementation (no separate RED commit), as the plan requires ("Commit alone").

## Verification

- All tests ran from the worktree, not the main checkout as the plan's verify command says (`cd .../edonis` would have tested the main checkout's code). Each run used `DB_CONNECTION=sqlite`, its own PORT (3415-3417) and a temp sqlite file that was deleted afterwards.
- `bun run typecheck` 0, `bun run lint` 0, `bun run check:debt` 0.
- `serializeAs: null` consumers: the only frontend reader of `enrollmentKey` is `inertia/pages/courses/enrollment/methods.tsx`, which gets its props only from `manageEnrollmentMethods`, where the key is now added back explicitly (Test C). No other controller serializes enrolment methods. No browser spec (`tests/browser`) opens `/courses/:id/enroll`, so the new 403 breaks no E2E flow. E2E was not run locally.
- Acceptance greps: serializeAs null on enrollmentKey = 1; `method.serialize()` in enrollments_controller = 0; `toLearnerMethod` = 2; `enrollmentKey: m.enrollmentKey` = 1; `enrollmentKey: string` in show.tsx = 0; `viewEnrollmentPage` in policy = 1; `authorize('viewEnrollmentPage', course)` = 1; `bouncer.with(` in enrollments_controller = 5.

## Deviations from Plan

**1. [Rule 1 - Bug] isEnabled normalized to boolean in the whitelist**
- **Found during:** Task 1 GREEN
- **Issue:** SQLite returns `1` for `is_enabled`, so Test B's `isEnabled === true` failed even though the page's truthiness check works. The TS interface declares `boolean`.
- **Fix:** `isEnabled: Boolean(method.isEnabled)` in `toLearnerMethod`, so the prop is the same on all three CI engines.
- **Commit:** 32940f6

**2. [Rule 1 - Type accuracy] Dropped unsent fields from the page interface**
- **Found during:** Task 1
- **Issue:** The plan removed only `enrollmentKey` from the `EnrollmentMethod` interface in `inertia/pages/enrollments/show.tsx`. `requiresApproval` and `autoAssignGroupId` were also declared, but the whitelist does not send them and no JSX reads them.
- **Fix:** Removed both lines so the interface matches the props. `autoAssignGroup?` stays: the JSX reads it, but `show` never preloaded it, so it was already always undefined. No JSX change.
- **Commit:** 32940f6

## Known limitations (must read)

- **(a) CR-01 still open:** the enrolment page still sends `course.serialize()`, which includes instructor PII. Any logged-in user can read it for published open courses (and for any public course) until CR-01 is fixed. This plan does not address it.
- **(b) Refusals on a closed private course now land on 403:** the AS4 POST actions (`enrollWithKey`, `enrollSelf`) flash an error and redirect back to the enrolment page. For a private course that is closed for enrolment, `viewEnrollmentPage` now refuses that page, so the user ends up on the 403 page instead of seeing the flash.
- **(c) Pre-existing: 403 after a successful key enrolment on a private course.** After enrolling, the redirect goes to `courses.show`, which `CoursePolicy.view` gates. `view` has no exception for enrolled users, so it returns 403. This is not introduced here.
- **`requestEnrollment` still has no policy call** (out of scope for this plan). It is the only EnrollmentsController action without `bouncer.with(`.

## Threat Flags

None. No new surface: the change narrows an existing GET and its props.

## Self-Check: PASSED

- FOUND: tests/functional/enrollments_show.spec.ts (168 lines)
- FOUND: commit 32940f6
- FOUND: commit 66f3a4d
