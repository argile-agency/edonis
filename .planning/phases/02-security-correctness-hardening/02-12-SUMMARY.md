---
phase: 02-security-correctness-hardening
plan: 12
subsystem: validation
tags: [vinejs, validation, routing, admin, dos, debt-05]
requires: [02-01, 02-03, 02-08]
provides:
  - app/validators/listing.ts (userIndexQueryValidator, auditLogIndexQueryValidator)
  - app/validators/account.ts (passwordConfirmValidator)
  - updateAvatarValidator (vine.file)
  - global numeric route-param matchers (7 params)
affects: [users_controller, audit_logs_controller, profile_controller, account_controller, start/routes.ts]
tech-stack:
  added: []
  patterns:
    - "Query-string validators map '' to null with VineJS .parse() before .optional().nullable()"
    - "Lucid VineJS exists({ table, column }) for FK-like id arrays"
    - "router.where(param, router.matchers.number()) global matchers"
key-files:
  created:
    - app/validators/listing.ts
    - app/validators/account.ts
    - tests/functional/validation_listing.spec.ts
  modified:
    - app/validators/user_validator.ts
    - app/validators/profile_validator.ts
    - app/controllers/users_controller.ts
    - app/controllers/audit_logs_controller.ts
    - app/controllers/profile_controller.ts
    - app/controllers/account_controller.ts
    - start/routes.ts
decisions:
  - "Listing query validators map '' to null via .parse(): bodyparser convertEmptyStringsToNull does not touch query strings"
  - "roleIds uses the Lucid exists({ table: 'roles', column: 'id' }) object form; no controller fallback was needed"
  - "Avatar validation runs before the try/catch so ValidationError is not swallowed by the generic upload-error flash"
metrics:
  duration: 12min (base commit 19:28:23 to SUMMARY commit 19:40:40)
  completed: 2026-10-13
  tasks: 3
  files: 10
---

# Phase 2 Plan 12: Listing, upload and route-param validation Summary

Admin listings now take only bounded, typed filters (`limit` capped at 100, strict `YYYY-MM-DD` dates, numeric `userId`). `roleIds` are checked against `roles.id` with Lucid's `exists` rule. Avatar uploads go through a `vine.file` validator. The account validator moved to `app/validators/account.ts`. Seven global numeric route matchers turn `/courses/abc` into a router-level 404.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Validate users/audit-log listings, existence-check roleIds | c32ac78 |
| 2 | Avatar vine.file rule, account validator move, numeric route matchers | 7f8277b |
| 3 | validation_listing.spec.ts (9 tests) | d2f4d8c |

## Verification

- Gate 2 (`request.only|input|all(`): `users_controller.ts` 0, `audit_logs_controller.ts` 0
- `grep -c "router.matchers.number()" start/routes.ts`: 7. `router.where('provider'`: 0
- `vine.compile` in `account_controller.ts`: 0. `request.file(` in `profile_controller.ts`: 0
- `bun run typecheck` and `bun run lint` exit 0
- Full functional suite (`PORT=3412 DB_FILENAME=./tmp/test-02-12.sqlite3 node ace test functional`): **83 passed**, exit 0
- `validation_listing.spec.ts`: 9 tests. CSRF gate holds (4 `withCsrfToken()` / 4 writes). `assertStatus(500)` count is 0. No Vite manifest was created.
- The Vite `WebSocket server error: Port 24678 is already in use` warning appeared on every run. It was non-fatal: no run failed and none needed serializing.
- Test isolation was checked in source, not only inferred from the absence of collisions:
  - `tests/bootstrap.ts` registers `apiClient()` with no `baseURL` (the `localhost:3333` value belongs to `browserClient`, browser suite only).
  - `@japa/api-client` `request()` (build/index.js:659-661) then builds the base URL from `process.env.HOST` + `process.env.PORT`.
  - `config/database.ts:38` reads `env.get('DB_FILENAME', ...)`, and `.env.test` sets `DB_CONNECTION=sqlite`.
  - So every run used port 3412 and `./tmp/test-02-12.sqlite3`, which was deleted afterwards.

