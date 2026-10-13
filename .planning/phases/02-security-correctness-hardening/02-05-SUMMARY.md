---
phase: 02-security-correctness-hardening
plan: 05
subsystem: security / enrolment authorization
tags: [bouncer, policies, vinejs, enrollments, authorization, DEBT-04, DEBT-05, AS4]
requires:
  - phase: 02-01
    provides: "CoursePolicy (manage, enroll), EnrollmentPolicy (unenroll), test factories, shieldApiClient() / .withCsrfToken(), assertNotCsrfRejected"
provides:
  - "app/validators/enrollment.ts: enrollWithKeyValidator, enrollSelfValidator, requestEnrollmentValidator, enrollManualValidator (V9-V12)"
  - "enrollments_controller: enrollManual -> CoursePolicy.manage, unenroll -> EnrollmentPolicy.unenroll (A1 fixed)"
  - "Method / group ids scoped to the course in the URL (A9)"
  - "AS4: enrollSelf / enrollWithKey refuse when CoursePolicy.enroll (course.canEnroll()) denies; admins bypass"
  - "tests/functional/enrollments_access.spec.ts (16 tests, CSRF-tokened writes)"
affects:
  - "02-13 (replaces the enrolment counter read-modify-write lines left untouched here)"
  - "a later plan: stale comment on CoursePolicy.enroll in app/policies/course_policy.ts"
tech-stack:
  added: []
  patterns:
    - "Lookups by client-supplied id are scoped with where('course_id', <url course>) and fail with a flash + redirect back"
    - "UX-preserving policy check: bouncer.with(...).denies(...) -> flash + redirect().back() instead of authorize() -> 403 page"
    - "Behaviour changes ship as isolated, revertable commits behind a human checkpoint"
key-files:
  created:
    - app/validators/enrollment.ts
    - tests/functional/enrollments_access.spec.ts
  modified:
    - app/controllers/enrollments_controller.ts
key-decisions:
  - "AS4 APPROVED by the user: self and key enrolment are refused server-side when course.canEnroll() is false"
  - "requestEnrollment (approval requests) and enrollManual (staff action) are deliberately NOT canEnroll-gated"
  - "AS4 refusal uses flash + redirect back (not a 403 page) to keep the enrolment-page UX"
  - "Enrolment counter lines left byte-identical; atomic counters are plan 02-13's job"
requirements-completed: []
requirements-partial: [DEBT-04, DEBT-05]
metrics:
  duration: "not recorded (Task 1 commit 17:42, Task 2 commit 17:52 +0200) + checkpoint wait"
  completed: 2026-10-13
  tasks: 3
  files: 3
---

# Phase 2 Plan 05: Enrolment Authorization and Validation Summary

**Enrolment controller now routes authorization through CoursePolicy / EnrollmentPolicy (fixing self-unenrolment, which crashed for every caller), validates all four POST bodies with VineJS (V9-V12), scopes method and group ids to the URL's course (A9), and refuses self/key enrolment into courses where `canEnroll()` is false (AS4, user-approved).**

## Performance

- **Duration:** not recorded. The Task 1 commit is at 17:42 and the Task 2 commit at 17:52 (+0200), then came the wait at the Task 3 checkpoint.
- **Completed:** 2026-10-13
- **Tasks:** 3/3 (Task 3 was a human-verify checkpoint, now approved)
- **Files modified:** 3

## Accomplishments

- **A1 fixed: self-unenrolment works.** Before the fix, `unenroll` read `auth.user!.roles.some(...)` on a route where roles are never loaded, so DELETE `/enrollments/:enrollmentId` **returned 500 for every caller** (TypeError reading `'some'`). Now it is `bouncer.with('EnrollmentPolicy').authorize('unenroll', enrollment)` (self, or `manage` on the course, or admin). The A1 test was observed failing with that 500 / TypeError before the controller change.
- **enrollManual goes through `CoursePolicy.manage`.** This removes the same latent `roles.some` TypeError: admins without a permission row and unauthorised users got a 500 instead of success or a 403.
- **Validation V9-V12 added** in `app/validators/enrollment.ts`, applied via `request.validateUsing(...)` in all four POST actions. Missing key, method id or `userIds`, or an oversized `requestMessage`, now produce a 302 with `inputErrorsBag.<field>`, never a 500. `courseRole` is a `vine.enum` of the 6 `CourseRole` values.
- **A9: method and group ids are limited to the course in the URL.** Every `CourseEnrollmentMethod` lookup (self, key, request, manual) and the manual `CourseGroup` lookup filter on `course_id`. Cross-course ids get the flash `"Méthode d'inscription invalide."` or `'Groupe invalide pour ce cours.'`, and nothing is created.
- **AS4:** `enrollSelf` and `enrollWithKey` check `bouncer.with('CoursePolicy').denies('enroll', course)` after the method lookup and before `isAvailable()`. Draft, closed (`allowEnrollment = false`), full, or out-of-date-window courses are refused with `"Les inscriptions à ce cours ne sont pas ouvertes."`. Admins bypass this via the policy `before` hook.

## Task Commits

1. **Task 1: Policies for enrollManual/unenroll (fix A1), validators V9-V12, scope method/group ids (A9)**: `3b189f4` (fix)
2. **Task 2: AS4, enforce course.canEnroll() on self and key enrolment**: `d0726799af028821a65b3dd99d30e2aa7dd42f87` (feat). This is an isolated commit, so it can be reverted alone.
3. **Task 3: Confirm behaviour change AS4**: checkpoint. **APPROVED**, so there is no code change and no revert.

