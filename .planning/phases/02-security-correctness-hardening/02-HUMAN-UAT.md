---
status: partial
phase: 02-security-correctness-hardening
source: [02-VERIFICATION.md]
started: 2026-10-28T10:30:00Z
updated: 2026-10-28T10:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. CI on PostgreSQL and MySQL/MariaDB
expected: Run the full functional and unit matrix against main on every engine; all 218 tests pass. Phase 2 was only run on SQLite. Watch the `widen_users_pii_columns` migration, the conditional increments in `EnrollmentService` and the `isUniqueViolation` mapping, which are engine-specific.
result: [pending]

### 2. DEBT-08 production gate (skipped by the user at 02-07)
expected: On demo.edonis.org run `SELECT @@sql_mode;`, the phone/mobile_phone length query, then `node ace pii:scan` (and `--fix` for legacy plaintext). No undecryptable rows and a known sql_mode. Only after a clean scan set `PII_DECRYPT_STRICT=true`; until then it stays off (the shipped default).
result: [pending]

### 3. Browser accessibility suite
expected: `node ace test browser tests/browser/accessibility.spec.ts`, including the `errors/forbidden` 403 page, reports no critical or serious axe violations. Port 3333 is held by the dev server, so stop it or use another port.
result: [pending]

### 4. Enrolment and course pages in a browser after the props contract changed
expected: As a student on a key-method course, `/courses/:id/enroll` renders the key form (driven by `requiresKey`) and enrolment with the key works. As an enrolled student, `/courses/:id` renders for a learner without the module tree (learners use the outline and learn routes).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
