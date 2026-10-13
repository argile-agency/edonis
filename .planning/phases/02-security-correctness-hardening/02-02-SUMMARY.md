---
phase: 02-security-correctness-hardening
plan: 02
subsystem: security / users PII
tags: [pii, encryption, migration, ace-command, audit, DEBT-08]
requires: []
provides:
  - "users.phone / users.mobile_phone widened to varchar(512) (pg/mysql), guarded down()"
  - "classifyPiiValue() + PII_COLUMNS + PiiScanService.scan({ fix, nullUndecryptable })"
  - "node ace pii:scan [--fix] [--null-undecryptable] with cli.pii.* audit rows"
  - "tests/functional/pii.spec.ts (spec-local withCsrf helper, to be replaced by 02-07)"
affects:
  - "02-07 (takes ownership of pii.spec.ts, converts withCsrf -> .withCsrfToken(), gates PII_DECRYPT_STRICT on a clean scan)"
tech-stack:
  added: []
  patterns:
    - "Dialect-guarded migration: skip knex .alter() on SQLite (table rebuild cascades inside a migration transaction)"
    - "Guarded rollback via this.defer() that refuses to narrow columns holding ciphertext"
    - "Mutations in one db.transaction, audit rows written only after commit"
key-files:
  created:
    - database/migrations/1791898473129_widen_users_pii_columns.ts
    - app/services/pii_scan_service.ts
    - commands/pii_scan.ts
    - tests/functional/pii.spec.ts
  modified: []
decisions:
  - "Skip the phone/mobile_phone ALTER on SQLite: knex rebuilds the table (DROP TABLE users) and cannot disable foreign_keys inside Lucid's migration transaction, so child rows cascade-delete. SQLite does not enforce varchar length, so nothing needs widening there."
  - "The down() length guard runs on every engine (including SQLite) so the rollback contract is identical everywhere."
  - "Scan writes use trx.from('users') inside db.transaction; the read stays db.from('users') (raw, bypassing model consume hooks)."
  - "pii:scan exits 1 while undecryptable cells remain (none remain only after --null-undecryptable)."
metrics:
  duration: "~60 min"
  completed: 2026-10-13
  tasks: 2
  files: 4
---

# Phase 2 Plan 02: Widen PII phone columns + pii:scan Summary

The plan widens `users.phone` and `users.mobile_phone` to `varchar(512)` so they can hold AdonisJS ciphertext (~110 chars). The rollback refuses to truncate ciphertext. It also adds a `node ace pii:scan` command that is report-only by default. The command classifies every encrypted PII cell as ok / legacy-plaintext / undecryptable without printing values. It re-encrypts only with `--fix` and nulls only with `--null-undecryptable`, and every write is audited as `cli.pii.*`.

## Tasks

| # | Task | Commit(s) |
|---|------|-----------|
| 1 | Widen phone / mobile_phone with a guarded rollback, plus profile round-trip test | `75253d6` fix(users) |
| 2 | PiiScanService + `node ace pii:scan` (TDD) | `6e76a40` test (RED), `9cd0d35` feat(security) (GREEN) |

**Migration filename:** `database/migrations/1791898473129_widen_users_pii_columns.ts`

**Dev-DB `pii:scan` counts:** not run. The dev PostgreSQL (`127.0.0.1:5432`) was not reachable from this machine during execution (port closed). The command was instead exercised end-to-end on a throwaway SQLite DB:
- Report-only run: `ok=0 legacy-plaintext=1 undecryptable=1 empty=6`, one line per non-ok cell (`user_id=1 column=phone legacy-plaintext`), no values printed, exit code 1.
- `--fix` run: re-encrypted the plaintext phone (stored length 110). It wrote one audit row: `user_id NULL`, `action cli.pii.reencrypt`, `metadata {"column":"phone","classification":"legacy-plaintext"}`, old/new values NULL. The undecryptable cell was left untouched.

## Verification

- `bun run typecheck`, `bun run lint`: exit 0. Prettier is clean on all touched files.
- `PORT=3402 DB_FILENAME=./tmp/test-02-02.sqlite3 node ace test functional --files tests/functional/pii.spec.ts`: 6/6 pass.
- Wave gate, `PORT=3402 DB_FILENAME=./tmp/test-02-02.sqlite3 node ace test functional`: 10/10 pass (grades + pii).
- `node ace list` shows `pii:scan`. `node ace pii:scan --help` lists `--fix` and `--null-undecryptable`.
- Guarded rollback, checked manually on a throwaway SQLite DB with a user row plus a `social_accounts` child row:
  - With short values: `rollback --step=1` and then `run` both succeed, and the child row survives both.
  - With a 110-char phone: `rollback --step=1` throws `Refusing to roll back widen_users_pii_columns ...`. The phone length stays 110 and the migration stays applied.
- The pg/mysql DDL was rendered via knex `toString()`:
  - pg: `alter column "phone" type varchar(512) using ("phone"::varchar(512))` plus `drop not null`.
  - mysql: `modify phone varchar(512) null, modify mobile_phone varchar(512) null`.
  - The pg narrow (`::varchar(20)`) truncates silently, which confirms the guard is needed.