## Verified API signatures

- **Lucid `exists`** (`node_modules/@adonisjs/lucid/build/providers/database_provider.d.ts:47,55`): it takes either `exists(options: VineDbSearchOptions)` (`{ table, column }`) or `exists(callback: (db, value, field) => Promise<boolean>)`. This plan used the object form, `vine.number().positive().exists({ table: 'roles', column: 'id' })`, in both `createUserValidator` and `updateUserValidator`. The controller fallback was not needed.
- **`vine.file`** worked as verified. `vine.file({ size: '2mb', extnames: ['jpg','jpeg','png','gif','webp'] })` typechecks, and at runtime a `.txt` upload is rejected with `inputErrorsBag.avatar` (302, not 500).
- **`router.where(name, router.matchers.number())`** (`http-server/build/src/router/main.d.ts:117`) applies global matchers with cast. `router.match(url, method)` (line 126) is used in the spec to prove the route table rejects `abc`.

## Route param audit (`node ace list:routes`)

All 59 routes using the seven params target integer `increments('id')` primary keys (users, social_accounts, courses, course_categories, course_modules, course_contents, course_enrollments, course_enrollment_methods, course_permissions). No migration uses a uuid PK. The `:provider` routes were deliberately left without a matcher.

```
DELETE /user/social-accounts/:id (user.social-accounts.disconnect)
GET|PUT|PATCH|DELETE /admin/users/:id, GET /admin/users/:id/edit, POST /admin/users/:id/activate,
POST /admin/users/:id/two-factor/reset, DELETE /admin/users/:id/force
GET /grades/courses/:id (grades.course)
GET|PUT|PATCH|DELETE /courses/:id, GET /courses/:id/edit, POST /courses/:id/{publish,archive,permissions}
DELETE /courses/:courseId/permissions/:permissionId (courses.permissions.remove)
GET /courses/:id/{learn,outline,progress,builder,enroll,enrollment-methods,groups}
POST /contents/:contentId/{progress,complete}, PUT|DELETE /contents/:contentId
POST /courses/:id/modules, POST /courses/:id/modules/reorder
PUT|DELETE /modules/:moduleId, POST /modules/:moduleId/contents, POST /modules/:moduleId/contents/reorder
POST /courses/:id/enroll/{key,self,request,manual}
DELETE /enrollments/:enrollmentId (enrollments.unenroll)
POST /courses/:id/enrollment-methods, PUT|DELETE /courses/:id/enrollment-methods/:methodId
POST /courses/:id/{groupings,groups}
POST /admin/courses/:id/{approve,reject,archive}, GET|POST /admin/courses/:id/participants,
DELETE /admin/courses/:id/participants/:enrollmentId, GET|PUT /admin/courses/:id/settings
GET /admin/categories/:id/{add-child,edit}, PUT|PATCH|DELETE /admin/categories/:id
GET /auth/:provider/redirect, GET /auth/:provider/callback   <- string, no matcher
```

After the matchers were added, `list:routes` showed the same 59 param routes, and every existing spec passes with number-cast params. No controller compared `params.*` as a string; `grades_controller` only passes `params.id` to `where()`.

## Enum adjustments

None. `inertia/pages/users/index.tsx` sends `status` as `active` / `inactive` / `''`, which matches the plan's enum. The audit-log page sends `type="date"` values (`YYYY-MM-DD`) and a free-text `userId`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Empty query-string filters would have been rejected**
- **Found during:** Task 1
- **Issue:** The plan assumed `convertEmptyStringsToNull` turns `''` into `null`, but that bodyparser option only applies to request bodies, not query strings. The users page always submits `?search=&role=&status=`, and a plain `vine.enum([...]).optional().nullable()` rejects `''`. Verified with a standalone VineJS probe. Every filter submission from the UI would have bounced with a validation error.
- **Fix:** Each field in `listing.ts` applies `.parse((v) => v === '' ? null : v)` before `.optional().nullable()`. A regression test (`users.index accepts the empty filters the listing page sends`) asserts 200 for exactly that payload.
- **Commits:** c32ac78, d2f4d8c

