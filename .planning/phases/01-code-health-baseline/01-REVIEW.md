---
phase: 01-code-health-baseline
reviewed: 2026-10-13T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - .env.example
  - .env.test
  - .github/workflows/ci.yml
  - app/controllers/course_contents_controller.ts
  - app/controllers/dashboard_controller.ts
  - app/exceptions/handler.ts
  - app/models/assignment.ts
  - app/models/bulk_enrollment_log.ts
  - app/models/cohort.ts
  - app/models/course.ts
  - app/models/course_category.ts
  - app/models/course_content.ts
  - app/models/submission.ts
  - app/models/user.ts
  - eslint.config.js
  - package.json
  - tests/bootstrap.ts
  - tests/functional/grades.spec.ts
  - tests/unit/course.spec.ts
findings:
  critical: 0
  warning: 8
  info: 4
  total: 12
status: issues_found
---

# Phase 1: Code Review Report

**Depth:** standard
**Note:** the reviewer agent could not write this file itself; the orchestrator saved its report verbatim.

## Summary

The reviewer ran `bun run lint`, `bun run typecheck`, `node ace test unit` (5/5) and `node ace test functional` (4/4, 35 migrations applied and reverted). All pass. The findings below are behaviour and robustness gaps that the green gates do not catch.

The cast removals are type-safe, and the `pojo()` change in `course_contents_controller.ts` is a real fix. Lucid's `ModelQueryBuilder.max()` returns model instances, so `maxOrder` landed in `$extras`. The old `(x[0] as any)?.maxOrder` was therefore always `undefined`, and every new module or content item got `order = 1`. `order` is an `integer` column, so there is no string-concatenation risk. The `Assignment.module` foreignKey fix is also correct: Lucid's default would have been `courseModuleId`, and the column is `moduleId`.

The main concerns are:
- `canEnroll()` now has a one-day boundary error on `endDate`, and its result is only advisory.
- The 429 `retryAfter` handling can never work.
- The test-isolation guard is weaker than its error message implies.
- The CI "gate" changes leave the summary job non-enforcing and silently rename the status checks.

## Warnings

### WR-01: `canEnroll()` closes enrollment at the start of `endDate`, not the end

**File:** `app/models/course.ts:272-278`

**Issue:**
- `startDate` and `endDate` are `@column.date()`, so Lucid hydrates them as midnight-local `DateTime`s.
- `this.endDate < DateTime.now()` is true for the whole of the end date. The last day is excluded.
- Before the fix the old code was always-invalid and never blocked anything. Now a course with `endDate = today` shows `canEnroll: false` all day.
- `tests/unit/course.spec.ts` uses ±7 days, so it cannot catch this.

**Fix:**
```ts
if (this.endDate && this.endDate.endOf('day') < now) return false
```
Add a unit test with `endDate = DateTime.now().startOf('day')` expecting `true`.

> Orchestrator note: the operator was offered this exact change at the 01-02 checkpoint ("approved + make end date inclusive") and chose plain "Approved". Treat as an open follow-up, not a defect against the approved decision.

### WR-02: The `canEnroll()` date window and capacity checks are never enforced server-side

**File:** `app/models/course.ts:262`, `app/controllers/enrollments_controller.ts:61,152,219`

**Issue:**
- `Course.canEnroll()` is only called from `Course.serialize()`, as a UI flag.
- The enrollment endpoints check only `method.isAvailable()`, the enrollment method's own availability.
- `allowEnrollment`, `maxStudents`, `status` and the course date window are not checked in `app/controllers` or `app/services`. A direct POST bypasses them.
- The phase fixed `canEnroll()`, but the fix changes the button state only.

**Fix:** In each enroll path (self, key, request), load the course and reject with 403 or 422 when `!course.canEnroll()`. Add a functional test that posts an enrollment to an ended course.

> Orchestrator note: this is exactly Phase 2 plan 02-05 (AS4, behind a human checkpoint).

### WR-03: `retryAfter` on the 429 page can never be populated

**File:** `app/exceptions/handler.ts:61-64`

**Issue:**
- The handler reads `error.headers['retry-after']`, lowercase.
- The limiter's `ThrottleException` only sets `headers` via `setHeaders()`. Otherwise `headers` is undefined and `getDefaultHeaders()` is computed at render time with the key `"Retry-After"` (capitalized).
- Either way the lookup is `undefined`, so the page always shows "quelques instants". The new `hasHeaders` guard typed this dead path without fixing it.
- `|| undefined` also turns a genuine `0` into `undefined`.

**Fix:** Use the exception's own API, for example:
```ts
retryAfter: error instanceof errors.E_TOO_MANY_REQUESTS ? error.response.availableIn : undefined
```
`errors` comes from `@adonisjs/limiter`. Alternatively, do a case-insensitive header lookup.

### WR-04: The test guard only checks `NODE_ENV`, but the functional teardown drops the schema

**File:** `tests/bootstrap.ts:43-51,64-70`

**Issue:**
- The functional suite's `testUtils.db().migrate()` reverts all migrations on teardown (`Reverted 35 migrations`).
- The guard only asserts `NODE_ENV === 'test'`. `bin/test.ts` forces that unconditionally, so the check can never fire.
- A real shell or process environment (`DB_CONNECTION=postgres`, `DB_DATABASE=...`, from direnv, docker or CI-style exports) overrides `.env.test`. The suite would then drop that database's schema.
- The comment and error message imply that `.env.test` isolates the database. It does not.

