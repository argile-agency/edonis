---
phase: 02-security-correctness-hardening
verified: 2026-10-20T12:00:00Z
status: gaps_found
score: 6/7 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Goal: authorization is applied uniformly (no action discloses restricted course data or secrets to an unauthorized logged-in user). Includes CR-02: enrolment keys are not readable by arbitrary users."
    status: failed
    reason: "EnrollmentsController.show (GET /courses/:id/enroll) is the only action of the controller with no policy call. It serializes every enabled enrolment method of any course, including draft/private/archived ones. CourseEnrollmentMethod.enrollmentKey is a plain @column() with no serializeAs:null, so the plaintext key is in the Inertia props. Any logged-in user can read a key and pass enrollWithKey. This voids the key gate that plans 02-05 (AS4) and 02-13 reworked."
    artifacts:
      - path: "app/controllers/enrollments_controller.ts"
        issue: "show() (lines 43-76) has no bouncer authorize('view'); returns method.serialize()"
      - path: "app/models/course_enrollment_method.ts"
        issue: "line 50 enrollmentKey is serialized"
    missing:
      - "authorize CoursePolicy 'view' (and refuse non-published courses to non-staff) in EnrollmentsController.show"
      - "enrollmentKey serializeAs:null; map learner-facing methods to an explicit whitelist (id, methodType, name, requiresKey, welcomeMessage, isAvailable)"
      - "manageEnrollmentMethods sends the key explicitly (managers only)"
      - "functional test: a non-manager's enrollments.show props contain no enrollmentKey"
  - truth: "Goal: authorization is applied uniformly. Includes CR-03: AS3 (course outline/progress limited to enrolled students, edit-rights holders and admins) is not bypassed through courses.show."
    status: failed
    reason: "CoursesController.show preloads every module, child and content row with no is_published filter and sends modules.map(m => m.serialize()) to any viewer who passes CoursePolicy.view. view returns true for every public course whatever its status. CourseContent serializes content bodies, fileUrl and externalUrl. The tree is only rendered for canEdit users in show.tsx, but is shipped to everyone. This is the same exposure research A7 targeted in outline/getCourseProgress, left open on the sibling action in a controller the phase reworked (02-04, 02-11)."
    artifacts:
      - path: "app/controllers/courses_controller.ts"
        issue: "show() lines 147-187: full unfiltered module/content tree in props for all viewers"
      - path: "app/policies/course_policy.ts"
        issue: "view() lines 44-46 ignores course.status"
    missing:
      - "send the full tree only when canEdit; otherwise a titles-only outline of published modules/contents (no content, fileUrl, externalUrl)"
      - "require course.isPublished() for non-staff viewers"
      - "functional test: an unenrolled student's courses.show props carry no unpublished content or page bodies"
deferred: []
human_verification:
  - test: "Run CI on PostgreSQL and MySQL/MariaDB (the full functional + unit matrix) against main"
    expected: "All 202 tests pass on every engine. Phase 2 was only run on SQLite. Watch the widen_users_pii_columns migration, the conditional increments in EnrollmentService and the isUniqueViolation mapping, which are engine-specific."
    why_human: "Needs the CI matrix or local PG/MySQL; not run for this phase's changes."
  - test: "DEBT-08 production gate: on demo.edonis.org run SELECT @@sql_mode, the phone/mobile_phone length query, then node ace pii:scan (and --fix for legacy plaintext). Only after a clean scan set PII_DECRYPT_STRICT=true."
    expected: "No undecryptable rows; sql_mode known. Until then PII_DECRYPT_STRICT stays off (the shipped default)."
    why_human: "Production access. The user skipped these checks (02-07 Q1 = SKIP). Not a code gap: the raise-on-strict behaviour is implemented and tested."
  - test: "Run the browser accessibility suite (node ace test browser tests/browser/accessibility.spec.ts) including the errors/forbidden 403 page"
    expected: "No critical/serious axe violations"
    why_human: "Playwright browser tests were not run in this verification."
---

# Phase 2: Security and Correctness Hardening Verification Report

