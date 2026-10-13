---
phase: 02-security-correctness-hardening
plan: 07
subsystem: security / users PII / 2FA
tags: [pii, encryption, decryption, 2fa, audit, env-flag, DEBT-08]
requires:
  - "02-01 (shieldApiClient registered in tests/bootstrap.ts, tests/functional/helpers/factories.ts)"
  - "02-02 (widen migration, node ace pii:scan, tests/functional/pii.spec.ts)"
provides:
  - "DecryptionException (status 500, code E_PII_DECRYPTION_FAILED, generic message)"
  - "EncryptionService.isStrict() + decrypt(value, { column, id }): logs, then raises (strict) or returns null (default); never the raw value"
  - "PII_DECRYPT_STRICT optional boolean env var, default off, documented in .env.example with the release ordering"
  - "SilentAuthMiddleware rethrows DecryptionException (no silent logout)"
  - "TwoFactorService logs + audits user.2fa.decrypt_failed for secret and recovery_codes"
affects:
  - "02-08 (APP_KEY rotation recovery doc: every 2FA user then shows up as user.2fa.decrypt_failed)"
  - "Operators: PII_DECRYPT_STRICT must be enabled per environment after a clean pii:scan to finish DEBT-08"
tech-stack:
  added: []
  patterns:
    - "Env flag read per call (env.get inside the method), never cached at import, so env.set in tests and ops changes take effect immediately"
    - "Fire-and-forget audit from a sync method via `void` on a wrapper that never rejects"
    - "Sinon-free logger spy: swap logger.error on the imported singleton, restore in finally"
key-files:
  created:
    - app/exceptions/decryption_exception.ts
    - tests/unit/encryption_service.spec.ts
    - tests/functional/decryption_failures.spec.ts
  modified:
    - app/services/encryption_service.ts
    - app/models/user.ts
    - start/env.ts
    - .env.example
    - app/middleware/silent_auth_middleware.ts
    - app/services/two_factor_service.ts
    - tests/functional/pii.spec.ts
decisions:
  - "Task 1 (Q1) checkpoint answered SKIP: no production checks were run. PII_DECRYPT_STRICT ships default off and must stay unset/false in production until a clean production pii:scan and the sql_mode / 20-char length checks are recorded."
  - "isStrict() accepts both boolean true and the string 'true', because env.set stores strings."
  - "The 2FA path does not consult PII_DECRYPT_STRICT: it always fails closed (returns false) and always logs + audits."
  - "pii.spec.ts write call split into `const request = client.post(...).withCsrfToken()` + `request.loginAs(...)...form(...)` so the client.<verb>( call stays on one line after prettier and the withCsrfToken >= verb-count gate is not vacuous."
metrics:
  duration: "~20 min (continuation; Task 1 checkpoint handled by previous executor)"
  completed: 2026-10-13
  tasks: 3
  files: 10
---

# Phase 2 Plan 07: PII and 2FA decryption failures become loud Summary

A PII decryption failure is now always logged with its column, user id and length. The value itself is never logged and the raw cell is never handed to the app. What happens next depends on `PII_DECRYPT_STRICT`:
- Unset or `false` (the default): the field reads as `null`.
- `true`: a typed `DecryptionException` is raised. Silent auth rethrows it, so the user gets a 500 page instead of a silent logout.

2FA secret and recovery-code decryption failures are logged and audited as `user.2fa.decrypt_failed`, and the code is still rejected.

## Task 1 (Q1 checkpoint): the user's answer, recorded

The user does not yet understand what the production checks involve and answered **"SKIP pour le moment"** ("SKIP for now").

| Check | Result |
|---|---|
| Production `SELECT @@sql_mode;` (MariaDB, demo.edonis.org) | **NOT verified** |
| Production phone / mobile_phone length query (20-character truncation check) | **NOT run** |
| Production `node ace pii:scan` | **NOT run** (not yet run) |
| Remedy for legacy-plaintext / undecryptable rows in production | **None chosen** |
| Consent for `node ace pii:scan --fix` or `--null-undecryptable` | **None given, for any environment.** Neither flag was run anywhere during this plan. |
| Dev `node ace pii:scan` (read-only, no flags, dev Postgres `localhost:54322`) | `ok=0 legacy-plaintext=0 undecryptable=0 empty=16`, exit 0. **Dev is clean.** (Obtained with the checkpoint answer, before this continuation; not re-run by this executor.) |

