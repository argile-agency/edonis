---
phase: 02-security-correctness-hardening
plan: 08
subsystem: auth
tags: [2fa, recovery, admin, cli, audit, rate-limiting, docs]
requires:
  - phase: 02-01
    provides: shieldApiClient().withCsrfToken(), tests/functional/helpers/factories.ts
  - phase: 02-03
    provides: pending 2FA state (10 min / 5 attempts), twoFactorThrottle, two_factor.spec.ts
provides:
  - TwoFactorAdminService.reset(user)
  - POST /admin/users/:id/two-factor/reset (users.two-factor.reset), admin-only, throttled, audited
  - node ace user:reset-2fa <email> break-glass command
  - docs/TWO_FACTOR_RECOVERY.md
affects: [02-07 (doc references user.2fa.decrypt_failed / PII_DECRYPT_STRICT), 02-12 (users_controller)]
tech-stack:
  added: []
  patterns:
    - "Privileged 2FA reset via a static service shared by HTTP and CLI; caller owns the audit row"
    - "Audit rows for credential resets carry no oldValues/newValues (no PII copy)"
key-files:
  created:
    - app/services/two_factor_admin_service.ts
    - commands/user_reset_two_factor.ts
    - docs/TWO_FACTOR_RECOVERY.md
  modified:
    - app/controllers/users_controller.ts
    - start/limiter.ts
    - start/routes.ts
    - inertia/pages/users/show.tsx
    - docs/USER_MANAGEMENT.md
    - tests/functional/two_factor.spec.ts
decisions:
  - "Admin 2FA reset throttle: 5/min per acting admin (key admin_<id>), 5-minute block, IP fallback"
  - "CLI break-glass audits with userId null and action cli.user.2fa.reset; prints only user_id"
  - "Per-user 2FA challenge 429 test pre-exhausts the two_factor_2fa_user_<id> key through the limiter API so the 429 cannot come from the per-IP loginThrottle"
metrics:
  duration: ~35min
  completed: 2026-10-13
  tasks: 2
  files: 9
---

# Phase 2 Plan 08: 2FA Recovery Path Summary

Admins can now reset a locked-out user's 2FA from the user page (admin-only, 5/min throttle, audited as `admin.user.2fa.reset` with no PII). Operators get an audited `node ace user:reset-2fa <email>` for the case where no admin can log in. The French `docs/TWO_FACTOR_RECOVERY.md` covers the user, admin, operator and APP_KEY-rotation paths.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Admin 2FA reset (service, endpoint, throttle, route, button) and tests; spec moved to `.withCsrfToken()` | `976a5e9` (conversion), `c824440` (RED), `2e8f83d` (GREEN) |
| 2 | `user:reset-2fa` break-glass command, recovery guide, USER_MANAGEMENT checkbox | `b3ef278` |

## Implementation notes

- **Confirmed ace `args` API:** `import { BaseCommand, args } from '@adonisjs/core/ace'` re-exports `@adonisjs/ace`. The signature is `args.string<Type = string>(options?: Partial<Omit<StringArgument<Type>, 'type'>>)` (`node_modules/@adonisjs/ace/build/src/decorators/args.d.ts`). Usage: `@args.string({ description: 'User email' }) declare email: string`. Commands in `./commands` are auto-scanned, so `adonisrc.ts` needed no change.
- **Production invocation:** run `cd build && node bin/console.js user:reset-2fa utilisateur@exemple.fr`. `bin/console.ts` exists and compiles to `build/bin/console.js`. In dev, run `node ace user:reset-2fa <email>`.
- **CLI behaviour:**
  - The email is lower-cased and trimmed before lookup.
  - Unknown email: logs `User not found` and exits 1.
  - 2FA not enabled: logs an info line and exits 0 with no change.
  - Otherwise it resets, then audits.
  - Smoke-tested on a throwaway migrated SQLite DB: the unknown email exited 1 (not a missing-table error). A 2FA-enabled user was reset (`two_factor_enabled=0`, secret null) and produced an audit row `user_id=NULL, action=cli.user.2fa.reset, resource_id=1, old_values=NULL`. The DB was deleted afterwards.
- **Spec conversion:** `two_factor.spec.ts` moved from 02-03's spec-local `withCsrf` helper (`csrf` package) to the shared `.withCsrfToken()`. The 02-03 test count is unchanged at 5, and all 5 pass with identical assertions. Writes use the `csrf.spec.ts` pattern `const request = client.post(route(...)).withCsrfToken()`, which keeps `client.post(` on one line. This makes the plan's grep gate meaningful: there are 10 `withCsrfToken()` calls for 10 `client.post(` lines, and a stricter `\.(post|put|patch|delete)\(` count is also 10.
- **Extra test (orchestrator note from 02-03):** `challenge throttle is keyed per pending user (2fa_user_<id>)` was added to the existing pending-login group, which already clears the limiter. It proves the per-user key directly instead of inferring it from a 429:
  - one real request leaves `two_factor_2fa_user_<other>` with `remaining === 4`, which confirms the middleware's key format `<limiterName>_<usingKey>`
  - the target's per-user key is then exhausted through `limiter.use({5, '1 minute', '15 minutes'}).consume`, and the next request for that user returns 429 even though the per-IP `loginThrottle` has seen only one request
  - a different pending user from the same IP still gets 302
