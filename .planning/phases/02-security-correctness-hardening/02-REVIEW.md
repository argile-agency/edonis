---
phase: 02-security-correctness-hardening
reviewed: 2026-10-20T00:00:00Z
depth: standard
files_reviewed: 66
files_reviewed_list:
  - app/abilities/main.ts
  - app/controllers/account_controller.ts
  - app/controllers/audit_logs_controller.ts
  - app/controllers/auth_controller.ts
  - app/controllers/categories_controller.ts
  - app/controllers/course_contents_controller.ts
  - app/controllers/courses_controller.ts
  - app/controllers/enrollments_controller.ts
  - app/controllers/files_controller.ts
  - app/controllers/grades_controller.ts
  - app/controllers/profile_controller.ts
  - app/controllers/two_factor_controller.ts
  - app/controllers/users_controller.ts
  - app/exceptions/capacity_reached_exception.ts
  - app/exceptions/decryption_exception.ts
  - app/exceptions/handler.ts
  - app/helpers/category_tree.ts
  - app/helpers/db_errors.ts
  - app/helpers/two_factor_pending.ts
  - app/middleware/initialize_bouncer_middleware.ts
  - app/middleware/silent_auth_middleware.ts
  - app/models/course_category.ts
  - app/models/user.ts
  - app/policies/course_policy.ts
  - app/policies/enrollment_policy.ts
  - app/policies/main.ts
  - app/services/encryption_service.ts
  - app/services/enrollment_service.ts
  - app/services/pii_scan_service.ts
  - app/services/two_factor_admin_service.ts
  - app/services/two_factor_service.ts
  - app/validators/account.ts
  - app/validators/category.ts
  - app/validators/course.ts
  - app/validators/course_admin.ts
  - app/validators/course_content.ts
  - app/validators/course_group.ts
  - app/validators/enrollment.ts
  - app/validators/enrollment_method.ts
  - app/validators/listing.ts
  - app/validators/profile_validator.ts
  - app/validators/two_factor.ts
  - app/validators/user_validator.ts
  - commands/categories_check_integrity.ts
  - commands/enrollment_recount.ts
  - commands/pii_scan.ts
  - commands/user_reset_two_factor.ts
  - database/migrations/1791898473129_widen_users_pii_columns.ts
  - inertia/pages/admin/courses/settings.tsx
  - inertia/pages/courses/create.tsx
  - inertia/pages/courses/edit.tsx
  - inertia/pages/errors/forbidden.tsx
  - inertia/pages/users/show.tsx
  - start/env.ts
  - start/kernel.ts
  - start/limiter.ts
  - start/routes.ts
  - tests/bootstrap.ts
  - tests/browser/accessibility.spec.ts
  - tests/functional/two_factor.spec.ts
  - tests/functional/decryption_failures.spec.ts
  - tests/functional/enrollment_counters.spec.ts
  - tests/functional/grades.spec.ts
  - tests/functional/csrf.spec.ts
  - tests/functional/pii.spec.ts
  - tests/functional/helpers/factories.ts
findings:
  critical: 6
  warning: 20
  info: 5
  total: 31
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-10-20
**Depth:** standard
**Files Reviewed:** 66 of the 77 submitted
**Status:** issues_found

## Scope note

Not reviewed (no claim made about them): `app/exceptions/already_enrolled_exception.ts`,
`tests/functional/authorization.spec.ts`, `authorization_contents.spec.ts`,
`authorization_courses.spec.ts`, `categories.spec.ts`, `enrollments_access.spec.ts`,
`validation.spec.ts`, `validation_listing.spec.ts`, and the unit specs
`category_tree.spec.ts`, `encryption_service.spec.ts`, `two_factor_pending.spec.ts`.
`accessibility.spec.ts` and `enrollment_counters.spec.ts` were only partly read.
`social_auth_controller.ts`, `audit_service.ts` and the Course/Module/Content models were read
only where needed to confirm a finding.

User-approved decisions (AS2-AS5, PII_DECRYPT_STRICT default off, teacher direct publish) are
not flagged.