- CI matrix (pg/mysql/sqlite) run URL: pending. It becomes available once the branch is pushed. That run is the engine proof of the widening, because the SQLite round-trip test passes even without the migration.
- The api-client honours `PORT`: `@japa/api-client` builds `http://${HOST}:${PORT}` from `process.env`, and `config/database.ts` reads `DB_FILENAME`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] knex `.alter()` on SQLite cascade-deleted child rows of `users`**
- **Found during:** Task 1 (FK-safety check on a populated throwaway DB)
- **Issue:** knex implements `.alter()` on SQLite as a table rebuild (`DROP TABLE users` + rename). Lucid wraps each migration in a transaction, where `PRAGMA foreign_keys = OFF` has no effect, and the connection runs with `foreign_keys = ON`. The drop therefore cascade-deleted the `social_accounts` row referencing the user. The empty test DB could never detect this.
- **Fix:** `up()` and the narrowing in `down()` return early on SQLite dialects (`sqlite3`, `better-sqlite3`, `libsql`). SQLite does not enforce varchar length, so no widening is needed there. The length guard still runs on SQLite. `.alter()`, `this.defer` and `throw` all remain in the file.
- **Files modified:** `database/migrations/1791898473129_widen_users_pii_columns.ts`
- **Commit:** `75253d6`

### Environment notes (not code deviations)

- **Node 24 on PATH breaks ace.** Partway through execution the fnm multishell `node` switched to v24.20.0. Every `node ace ...` call then failed with `Invalid command exported from "debug_teacher_courses.js" file. Invalid URL` (jsonschema 1.5.0 `resolveUrl` under Node 24). It also fails in the main checkout, so this is environmental and was not caused by this plan. All later ace and test runs used Node v22.18.0 (`PATH=~/.local/share/fnm/node-versions/v22.18.0/installation/bin:$PATH`). The CI Node version should be checked.
- **Vite HMR port:** every functional run printed `WebSocket server error: Port 24678 is already in use`, because another executor holds Vite's HMR port. It was non-fatal and all suites passed. No config was edited.
- **RED run hang:** the RED run (missing `#services/pii_scan_service` import) failed with a module-resolution error as expected, but the runner process did not exit. It was killed manually.
- **TDD on Task 1:** the round-trip test cannot fail on SQLite before the migration, because SQLite does not enforce varchar length. The plan states this, so Task 1 is a single `fix(...)` commit.
- **Worktree setup:** `node_modules` and `.env` are symlinked from the main checkout (both gitignored, not committed). `tests/bootstrap.ts`, `adonisrc.ts`, `.env.test`, `package.json` and `config/shield.ts` were not touched.

## Deferred Issues (out of scope)

- `ProfileController.update` writes its `user.profile.update` audit row with `oldValues`/`newValues = user.serialize()`. That puts the decrypted phone, mobile phone, address and identification number into `audit_logs` in plaintext. This predates this plan, and a later plan should strip PII fields from that audit payload.

## Threat Model Coverage

- T-02-06: widened to varchar(512). The round-trip test runs on the CI matrix.
- T-02-07: the guarded `down()` was verified to throw and leave ciphertext intact.
- T-02-08: report rows contain only `userId`, `column` and `classification`, and audit metadata contains only `column` and `classification`. No old/new values are written (`grep -c "oldValues\|newValues"` = 0). All of this is asserted by tests.
- T-02-09: `--null-undecryptable` is opt-in, defaults to false, prints a red warning, and is never invoked by any script or task. Only the service-level test exercises the nulling path, against the test DB.
- T-02-10: one `cli.pii.*` audit row per written cell, written after the transaction commits. A report-only run writes none, which is asserted.

## RELEASE NOTE (required by plan 02-07)

1. Deploy this plan and let `migration:run --force` widen the columns.
2. In **each** environment, run `node ace pii:scan` with no flags and keep the output. The deploy does NOT run it automatically.
3. If it reports `legacy-plaintext` cells, run `node ace pii:scan --fix` there. This only re-encrypts the same values and is audited as `cli.pii.reencrypt`. Do this **before** plan 02-07 is deployed. 02-07 makes undecryptable or plaintext cells read as `null` even with `PII_DECRYPT_STRICT` off, so a user's next profile save would overwrite the original value.
4. Set `PII_DECRYPT_STRICT=true` (plan 02-07) in an environment only after its scan reports 0 `undecryptable` rows, or after the user has explicitly approved `--null-undecryptable` for that environment.

## TDD Gate Compliance

- Task 2: RED `6e76a40` (`test(02-02)`) came first and failed on the missing import. GREEN `9cd0d35` (`feat(security)`) followed. No refactor commit was needed.
- Task 1: no RED commit, because the test cannot fail on SQLite (see above).

## Self-Check: PASSED

- FOUND: database/migrations/1791898473129_widen_users_pii_columns.ts
- FOUND: app/services/pii_scan_service.ts
- FOUND: commands/pii_scan.ts
- FOUND: tests/functional/pii.spec.ts
- FOUND: 75253d6, 6e76a40, 9cd0d35