**Phase Goal:** Authorization and validation applied uniformly; no silent failures
**Verified:** 2026-10-20
**Status:** gaps_found
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: `app/policies/` exists; resource-ownership checks route through it; the grep gate returns 0 | VERIFIED | `app/policies/{course,enrollment}_policy.ts` and `main.ts` exist. `grep -rn "hasPermission(\|hasRole(\|instructorId ===\|isInstructor(\|\.roles\.some(" app/controllers` returns nothing. `bun run check:debt` exits 0. Mutating actions (`unenroll`, `enrollManual`, course update/permissions, content CRUD, gradebook) call `bouncer.with(...)`. |
| 2 | SC2: all DEBT-05 actions read input only through `request.validateUsing()` | VERIFIED | `grep -rn "request\.\(only\|input\|all\)(" app/controllers` returns nothing. Validators exist for course, course_admin, course_content, course_group, enrollment, enrollment_method, listing, account, category, two_factor. `validation.spec.ts` and `validation_listing.spec.ts` pass. |
| 3 | SC3: counter mutations run in a transaction with atomic increments; counters equal COUNT(*) after any sequence | VERIFIED (warning, see CR-06) | `EnrollmentService` uses `db.transaction`, conditional `UPDATE ... SET x = x + 1 WHERE max IS NULL OR x < max` for method and group, guarded `> 0` decrements, and `recount` with audit. `enrollment_counters.spec.ts` passes (incl. mixed-sequence invariant). Residual: the `courses.enrolled_count` increment is atomic but not conditional on `max_students` (CR-06). |
| 4 | SC4: category update rejects self/descendant parent; descendant path/depth recomputed | VERIFIED | `categories_controller.update` calls `wouldCreateCycle` and `recomputeSubtree` inside `db.transaction`. `category_tree.spec.ts` and `categories.spec.ts` pass. |
| 5 | SC5: decryption failures are logged, never returned raw; raise when PII_DECRYPT_STRICT=true; PII columns can hold ciphertext | VERIFIED (warning, WR-04) | `EncryptionService.decrypt` logs column/id/length, returns null, or throws `DecryptionException` when strict; `SilentAuthMiddleware` rethrows it. `phone`/`mobile_phone` widened to 512 (SQLite correctly skipped). `pii:scan` command exists. Tests pass. Residual: `identification_number` stays varchar(255) while the validator accepts 255 plaintext chars (WR-04). |
| 6 | SC6: 2FA pending state has an explicit timeout and a documented recovery path | VERIFIED | `app/helpers/two_factor_pending.ts` (10 min TTL, 5-attempt lock), per-user throttle, admin route `users.two-factor.reset`, `commands/user_reset_two_factor.ts`, `docs/TWO_FACTOR_RECOVERY.md`. `two_factor.spec.ts` and `two_factor_pending.spec.ts` pass. |
| 7 | Goal-level: authorization is applied uniformly (read paths included) | FAILED | CR-02 and CR-03 below. |

**Score:** 6/7 truths verified

### Test and gate evidence (run by the verifier, Node 22, SQLite)

| Check | Result |
|-------|--------|
| `node ace test functional` | 174/174 pass |
| `node ace test unit` | 28/28 pass (total 202, matches the claim) |
| `bun run check:debt` | exit 0 |
| `TBD\|FIXME\|XXX` in app, commands, start, database, tests | none |

Passing tests do not cover the two failed truths: none asserts `enrollments.show` or `courses.show` props for a non-privileged user (confirmed by review IN-05).

### Triage of the code review's 6 critical findings

| ID | Decision | Reasoning |
|----|----------|-----------|
| CR-02 | **GAP (blocker)** | Confirmed in code. `enrollments_controller.ts` was reworked for DEBT-04 (02-05, 02-13), and `show` is the one action with no policy. It exposes the plaintext key that `enrollWithKey` (AS4) relies on, so a phase deliverable is falsified. |
| CR-03 | **GAP (blocker)** | Confirmed in code. It breaks the user-approved AS3 and research A7 (structure/content readable without enrolment) through the `courses.show` route. Unpublished bodies and file URLs reach any viewer. |
| CR-06 | Out of scope, warning | Counter integrity (the DEBT-06 text and SC3 invariant) holds. The `max_students` oversell is a pre-existing check-then-act race that the phase narrowed (AS4 added `canEnroll`) but did not claim to close. The `EnrollmentService` header says "cannot both take the last seat", which is only true for method and group seats; fix the doc or add the conditional course increment. Not a DEBT requirement. |
| CR-01 | Out of scope (pre-existing) | `Course.serialize()` embedding `User.serialize()` (decrypted phone, address, identification number) predates the phase. DEBT-08 covers decryption failures, not serialization. Serious data exposure: recommend a dedicated fix right after this phase's gaps. |
| CR-05 | Out of scope (pre-existing) | PII in `audit_logs` via `user.serialize()`: `02-RESEARCH.md` line 1058 already recorded it as out of scope. Fixed together with CR-01 (`serializeAs: null`). |
| CR-04 | Out of scope (pre-existing) | `account_controller.ts:69` queries `submissions.user_id`; the column is `student_id`. Introduced in `cb26846` (RGPD export), before this phase. It is not tied to DEBT-04..09 (the phase only added validators to this controller). It is a real crash (GDPR export returns 500 on every engine); one-line fix plus a test, recommended immediately. |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `app/policies/course_policy.ts`, `enrollment_policy.ts`, `main.ts` | VERIFIED | substantive, registered, used by controllers |
| `app/services/enrollment_service.ts` | VERIFIED | transaction and atomic updates; controllers call it |
| `app/helpers/category_tree.ts` | VERIFIED | used by `categories_controller.update` |
| `app/helpers/two_factor_pending.ts` | VERIFIED | used by `two_factor_controller` |
| `app/services/encryption_service.ts`, `decryption_exception.ts` | VERIFIED | consumed by `User` PII columns |
| `commands/{enrollment_recount,categories_check_integrity,pii_scan,user_reset_two_factor}.ts` | VERIFIED | present |
| `docs/TWO_FACTOR_RECOVERY.md` | VERIFIED | documents user, admin and break-glass paths |