## Files Created/Modified

- `app/validators/enrollment.ts` (new): `enrollWithKeyValidator`, `enrollSelfValidator`, `requestEnrollmentValidator`, `enrollManualValidator`
- `app/controllers/enrollments_controller.ts`: policy-routed, validated, course-scoped lookups, AS4 gate, static imports
- `tests/functional/enrollments_access.spec.ts` (new): groups `Enrollments - access and validation` (A1, policies, V9-V12, A9) and `Enrollments - AS4 canEnroll`. Every write uses `.withCsrfToken()`, and every 302 assertion uses `assertNotCsrfRejected` plus a field key or exact flash.

## Decisions Made

### AS4 decision (Task 3 checkpoint)

**Decision: APPROVED.** The user's reply (in French, translated):

> "Yes, I understand AS4 correctly: if enrolment is not available, it must not be possible; the server should refuse self-enrolment and enrolment by key. So I approve."

AS4 commit `d0726799af028821a65b3dd99d30e2aa7dd42f87` stays. No revert, no further code change and no new test run were needed.

### Other decisions

- `requestEnrollment` (approval requests) and `enrollManual` (staff manual enrolment) are **deliberately not** `canEnroll`-gated. A request still goes through approval, and staff may enrol into a closed or draft course on purpose.
- AS4 uses `denies()` + flash + `redirect().back()` rather than `authorize()`, so students stay on the enrolment page instead of hitting a 403 page.
- The enrolment counter lines (`currentEnrollments +=`, `enrolledCount +=`, `currentMembers +=`, `Math.max(0, course.enrolledCount - 1)`) are **untouched**. Plan 02-13 replaces them with atomic updates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed the dynamic `await import(` in enrollWithKey's group auto-assign block**
- **Found during:** Task 1
- **Issue:** The plan's acceptance criterion requires `grep -c "await import(" app/controllers/enrollments_controller.ts` = 0. Besides the `enrollManual` imports named in the plan, `enrollWithKey`'s group auto-assign block also used a dynamic import.
- **Fix:** It now uses the static `CourseGroup` / `CourseGroupMember` imports at the top of the file.
- **Files modified:** app/controllers/enrollments_controller.ts
- **Committed in:** 3b189f4

**2. [Rule 1 - Bug] The method lookup in manual enrolment only runs when `enrollmentMethodId` is provided**
- **Found during:** Task 1
- **Issue:** `enrollmentMethodId` is optional for manual enrolment. An unconditional scoped lookup would have rejected every valid manual enrolment that omits it.
- **Fix:** The scoped lookup and its `"Méthode d'inscription invalide."` rejection run only when `payload.enrollmentMethodId` is set.
- **Files modified:** app/controllers/enrollments_controller.ts
- **Committed in:** 3b189f4

**3. [Process] The failing tests went into the same commit as each fix**
- The failing tests were committed together with each implementation, not as separate `test(...)` commits. Before the fix, the A1 test was observed failing (500 / TypeError reading `'some'`).

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug) + 1 process note
**Impact on plan:** No scope creep. Both fixes were needed to meet the plan's own criteria and to keep manual enrolment working.

## TDD Gate Compliance

WARNING: there is no separate `test(...)` RED commit. The tests and the implementation are combined in `3b189f4` (fix) and `d072679` (feat); see deviation 3. The A1 test was observed failing before the Task 1 fix.

## Verification

- `tests/functional/enrollments_access.spec.ts`: **16/16 pass**
- Full functional suite: **46/46 pass**
- `bun run typecheck` and `bun run lint`: pass
- Gate 1 (`hasPermission(|hasRole(|instructorId ===|isInstructor(|.roles.some(`) and gate 2 (`request.(only|input|all)(`) on `enrollments_controller.ts`: both 0
- `grep -c "denies('enroll'"` = 2

## Issues Encountered

None blocking.

## Open Items / Follow-ups

- **Stale comment:** the comment on `CoursePolicy.enroll` in `app/policies/course_policy.ts` (line 102) still says "Not called anywhere until AS4 (plan 02-05) is confirmed." It is now called by `enrollSelf` and `enrollWithKey`, so the comment is out of date. It was left for a later plan, because this plan's `files_modified` does not include the policy file.
- **Optional AS4 impact query NOT run:** the read-only SQL in Task 3 `how-to-verify` step 2 lists courses with enabled self/key methods that AS4 now refuses. Nobody ran it against the dev or prod DB. The user approved AS4 on product grounds without it.
- **Requirements:** DEBT-04 and DEBT-05 are **partial**. This plan covers only `enrollments_controller.ts`; other controllers are handled by other Phase 2 plans. Do not mark either complete from this plan alone.
- Enrolment counters are still read-modify-write (plan 02-13).

## User Setup Required

None.

## Self-Check: PASSED

- FOUND: app/validators/enrollment.ts, tests/functional/enrollments_access.spec.ts, app/controllers/enrollments_controller.ts
- FOUND commits: 3b189f4 (Task 1), d072679 (Task 2, AS4)
- Spec: 16 `withCsrfToken()` for 16 `client.<write>(` calls, 4 `inputErrorsBag.` assertions, `assertNotCsrfRejected` used
- Controller: gate 1 = 0, gate 2 = 0, `denies('enroll'` = 2, `await import(` = 0, `where('course_id'` = 12, and the counter lines are still present

---
*Phase: 02-security-correctness-hardening*
*Completed: 2026-10-13*