- **`limiter.clear()` count** in the spec went from 1 to 2. The new `Two-factor - admin reset` group has its own `group.each.setup`.
- **Test isolation:** `@japa/api-client` reads `process.env.HOST`/`PORT`, and `config/database.ts` reads `DB_FILENAME`. Every functional run used `PORT=3408 DB_FILENAME=./tmp/test-02-08.sqlite3`. Vite logged `Port 24678 is already in use` on the first run (the user's dev server), but tests ran normally, so no serialization was needed.

## Verification

- `node ace test functional --files tests/functional/two_factor.spec.ts`: 9/9 pass (5 from 02-03 + 1 throttle + 3 admin-reset).
- Wave gate, full functional suite (`PORT=3408 DB_FILENAME=./tmp/test-02-08.sqlite3 node ace test functional`): 34/34 pass, exit 0.
- `node ace list | grep user:reset-2fa` shows one match. `node ace user:reset-2fa --help` exits 0.
- `bun run typecheck` and `bun run lint` exit 0.
- Grep gates:

  | Check | Result |
  |-------|--------|
  | `from 'csrf'` / `withCsrf(` in the spec | 0 |
  | `admin.user.2fa.reset` in the controller | 1 |
  | `serialize()` in `resetTwoFactor` | none |
  | `twoFactorResetThrottle` in `routes.ts` | 2 |
  | `two-factor/reset` in `show.tsx` | 1 (conditional on `user.twoFactorEnabled`) |
  | `cli.user.2fa.reset` in the command | 1 |
  | unchecked 2FA box in `USER_MANAGEMENT.md` | 0 |

- `docs/TWO_FACTOR_RECOVERY.md` is 82 lines long. It contains all required literals: `user:reset-2fa`, `admin.user.2fa.reset`, `cli.user.2fa.reset`, `user.2fa.decrypt_failed`, `10 minutes` (ASCII space), `pii:scan`, `PII_DECRYPT_STRICT`, `APP_KEY`.

## Deviations from Plan

### Auto-fixed / additions

1. **[Rule 2 - Missing coverage] Per-user 2FA challenge 429 test.** This was requested by the orchestrator because 02-03 had not covered the `2fa_user_<id>` limiter key. It was added to the existing 02-03 group without changing any existing test's assertions. Commits `c824440` (test) and `2e8f83d`.
2. **TDD commit split.** The plan named a single `feat(users)` commit for Task 1. Because the task is `tdd="true"`, it was split into a conversion commit (`test(02-08)`, green), a RED commit (`test(02-08)`; the spec failed with `Cannot find module two_factor_admin_service`), and the GREEN `feat(users): let admins reset a user's two-factor authentication`.
3. **Routes import line.** Adding `twoFactorResetThrottle` pushed the `start/routes.ts` limiter import past the Prettier width, so it is now a multi-line named import. The content is unchanged apart from the new name.
4. **Command docblock** does not repeat the literal `cli.user.2fa.reset`, so the acceptance count of exactly 1 holds.

## Pre-existing findings (left untouched)

- `inertia/pages/users/show.tsx`: the "Désactiver le compte" / "Activer le compte" buttons in the Actions card are no-op stubs; their `onClick` only contains comments. They were left as-is per the plan. The working pattern is `users/index.tsx` (`router.delete` / `router.post`).
- `UsersController.store/update/forceDestroy` still pass `user.serialize()` as audit `oldValues`/`newValues`, which copies decrypted PII into `audit_logs`. This was already known as out of scope, and the new endpoint does not repeat it.
- When the RED spec failed to load (missing module), `node ace test` hung after printing the error instead of exiting. The two orphaned processes in this worktree were killed by PID. This is worth knowing for future RED runs that fail on imports.

## TDD Gate Compliance

RED `c824440` (test) came before GREEN `2e8f83d` (feat). No refactor commit was needed.

## Threat Flags

None. The new surface (admin reset endpoint, CLI) is covered by T-02-36..40 in the plan's threat model.

## Self-Check: PASSED

- FOUND: app/services/two_factor_admin_service.ts, commands/user_reset_two_factor.ts, docs/TWO_FACTOR_RECOVERY.md
- FOUND commits: 976a5e9, c824440, 2e8f83d, b3ef278