## Structural Findings (fallow)

None provided.

## Narrative Findings (AI reviewer)

## Summary

The new policy layer, enrolment counters, 2FA pending state and category-tree helpers are
generally sound. The serious problems are in how data leaves the server. Several controllers
serialize whole models to any authenticated user. That defeats the PII encryption, the
enrolment-key secrecy and the AS3 "outline limited to enrolled students" work. The GDPR export
endpoint is broken outright. Course capacity can be oversold under concurrency.

## Critical Issues

### CR-01: Decrypted PII of instructors and group members is sent to every authenticated user

**File:** `app/models/course.ts:319`, `app/models/user.ts:44-85`,
`app/controllers/courses_controller.ts:74-110, 147-187, 417-441`
**Issue:** `Course.serialize()` embeds `instructor: this.instructor?.serialize()`. `User` only
hides `password` and the 2FA fields with `serializeAs: null`. `phone`, `mobilePhone`, `address`,
`identificationNumber`, `studentId`, `email` and `lastLoginAt` are serialized, and the
`consume` hooks have already decrypted them. Any student who loads one of these pages receives
the instructor's decrypted PII in the Inertia props:
- `courses.index` (the paginator calls the custom `serialize`)
- `courses.show`
- `enrollments.show` (`course.serialize()` with `preload('instructor')`)
- `grades.index` and `grades.course`

`manageGroups` ships `members.user` via the default serializer to any `manage` holder.
Encryption at rest is pointless if the application hands the plaintext to every logged-in
account.
**Fix:** Fix it at the root. Add `serializeAs: null` to `phone`, `mobilePhone`, `address`,
`identificationNumber` (and `studentId`, `lastLoginAt`, `termsAccepted*`). Opt in explicitly
where they are needed (profile edit, account export, admin show/edit) with
`user.serialize({ fields: ... })` or a DTO. In `Course.serialize()` return a whitelist:
```ts
instructor: this.instructor
  ? { id: this.instructor.id, fullName: this.instructor.fullName }
  : undefined,
```
Add a regression test that asserts `instructor.phone` is absent from the `courses.show` props.

### CR-02: Enrolment keys are readable by any authenticated user (`EnrollmentsController.show` has no authorization)

**File:** `app/controllers/enrollments_controller.ts:43-76` (`method.serialize()` at line 70)
**Issue:** `GET /courses/:id/enroll` only requires login. It loads every enabled enrolment
method of any course (draft, private or archived) and serializes it. `CourseEnrollmentMethod`
declares `enrollmentKey` as a plain `@column()`, so the plaintext key is in the page props. Any
user can read the key of any course and then enrol through `enrollWithKey`. The key check is
therefore worthless. The page also discloses draft and private course details, because
`CoursePolicy.view` is never consulted.
**Fix:**
```ts
// course_enrollment_method.ts
@column({ serializeAs: null })
declare enrollmentKey: string | null
// show(): authorize first, expose only what the learner needs
await bouncer.with('CoursePolicy').authorize('view', course)
enrollmentMethods: course.enrollmentMethods.map((m) => ({
  id: m.id, methodType: m.methodType, name: m.name,
  requiresKey: m.methodType === 'key', welcomeMessage: m.welcomeMessage,
  isAvailable: m.isAvailable(),
}))
```
`manageEnrollmentMethods` must then send the key explicitly (managers only). Add a test.

### CR-03: `courses.show` leaks the full, unpublished module and content tree to any viewer

**File:** `app/controllers/courses_controller.ts:147-187`, `app/policies/course_policy.ts:44-46`
**Issue:** `show` preloads all modules, children and contents without an `is_published` filter
and without an enrolment check, then sends `modules.map((m) => m.serialize())`. The default
serializer includes `content` (page bodies), `fileUrl` and `externalUrl`. `view` returns `true`
for every `public` course whatever its `status`. Any authenticated user can therefore read
unpublished and draft material of any public course. That defeats AS3, which limits the
outline and progress to enrolled users and edit-rights holders.
**Fix:** Send the tree only to `canEdit` users. For everyone else send a titles-only outline of
published, available modules (no `content`, `fileUrl`, `externalUrl`) and require
`status === 'published'` unless the user is staff:
```ts
const isStaff = canEdit || (await bouncer.with('CoursePolicy').allows('viewAsStaff', course))
if (!isStaff && !course.isPublished()) throw new E_AUTHORIZATION_FAILURE() // or 404
modules: isStaff ? fullTree : publicOutline(course)
```