**Fix:** Also assert the target. At minimum, refuse unless `DB_CONNECTION === 'sqlite'`, or the database name matches `/test/i`, or `CI === 'true'`.

### WR-05: CI "enforce gates" is incomplete: the summary job never fails, and job renames break required checks

**File:** `.github/workflows/ci.yml:76-78,~178-192`

**Issue:**
- The `summary` job has `if: always()` and only echoes. It is green even when `tests` or `lint` fail.
- If branch protection or a ruleset uses `CI Summary` as the single required check, nothing is actually gated.
- `unit-tests` was renamed to `tests`, so the check names change from `Unit Tests (postgres|mysql|sqlite)` to `Tests (...)`. Any required-status-check configuration referencing the old names now waits forever, or is silently unsatisfied.
- `bun audit || true` stays fully non-blocking.

**Fix:** Make the summary job fail on any non-success:
```yaml
- run: |
    [ "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}" = "false" ]
```
Update the required-check names in repo settings, and call out the rename in the phase notes.

### WR-06: `getFullPath` can throw or loop forever, and the removed cast hid it

**File:** `app/models/course_category.ts:74-80`

**Issue:**
- `current = current.parent` is typed non-null by the relation type.
- If `parentId` points to a missing or soft-deleted row, `parent` is `null` and the next line throws `TypeError: Cannot read properties of null (reading 'slug')`.
- A parent cycle loops forever, since the loop keeps loading parents.
- The behaviour is unchanged from before, but `as any` used to flag the unsoundness and the annotation now hides it.

**Fix:**
```ts
const seen = new Set<number>()
while (current.parentId && !seen.has(current.id)) {
  seen.add(current.id)
  await current.load('parent')
  if (!current.parent) break
  current = current.parent
  parts.unshift(current.slug)
}
```

> Orchestrator note: Phase 2 plan 02-06 already plans a bounded `getFullPath` (DEBT-07).

### WR-07: `.env.test` omits `PORT` and `HOST`, so the test env is not self-contained

**File:** `.env.test`, `start/env.ts:15-17`

**Issue:**
- `PORT` (number) and `HOST` (host format) are required in the env schema, and `.env.test` sets neither. A fresh clone with no `.env` fails env validation on `node ace test`.
- `.env.test` also inherits `PORT` from the dev `.env`. The in-process test server then collides with `bun run dev`, which is what the `.env.example` note works around ("Stop `bun run dev`...").

**Fix:** Add `PORT=3334` and `HOST=localhost` to `.env.test`. That removes the EADDRINUSE caveat and the hidden `.env` dependency.

### WR-08: The main behaviour deltas in this phase have no regression tests

**File:** `tests/unit/course.spec.ts`, `tests/functional/grades.spec.ts`

**Issue:**
- Nothing covers the max-order change in `createModule` / content create (the behaviour flipped from "always 1" to "max+1").
- Nothing covers the 429 or `hasCode` / `hasStatus` handler paths.
- Nothing covers the `Assignment.module` foreignKey fix. The grades test creates no assignments, so `.preload('module')` runs against zero rows and exercises nothing.
- The unit date tests use ±7 days only, so the boundary bug (WR-01) is invisible.

**Fix:**
- Add a functional test that creates two modules and asserts `order` 1 then 2.
- Add a grades test with one published assignment that has a `moduleId`, and assert the preload.
- Add the boundary unit test from WR-01.

## Info

### IN-01: The `const self: X = this` workaround is duplicated four times

**File:** `app/models/user.ts:150,158,178`, `app/models/cohort.ts:44`

The same four-line pattern appears in `user.ts` (three methods) and `cohort.ts`. It exists only to dodge mixin `this` typing, and there is no explanatory comment. Add one comment explaining it, or a small private helper such as `private async ensureRolesLoaded()` in `user.ts`.

### IN-02: The `jsonColumnConfig` dedupe is incomplete, and the shared config is still `any`-typed

**File:** `app/helpers/json_column.ts`, `app/models/course.ts:77-84`, `app/models/app_setting.ts:65-73`, `app/models/role.ts:20-33`

Three models still carry inline copies of the same logic (excluded on purpose in 01-04 because moving them changes behaviour). `app_setting.prepare` has no null guard, so `JSON.stringify(null)` stores the string `'null'`. `course.ts` uses falsy rather than nullish checks. `jsonColumnConfig` itself uses `(value: any)`, and the ESLint ban only matches `as any`. The new imports use relative `../helpers/json_column.js`, while every other import uses `#` subpath aliases. Make the helper generic and add a `#helpers/*` alias.

### IN-03: The ESLint ban on `as any` is easy to bypass

**File:** `eslint.config.js:25-38`

The selector `TSAsExpression > TSAnyKeyword` does not catch `<any>x` (`TSTypeAssertion`) or `as unknown as T` chains. It applies to `app/**/*.ts` only, not `start/`, `config/`, `database/` or `inertia/`. For example, `inertia/pages/errors/too_many_requests.tsx` has `error: any`. Add a `TSTypeAssertion > TSAnyKeyword` selector, widen `files`, or enable `@typescript-eslint/no-explicit-any` as a warning.

### IN-04: `.env.example` has no trailing newline and carries test-env prose

**File:** `.env.example:37-51`

The file lacks a trailing newline, and the test-environment commentary is a long block in a file people copy to `.env`. Move the commentary to `docs/` or a `.env.test` header comment, and add the trailing newline.

---

_Reviewed: 2026-10-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