**2. [Rule 1 - Bug] Avatar ValidationError would be swallowed**
- **Found during:** Task 2
- **Issue:** `updateAvatar` wraps its body in a `try/catch` that flashes a generic `"Erreur lors de l'upload de l'avatar"`. If validation ran inside the `try`, no `inputErrorsBag.avatar` would be flashed.
- **Fix:** `request.validateUsing(updateAvatarValidator)` runs before the `try`. The `!avatar` and `!avatar.isValid` branches were removed, since the required `vine.file` covers them. The `state !== 'moved'` flash and the generic catch remain.
- **Commit:** 7f8277b

**3. [Plan gate] `grep -c "updateAvatarValidator" profile_controller.ts` is 2, not 1**
- A named import plus its single use are necessarily two lines, because Prettier splits the multi-name import block. The intent of the gate holds: the validator is wired once, and `request.file(` is 0. The literal `= "1"` check in Task 2's `<verify>` fails for this reason only.

**4. [Test harness] users.store payloads are sent as JSON**
- The urlencoded `.form()` serializer flattened `roleIds: [n]` to a scalar, producing "must be an array". The spec sends `.json()`, the same as the Inertia form does. A non-Inertia JSON validation failure still redirects back (302) with `inputErrorsBag['roleIds.0']`.

**5. [Test hardening] Extra assertions beyond `<behavior>`**
- The 404 test also asserts `router.match('/courses/abc', 'GET')` is `null` and `/courses/1` resolves to `courses.show`. On SQLite, `where id = 'abc'` already 404'd via `firstOrFail`, so the HTTP 404 alone would not prove the matcher.
- The account-delete test also asserts that the email is unchanged, because deletion anonymizes rather than removing the row.
- The audit-log test also echoes `dateTo` and checks `userId: ''`.

## Out-of-scope notes

- The **ProfileController plaintext-PII audit issue** (`update` writes decrypted phone/address/ID into `audit_logs`, see 02-02 SUMMARY) was **not** addressed. This plan only touched `updateAvatar`, whose audit entry carries no old or new values.
- `account_controller.exportData` was not touched, per the plan.

## TDD Gate Compliance

Task 3 is `tdd="true"`, but Tasks 1–2 implement the behaviour before the spec exists, by design of the plan. A true RED commit was therefore not possible, and none was faked. The gate sequence in git is `fix` (c32ac78), `fix` (7f8277b), then `test` (d2f4d8c).

## Threat Mitigations

| Threat | Mitigation | Test |
|---|---|---|
| T-02-54 | `limit` min 1 / max 100 | `limit=1000000` → 302 + `inputErrorsBag.limit` |
| T-02-55 | `vine.date` YYYY-MM-DD, `vine.number().positive()` userId | `dateFrom=notadate`, `userId=abc` → 302 + field key |
| T-02-56 | 7 global `router.matchers.number()` | `/courses/abc` → 404 `errors/not_found`, `router.match` null |
| T-02-57 | `vine.file({ size: '2mb', extnames })` | `.txt` → 302 + `inputErrorsBag.avatar`, avatar unchanged |
| T-02-58 | `exists({ table: 'roles', column: 'id' })` | `roleIds: [999999]` → `inputErrorsBag['roleIds.0']`, no user created |

## Self-Check: PASSED

Checked with `ls` and `git log`:
- FOUND (ls): app/validators/listing.ts, app/validators/account.ts, tests/functional/validation_listing.spec.ts, this SUMMARY
- FOUND (git log): c32ac78, 7f8277b, d2f4d8c, afcd323 (initial SUMMARY commit)
- REQUIREMENTS.md was not touched. DEBT-05 is shared with other plans in this wave, so marking it complete is left to the orchestrator.