### CR-04: GDPR data export crashes (queries a column that does not exist)

**File:** `app/controllers/account_controller.ts:69`
**Issue:** `Submission.query().where('user_id', user.id)`. The `submissions` table has
`student_id` (migration `1763377130470`, line 17), not `user_id`. Every export raises an SQL
error and returns the 500 page on every engine. No test covers `user.account.export`.
**Fix:** `Submission.query().where('student_id', user.id)`. Add a functional test that posts to
`user.account.export` and asserts a 200 with `submissions` in the JSON.

### CR-05: Decrypted PII is written into `audit_logs` (pre-existing, still present)

**File:** `app/controllers/profile_controller.ts:50, 73-79` (pre-existing, tracked separately);
`app/controllers/users_controller.ts:132, 184, 245-246, 323-329` (also pre-existing: the
phase diff does not touch these `serialize()` calls)
**Issue:** `user.serialize()` contains decrypted `phone`, `mobilePhone`, `address` and
`identificationNumber`. These are stored in `audit_logs.old_values` and `new_values`, which are
plaintext JSON, and are readable by admins and exported to the user through
`AccountController.exportData`. `UsersController.forceDestroy` also copies the full PII into
the log of a user who is being erased. `resetTwoFactor` in this phase avoids the pattern and
says why in a comment, but the sibling methods still use it.
**Fix:** After CR-01 hides PII from `serialize()`, add a helper
`auditSafe(user)` that returns only non-PII fields (id, email, fullName, isActive, roles, and
a list of changed field names for PII columns). Use it in all five call sites. Add a test
that asserts `audit.newValues` has no `phone`.

### CR-06: Course `maxStudents` can be oversold under concurrent enrolment