**Correction to 02-02-SUMMARY.md:** 02-02 reported the dev PostgreSQL as unreachable because it tried port `5432`. The dev database listens on port **`54322`** (the Supabase local port, as in `.env.example`'s commented Supabase block). The scan above was run against `54322`.

**Unmet must-have:** the plan's first truth ("The production sql_mode and existing phone/mobile_phone lengths were checked by the user before any raise code was written") is **NOT met**. It is a deferred precondition, not a satisfied one. The code is safe to merge and deploy only because the raise is gated by `PII_DECRYPT_STRICT`, which defaults to off. **`PII_DECRYPT_STRICT` must stay unset or `false` in production until three things are recorded: a clean production `pii:scan`, the production `sql_mode`, and the 20-character length check.** `.env.example` states the same rule.

**DEBT-08 status:** the code side is complete. **DEBT-08 itself is complete only once strict mode is enabled per environment, after that environment's `pii:scan` is clean.** Until then, the delivered guarantee is "logged, never returned raw", not "raises".

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | Q1 production checks (human-action checkpoint) | none. The answer was SKIP, recorded above |
| 2 | `DecryptionException`, `PII_DECRYPT_STRICT`-gated `EncryptionService.decrypt`, `User` consume with column/id | `e4d042d` fix(security) |
| 3a | `pii.spec.ts`: from the spec-local `withCsrf` to the shared `.withCsrfToken()` | `355c1aa` test(security) |
| 3b | Silent-auth rethrow, `TwoFactorService` log + audit, functional spec | `1c480e1` fix(security) |

TDD: both RED states were observed locally before implementing, and were not committed separately:
- the unit spec failed to import the missing `#exceptions/decryption_exception`
- the functional spec got `expected 302 to equal 500` on the strict test, which shows the old silent logout, and found no audit rows for the 2FA tests

## Confirmed facts

- **Lucid `consume` signature** (`node_modules/@adonisjs/lucid/build/src/types/model.d.ts:132`): `consume?: (value: any, attribute: string, model: LucidRow) => any`. The model is passed, so all four PII columns use `consume: (value: string | null, attribute: string, model: LucidRow) => EncryptionService.decrypt(value, { column: attribute, id: model.$primaryKeyValue })`. `attribute` is the model property name (for example `phone` or `mobilePhone`).
- **`env.set` behaviour** (`node_modules/@adonisjs/env/build/src/env.d.ts:82-98`): `set(key, value: string)` stores the value without casting. After `env.set('PII_DECRYPT_STRICT', 'true')` the getter returns the string `'true'`, so `isStrict()` treats both `true` and `'true'` as on and everything else as off. Specs restore the flag with `env.set('PII_DECRYPT_STRICT', String(previous ?? 'false'))`. After the first toggle in a process, the "unset" state therefore becomes `'false'`, which behaves the same. The unit spec's "default (flag unset)" test is first in its group and asserts `env.get(...) === undefined` as a precondition.
- **Test isolation:** `PORT=3407 DB_FILENAME=./tmp/test-02-07.sqlite3` was honoured; the test server used 3407 and the DB was deleted afterwards. Vite logged `WebSocket server error: Port 24678 is already in use` on every run (the user's dev server holds it). The warning is not fatal and every suite passed, so no serialization was needed.

## RELEASE ORDERING (identical to `.env.example`)

1. Deploy the phone-column widen migration (plan 02-02) and run `node ace pii:scan` in the environment.
2. If it reports legacy-plaintext, run `node ace pii:scan --fix` there (audited, non-destructive) BEFORE deploying the decrypt change. With strict mode off, those fields would otherwise read as empty, and a user's next profile save would overwrite the original.
3. Deploy with PII_DECRYPT_STRICT unset or false. Failures are logged and fields read as empty; nothing raises.
4. Set PII_DECRYPT_STRICT=true in that environment only after its `pii:scan` reports 0 undecryptable rows, or after the approved remedy for those rows was applied.

After an `APP_KEY` rotation, every 2FA user shows up as `user.2fa.decrypt_failed` in the audit log, whatever the flag says. Plan 02-08's doc covers the recovery.

## `PII_DECRYPT_STRICT` per environment at merge time

| Environment | Value at merge | Basis |
|---|---|---|
| Local dev (`.env`) | unset (= off) | `grep -c PII_DECRYPT .env` is 0. Dev scan is clean (`undecryptable=0` on `localhost:54322`), so dev **may** be switched to `true`. It was not changed here, because the executor does not edit real `.env` files. |
| Test suites (`.env.test`) | unset | `.env.test` not edited. Specs toggle the flag with `env.set` and restore it (unit: `finally`; functional: `group.each.teardown`). |
| CI (`.github/workflows/ci.yml`, `e2e.yml`) | unset | `grep -c PII_DECRYPT` is 0 in all workflow files, and no workflow derives `.env` from `.env.example` (no `cp .env.example`), so the unit spec's "flag unset" precondition holds in CI |
| Production (demo.edonis.org) | **must stay unset/false** | No production `pii:scan`, `sql_mode` or length check yet (Task 1 SKIP) |

## `pii.spec.ts` conversion

The spec moved from 02-02's spec-local `withCsrf` helper (which used `import Tokens from 'csrf'`) to the shared `.withCsrfToken()` from `shieldApiClient()`. Both the helper and the `csrf` / `ApiRequest` imports are deleted. Test count is unchanged: **6 before, 6 after**, with identical assertions.

## Verification

- `node ace test unit --files tests/unit/encryption_service.spec.ts`: 6/6 pass. They cover:
  - the unset default returns null
  - null / undefined / '' pass through
  - round-trip in both modes
  - strict on throws `DecryptionException` (code `E_PII_DECRYPTION_FAILED`, status 500, message without the value)
  - strict off returns null
  - exactly one `logger.error` per failure, with `column`, `id`, `length` and `strict` keys, no `value` key, and no input string
- `node ace test functional --files tests/functional/decryption_failures.spec.ts --files tests/functional/pii.spec.ts`: 10/10 pass.
  - Strict on → 500 with `errors/server_error`; strict off → 200 with `dashboard` (`.redirects(0)`, so a silent logout cannot pass vacuously) and a `null` phone.
  - 2FA secret and recovery codes → `false`, plus a `user.2fa.decrypt_failed` audit row with `{ field: 'secret' }` / `{ field: 'recovery_codes' }`.
- Wave gate: `node ace test unit` **20/20**, `PORT=3407 DB_FILENAME=./tmp/test-02-07.sqlite3 node ace test functional` **34/34**. Both exit 0, so `PII_DECRYPT_STRICT=true` does not leak into later specs.
- `bun run typecheck`, `bun run lint`: exit 0. Prettier was run on touched files only.
- Grep gates, all hold:
  - `encryption_service.ts`: `?? value` = 0, `throw new DecryptionException` = 1, `catch` = 0, `PII_DECRYPT_STRICT` ≥ 1
  - `user.ts`: `EncryptionService.decrypt(value, {` = 4
  - `as any` = 0 in both files
  - `start/env.ts`: `PII_DECRYPT_STRICT: Env.schema.boolean.optional()` = 1
  - `.env.example`: has `^PII_DECRYPT_STRICT=false` and `pii:scan`
  - `silent_auth_middleware.ts`: `instanceof DecryptionException` = 1
  - `two_factor_service.ts`: `user.2fa.decrypt_failed` ≥ 1
  - `pii.spec.ts`: `from 'csrf'|withCsrf(` = 0; `withCsrfToken()` (1) ≥ `client.<verb>(` (1)
- Log audit, checked by hand: the `logger.` calls in `encryption_service.ts` log only `column`, `id`, `length` and `strict`. Those in `two_factor_service.ts` log only `userId` and `field`; the audit-write-failure branch adds the DB error message, which carries no secret. The observed log output confirmed this, and the exception report shows only `Unable to decrypt phone`.

## Deviations from Plan

**1. [Rule 3 - Blocking] Kept `client.post(` on one line in `pii.spec.ts` by splitting the chain**
- **Found during:** Task 3, step 0
- **Issue:** prettier breaks the single chained call `client.post(...).withCsrfToken().loginAs(...).redirects(0).form(...)` into `client\n.post(`. The plan's `<verify>` gate (`withCsrfToken()` count ≥ `client.<verb>(` count) then compared 1 ≥ 0 and passed vacuously, against the plan's "keep each `client.<verb>(` call on one line".
- **Fix:** `const request = client.post(route('user.profile.update')).withCsrfToken()`, then `await request.loginAs(user).redirects(0).form({...})`. This is the same shape as `csrf.spec.ts`, and the request and assertions are unchanged.
- **Commit:** `355c1aa`

**2. [Process] Task 1 not performed by the user (SKIP)**
- The blocking Q1 checkpoint was answered with SKIP. The plan explicitly allows production scan counts marked "not yet run" for merge, because the flag defaults off. The sql_mode and length results it asks for verbatim do not exist. They are recorded above as NOT verified, and must-have truth #1 is reported as unmet.

## Notes

- The Vite dev-dependency optimizer ran once during the first test boot ("Re-optimizing dependencies because vite config has changed"). It writes to the shared, symlinked `node_modules/.vite` cache of the main checkout. This is a cache only: no package was installed and no source file in the main checkout was touched.

## Threat model coverage

T-02-31, T-02-32, T-02-33, T-02-35: mitigated as planned and covered by tests. T-02-34 (DoS from raising) is mitigated by the default-off flag. The per-environment opt-in precondition is still open for production. T-02-34b (a null read overwritten on the next profile save) needs `pii:scan --fix` before deploy in any environment with legacy plaintext. Dev has none, and production is unknown, so run the production scan before deploying this plan there.

## Self-Check: PASSED

All created files exist; commits e4d042d, 355c1aa, 1c480e1 present; `.env.test` untouched.