### Requirements Coverage

All six IDs are declared in plan frontmatter and mapped to Phase 2 in REQUIREMENTS.md. No orphaned IDs.

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|----------|
| DEBT-04 | 01, 04, 05, 09, 10, 14 | BLOCKED (partial) | Mutation paths and the gate are centralized; read actions `enrollments.show` and `courses.show` still disclose restricted data (gaps 1-2) |
| DEBT-05 | 03, 05, 06, 10, 11, 12, 14 | SATISFIED | SC2 grep gate 0, validation specs pass |
| DEBT-06 | 13, 14 | SATISFIED | transaction, atomic counters, recount, invariant test (CR-06 caveat) |
| DEBT-07 | 06 | SATISFIED | cycle rejection, subtree recompute, integrity command |
| DEBT-08 | 02, 07 | SATISFIED (code) / NEEDS HUMAN (prod) | strict raise implemented and default off; production checks pending (human item 2) |
| DEBT-09 | 03, 08 | SATISFIED | 10-min expiry, lockout, admin reset, CLI, doc |

REQUIREMENTS.md still shows DEBT-04..09 as `[ ]`/Pending; update them once the gaps close.

### Anti-Patterns Found

No debt markers. No stubs found in the phase deliverables. Notable items are in the observations below.

### Out-of-scope observations (not gaps; from 02-REVIEW.md, not re-verified line by line)

- Priority follow-ups: CR-01, CR-05 (PII serialization and audit logs), CR-04 (export crash), CR-06 (course seat race, misleading doc).
- Closest to the phase theme, worth a follow-up: WR-01/WR-02 (learner access ignores enrolment status and module publication, and diverges from `FilesController`), WR-07 (an `edit`-level collaborator can set `status` through `PUT /courses/:id`, bypassing the `manage` gate on publish/archive; distinct from the deferred "teachers may publish" decision), WR-03 and WR-18 ("no silent failures" spirit: ProfileController and AuthController swallow validation or DB errors), WR-04 (`identification_number` varchar(255) cannot hold ciphertext for values over about 110 characters; widen to 1024).
- Other warnings WR-05, WR-06, WR-08 to WR-17, WR-19, WR-20 and IN-01 to IN-05 are pre-existing or beyond the DEBT-04..09 wording.
- User-approved behaviour changes AS2-AS5, `PII_DECRYPT_STRICT` default off, and the deferred teacher direct-publish todo (`.planning/todos/pending/2026-10-20-course-creation-requests-with-save-and-publish-buttons.md`) are not flagged.

### Gaps Summary

Six of seven truths hold: SC1-SC6 pass on code inspection and 202/202 passing tests. The phase falls short of "authorization applied uniformly" on two read paths. `GET /courses/:id/enroll` hands the plaintext enrolment key and details of any course to every logged-in user (CR-02). `GET /courses/:id` ships the unfiltered module and content tree, including unpublished page bodies and file URLs, to every viewer (CR-03). Both are small fixes (a policy call plus a serialization whitelist each, with one regression test each), suited to `/gsd:plan-phase --gaps`. After they close, the remaining items are human checks: CI on PostgreSQL/MySQL, the production DEBT-08 checks, and the browser a11y suite.

---

_Verified: 2026-10-20_
_Verifier: Claude (gsd-verifier)_