**File:** `app/models/course.ts:262-281`, `app/services/enrollment_service.ts:118-120`,
`app/controllers/enrollments_controller.ts:97-102, 172-177`
**Issue:** `canEnroll()` compares `enrolledCount >= maxStudents` on an in-memory model read
earlier in the request. `EnrollmentService.enroll` then runs an unconditional
`increment('enrolled_count')`. Two simultaneous self or key enrolments on a course with one
seat left both pass. Only the method capacity (`maxEnrollments`) is protected by the
conditional UPDATE. The class doc ("two concurrent enrolments cannot both take the last
seat") is only true for method seats. Manual and admin enrolments ignore `maxStudents`
entirely, which may be intended, but the self/key path is not safe.
**Fix:** Add a conditional course increment in the same transaction, for student-initiated
calls (pass `enforceCourseCapacity: true`):
```ts
const [n] = await Course.query({ client: trx })
  .where('id', opts.courseId)
  .where((q) => q.whereNull('max_students').orWhereRaw('enrolled_count < max_students'))
  .increment('enrolled_count', 1)
if (Number(n) < 1) throw new CapacityReachedException()
```

## Warnings

### WR-01: `learn`, `viewGradebook` and the player ignore enrolment status and course status

**File:** `app/policies/course_policy.ts:12-18, 84-94`, `app/controllers/enrollments_controller.ts:224-289`
**Issue:** `isEnrolled` matches any `course_enrollments` row. `EnrollmentStatus` includes
`pending`, `suspended` and `expired`. A suspended or expired student keeps the learn player,
the outline, progress posting and the gradebook. `FilesController` allows only
`active`/`completed` in published (or completed in archived) courses, so the two rules
disagree. `timeStart`/`timeEnd` are ignored as well. A draft course also still serves its
enrolled students. `requestEnrollment` does not apply the AS4 `enroll` check, so requests can
be filed against draft or archived courses.
**Fix:** Make one helper (`hasLearnerAccess(user, course)`) used by both the policy and
`FilesController`: status in `active|completed`, within `timeStart/timeEnd`, and course
published (completed users only on archived). Call `denies('enroll')` in `requestEnrollment`.

### WR-02: `learn` can serve content from unpublished modules; progress counts unpublished content

**File:** `app/controllers/course_contents_controller.ts:91-97, 446-472, 477-491, 498-533`
**Issue:** With `?content=<id>` the lookup checks the content's `is_published` and the course,
but not the module's or ancestors' publication or availability dates. Content in an
unpublished module is served, including its `content` body. `FilesController` does check
`isEffectivelyAvailable`, so the rules diverge. `getCourseProgress` preloads all modules and
contents with no filter, so `totalContents` and the percentage include hidden items.
`updateProgress` and `markComplete` accept any content id of the course, including unpublished
ones, and `updateProgress` accepts a negative `timeSpent` (validator has no `min(0)`).
**Fix:** Share a "visible content" query (published, available, effectively-available module)
across `learn`, `outline`, `getCourseProgress`, `updateProgress` and `markComplete`. Add
`timeSpent: vine.number().min(0).max(86400)`.

### WR-03: ProfileController swallows validation errors

**File:** `app/controllers/profile_controller.ts:38-39, 145-146, 217`
**Issue:** `update`, `updatePassword` and `updateSettings` call `validateUsing` inside a
catch-all `try`. A `ValidationError` becomes the generic flash "Erreur lors de..." and is logged
as an error; field errors never reach the form. `updateAvatar` was already fixed for this
and carries the comment explaining why.
**Fix:** Move `validateUsing` above the `try` in the three methods, as in `updateAvatar`.

### WR-04: `users.identification_number` is too small for its ciphertext

**File:** `database/migrations/1791898473129_widen_users_pii_columns.ts`,
`database/migrations/1769783297617_create_add_profile_fields_to_users_table.ts:15`,
`app/validators/profile_validator.ts:24`
**Issue:** The migration widens `phone` and `mobile_phone` but not `identification_number`,
which is `varchar(255)`. The validator accepts 255 plaintext characters. AdonisJS ciphertext
exceeds 255 characters at roughly 110 plaintext characters. On PostgreSQL and strict MariaDB
the save fails; on non-strict MySQL the ciphertext is silently truncated and becomes
undecryptable (read as null).
**Fix:** Widen `identification_number` to `string(1024)` in the same migration (guarded `down()`
as for phone), or cap the validator at about 80 characters.

### WR-05: Missing rate limits on credential-checking and secret-guessing endpoints

**File:** `start/routes.ts:109-122, 189, 397-399`
**Issue:** CLAUDE.md requires a limiter on every auth-related endpoint. These have none:
`POST /user/two-factor/confirm|disable|recovery`, `DELETE /user/account` (verifies the
password), and `POST /courses/:id/enroll/key` (guessable enrolment keys, max 100 chars, often
short). `regenerateCodes` returns a fresh set of valid recovery codes without any password or
TOTP re-authentication, so a hijacked session can mint working codes.
**Fix:** Reuse `passwordThrottle` for `disable` and `DELETE /user/account`, add an
`enrollKeyThrottle` keyed on user + course, and require the current password or a TOTP for
`regenerateCodes`.

### WR-06: Deactivation does not take effect on live sessions or pending 2FA logins

**File:** `app/controllers/two_factor_controller.ts:256, 291`, `app/controllers/users_controller.ts:257-273`,
`config/session.ts` (age `2h`)
**Issue:** `isActive` is checked only in `AuthController.login` and the OAuth callback. A
deactivated or anonymized user who already has a session (2 hours) keeps full access.
`verifyChallenge` and `verifyRecovery` load the user with `findOrFail` and call
`auth.login(user)` without rechecking `isActive`, so a user deactivated during the 10-minute
pending window still completes the login.
**Fix:** Check `isActive` in `AuthMiddleware` (or a small global middleware) and log the user
out; check it in both 2FA verify methods.

### WR-07: `update` needs only `edit` but accepts `status`, `visibility`, `allowEnrollment`, `maxStudents`, `isFeatured`

**File:** `app/controllers/courses_controller.ts:209-225`, `app/validators/course.ts:36-56`,
`start/routes.ts:293-317`
**Issue:** `publish` and `archive` require `manage`, but an `edit`-level collaborator can send
`status: 'published' | 'archived'` to `PUT /courses/:id` and bypass that gate. Publishing this
way also leaves `publishedAt`/`archivedAt` unset. `isFeatured` (an admin-flavoured flag) is
writable by any teacher through `create` and `update`. This is distinct from the deferred
"teachers may publish" decision. Separately, absent or empty fields are dropped by
`optional()` and by `startDate ? ... : undefined`, so a user can never clear `maxStudents`,
`startDate`, `endDate`, `estimatedHours` or `description` although the UI says "Illimité si
vide".
**Fix:** Strip `status` and `isFeatured` from the teacher validators (use `publish`/`archive`
and the admin settings). Make the clearable fields `.optional().nullable()` and write explicit
nulls.

### WR-08: `addPermission` returns 500 on an unknown user or a duplicate grant

**File:** `app/controllers/courses_controller.ts:272-286`, `app/validators/course.ts:60-64`
**Issue:** `userId` has no `exists` rule, so an unknown id is an FK 500.
`course_permissions` has `unique(course_id, user_id)`, so granting a second level (the natural
way to promote a collaborator) raises a unique-violation 500. There is no update path. The
owner can also be added as a collaborator row.
**Fix:** `userId: vine.number().positive().exists({ table: 'users', column: 'id' })`, then
`CoursePermission.updateOrCreate({ courseId, userId }, { permissionLevel, roleInCourse })`
and refuse `userId === course.instructorId`.

### WR-09: Account anonymization and export are incomplete (GDPR rule in CLAUDE.md)

**File:** `app/controllers/account_controller.ts:55-105, 134-160`
**Issue:** `social_accounts` keeps `email`, `name`, `avatar_url` and `provider_id` after
"anonymization". The export omits social accounts, group memberships, enrolment requests and
terms data. Also, `webUrl` is cleared but `lastLoginAt` and `emailVisibility` settings remain,
and the 500 on `Submission` (CR-04) masks all of this.
**Fix:** Delete the user's `social_accounts` rows in `deleteAccount` (inside a transaction with
the user save) and add them, memberships and requests to the export.

### WR-10: `pii:scan` can classify real plaintext as "undecryptable" and then NULL it

**File:** `app/services/pii_scan_service.ts:42-66, 134-142`
**Issue:** `isCiphertextShaped` accepts any value of three dot-separated `[A-Za-z0-9_-]+`
parts. Legitimate plaintext such as a dotted US phone number `555.123.4567` or an id
`AB.123.456` is therefore "ciphertext-shaped", fails to decrypt, is reported `undecryptable`,
and `--null-undecryptable` permanently erases it. Also, the writes are unconditional
`UPDATE users SET col = ? WHERE id = ?` based on values read earlier, so a concurrent profile
edit is overwritten by a stale re-encryption.
**Fix:** Require realistic part lengths (iv and tag parts are 22+ base64url characters), and
add `.where(column, rawValue)` to each update so a changed cell is skipped.

### WR-11: `User.hasRole` ignores the course scope of a role

**File:** `app/models/user.ts:148-166`, `app/policies/course_policy.ts:33`,
`app/middleware/role_middleware.ts`
**Issue:** The `roles` relation loads `course_id` as pivot data, and `UserRole.assignRole`
supports course-scoped roles, but `hasRole(slug, _courseId)` and `hasAnyRole` never look at it.
A role granted only for one course counts as global. For `admin` that is a full bypass in
`CoursePolicy.before`, `EnrollmentPolicy.before` and the role middleware. The unused
`_courseId` parameter hides the gap.
**Fix:** Filter on `role.$extras.pivot_course_id` being null for global checks.

### WR-12: 2FA recovery-code race and TOTP replay

**File:** `app/services/two_factor_service.ts:39-60, 78-99`
**Issue:** `verifyRecoveryCode` reads, removes and saves with no lock or compare-and-set, so two
parallel requests can both consume the same code. TOTP codes are accepted with `window: 1`
and the last used step is not stored, so one captured code can be replayed for about 90
seconds. `JSON.parse` of the decrypted value is unguarded and throws a 500 on corrupt data.
**Fix:** Use a conditional UPDATE (`where two_factor_recovery_codes = <old ciphertext>`) and
check the affected row count; store `last_used_step` and reject `step <= last`.

### WR-13: UsersController role handling is not atomic; no self-lockout guard

**File:** `app/controllers/users_controller.ts:101-126, 227-239, 257-273, 320-336`
**Issue:** `store` creates the user and then the role rows one by one; `update` deletes all
global roles then recreates them. A failure in between leaves a user with no roles. Nothing
stops an admin deactivating, force-deleting, or removing the `admin` role from their own
account or the last admin. `forceDestroy` writes the audit row before the delete and does not
catch FK failures (a user who owns courses gives a 500 after logging a deletion that did not
happen).
**Fix:** Wrap user and role writes in `db.transaction`, refuse self and last-admin
deactivate/delete/role removal, and audit after the delete succeeds.

### WR-14: Raw `error` objects are passed to Inertia pages in production

**File:** `app/exceptions/handler.ts:60-76`
**Issue:** The 403/404/429/5xx status pages render with `{ error }`. The serialized error
includes its enumerable own properties. Database driver errors carry `sql`, `sqlMessage`,
`code`, `errno` and similar fields, and these land in the page JSON even though the template
only shows a generic message when `debug` is false. This should be confirmed with a forced
constraint error in production mode, but the fields are enumerable on mysql2 and pg errors.
**Fix:** Pass `{ status: error.status, code: error.code }` (and `message` only when `debug`).

### WR-15: "Désactiver" and "Activer" buttons on the user page do nothing

**File:** `inertia/pages/users/show.tsx:286-310`
**Issue:** The confirm callback body is `// Handle deactivation` and the activate `onClick` is
`// Handle activation`. The admin confirms a dialog and nothing happens. The routes
(`DELETE /admin/users/:id`, `POST /admin/users/:id/activate`) exist.
**Fix:** Call `router.delete(`/admin/users/${user.id}`)` and
`router.post(`/admin/users/${user.id}/activate`)`.

### WR-16: Category `slug` is unvalidated and non-unique-aware

**File:** `app/validators/category.ts:9, 25`, `app/controllers/categories_controller.ts:73-97, 122-185`
**Issue:** `slug` is any string of 2-255 characters. A slug containing `/`, spaces or `..`
produces a malformed `path`; the path/depth recomputation then propagates it to the whole
subtree. A duplicate slug reaches the DB unique constraint (if any) and returns a 500 instead
of a validation error. `description` and `icon` cannot be cleared on update.
**Fix:** `vine.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)` plus a uniqueness check
(`unique` rule or `isUniqueViolation`) mapped to a flash.

### WR-17: Avatar deletion builds a filesystem path from a user-controllable value

**File:** `app/controllers/profile_controller.ts:239-246`, `app/controllers/account_controller.ts:125-132`,
`app/validators/user_validator.ts:10, 31`
**Issue:** `join(app.publicPath(), user.avatarUrl)` is passed to `unlink`. `avatarUrl` is set by
admins through `createUserValidator`/`updateUserValidator` (`url()` accepts a path-less http
URL and the controller stores it as is) and is never constrained to `/uploads/avatars/`. Any
stored value such as one that resolves outside `public/` makes deletion unlink an arbitrary
file. Admin-only input, so defence in depth, but `unlink` is destructive.
**Fix:** Resolve and verify the path starts with `app.publicPath('uploads/avatars')` before
unlinking, and do not accept free-form `avatarUrl` from the admin forms.

### WR-18: Registration and login hide real failures

**File:** `app/controllers/auth_controller.ts:74-81, 126-129`
**Issue:** `register` has no uniqueness check and wraps user creation, role assignment and login
in one catch that discards the error without logging it; a failure after `User.create` (for
example in `assignRole`) leaves an account with no role, and operators get no trace. In
`login` the catch also covers `auth.login`, `updateLastLogin` and the audit write, so a DB
outage is reported to the user as "Email ou mot de passe incorrect" and audited as a failed
login with the typed email.
**Fix:** Catch only `E_INVALID_CREDENTIALS` around `verifyCredentials`; log and rethrow the
rest. In `register` use a transaction, a unique check, and `logger.error`.

### WR-19: `GradesController.index` reports a wrong `submittedCount`

**File:** `app/controllers/grades_controller.ts:36-42, 63`
**Issue:** `submissions` is already filtered to `status = 'graded'`, so
`submissions.filter((s) => s.status !== 'draft').length` always equals the graded count and
`submittedCount` never counts submitted-but-ungraded work. The course view also preloads
`grader` and then calls `load('grader')` again per submission (duplicate queries), and uses
`any[]`.
**Fix:** Query submissions without the `graded` filter, count `status !== 'draft'` for
`submittedCount`, count graded separately, drop the redundant `load`.

### WR-20: Module and content validators cannot express their own operations

**File:** `app/validators/course_content.ts:29, 46`, `app/controllers/course_contents_controller.ts:256-285`
**Issue:** `updateModuleValidator.parentId` is `optional()` only, so a nested module cannot be
moved back to the root. `metadata: vine.object({})` accepts no keys and silently discards
everything sent. `updateModule`/`updateContent` cannot clear `availableFrom`/`availableUntil`
or `dueDate`. `availableUntil` before `availableFrom` is accepted.
**Fix:** Add `.nullable()` where a value must be clearable, use `vine.object({}).allowUnknownProperties()`
(or a real schema) for `metadata`, and validate date ordering.

## Info

### IN-01: Dead path-traversal check in `FilesController.download`

**File:** `app/controllers/files_controller.ts:51-59`
**Issue:** `normalize(file.storagePath)` collapses `..` segments before the regex test, so the
test can never match and the first check is dead. `resolvePath` already rejects traversal.
**Fix:** Delete the `normalize` and regex lines and rely on `resolvePath`.

### IN-02: No-op `report` override and shadowed `module`

**File:** `app/exceptions/handler.ts:121-123`, `app/controllers/course_contents_controller.ts:100, 245, 295`
**Issue:** `report` only calls `super.report`. Several locals are named `module`, shadowing the
Node global.
**Fix:** Remove the override; rename locals to `courseModule`.

### IN-03: Limiter uses the in-memory store

**File:** `config/limiter.ts` (read for context), `start/limiter.ts`
**Issue:** Counters reset on every restart and are not shared between processes, so the 5/min
login and per-user 2FA locks (15 min) can be cleared by a restart or bypassed by a second
instance.
**Fix:** Use the database or redis store in production, or document single-process deployment.

### IN-04: Test reliability

**File:** `tests/functional/decryption_failures.spec.ts:25-35`, `tests/browser/accessibility.spec.ts`,
`tests/functional/enrollment_counters.spec.ts:27`
**Issue:** The decrypt-audit tests poll for a fire-and-forget write that can land after the
global transaction is rolled back. The accessibility suite logs in with a seeded admin
repeatedly under the 5/min `loginThrottle` and hard-depends on seeders. The counter tests run
serially in one connection, so the "no overbooking under concurrency" guarantee is not
exercised (see CR-06).
**Fix:** Await the audit write in tests (expose a promise), clear the limiter in the a11y
setup, and add a multi-connection concurrency test on a file-based SQLite or PG.

### IN-05: Coverage gaps for the findings above

**File:** `tests/functional/*`
**Issue:** No test covers `user.account.export`, `enrollments.show` props (key leak),
`courses.show` module tree for an unenrolled viewer, instructor PII in serialized props, the
`addPermission` duplicate path, or `webUrl`/slug validation.
**Fix:** Add one regression test per Critical finding when fixing it.

---

_Reviewed: 2026-10-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
