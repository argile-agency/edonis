---
phase: 05-builder-ui
plan: 03
subsystem: builder-ui
tags: [autosave, fetch, csrf, a11y, inertia]
requires: []
provides:
  - "inertia/lib/save_queue.ts: createSaveQueue (pure serial queue, optimistic apply, reverse rollback, retry, dismiss)"
  - "inertia/lib/builder_save_queue.ts: xsrfToken, sendJson, useSaveQueue (beforeunload + Inertia before guard)"
  - "inertia/components/builder/save-status.tsx: SaveStatus indicator"
affects: [05-06]
tech-stack:
  added: []
  patterns: ["pure client core unit-tested by Japa via relative .js import", "fetch with redirect: 'manual' + JSON content-type check"]
key-files:
  created:
    - inertia/lib/save_queue.ts
    - tests/unit/save_queue.spec.ts
    - inertia/lib/builder_save_queue.ts
    - inertia/components/builder/save-status.tsx
  modified: []
decisions:
  - "A7: the pure core stays at inertia/lib/save_queue.ts; the backend Japa runner resolves '../../inertia/lib/save_queue.js' and root tsc compiles it (no fallback to app/helpers needed)"
  - "A4: Inertia 2.3.29 router.on('before', cb) cancels the visit when cb returns false (onGlobalEvent calls event.preventDefault() on a cancelable inertia:before event)"
  - "While a retry list exists, status stays 'error' even if later ops save; it clears only on retry() or dismiss()"
  - "A non-SaveError rejection becomes { kind: 'error', message: 'Erreur inattendue.' } (fixed text, no thrown message leaks to the UI)"
metrics:
  duration: "~20 min"
  completed: 2026-10-31
  tasks: 2
  files: 4
---

# Phase 05 Plan 03: Autosave queue, fetch helper and save indicator Summary

Serial optimistic save queue (pure, unit-tested) with reverse-order rollback and retry, a strict `sendJson` that never reads a CSRF 302, 401, HTML page or network failure as success, a `useSaveQueue` hook with leave guards, and a visible `role="status"` indicator with Réessayer/Recharger outside the live region.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Pure serial save queue core with unit tests | 5be54c3 | inertia/lib/save_queue.ts, tests/unit/save_queue.spec.ts |
| 2 | sendJson, useSaveQueue, SaveStatus | aed575d | inertia/lib/builder_save_queue.ts, inertia/components/builder/save-status.tsx |

## A7 result (module path)

Stub + one-test import check ran first: `node ace test unit --files tests/unit/save_queue.spec.ts` passed and filtered root `tsc` showed no errors. Path used: **`inertia/lib/save_queue.ts`** (no fallback). Task 2 imports it as `./save_queue`; `save-status.tsx` imports the type via `~/lib/save_queue`.

## A4 result (Inertia `before` cancel)

`@inertiajs/core` 2.3.29: `fireBeforeEvent` dispatches `inertia:before` with `cancelable: true`; `router.on` wraps the callback in `onGlobalEvent`, which calls `event.preventDefault()` when the callback returns `false`, and the router aborts the visit. `useSaveQueue` returns `false` after a refused `window.confirm`, only for GET visits whose `pathname + search` differs from the current location. `beforeunload` is also registered. Both are removed when `pending` drops to 0 or on unmount.

## TDD Gate Compliance

RED ran (6/6 failing against the stub) before GREEN (6/6 passing). The plan asked for one `feat` commit for Task 1, so no separate `test(...)` commit exists.

## Deviations from Plan

**1. [Test fix] Relaxed the interleaving assertion in the serial test.** `enqueue` starts the first op's `run` synchronously, so the log reads `apply A, run A, apply B`. The test now checks that both applies happen at once (set membership) and that B runs only after A resolves. This matches the contract, which never required both applies to come before any run.

Otherwise the plan was executed as written.

## Verification

- `node ace test unit`: 34 passed
- `bun run typecheck`: exit 0
- `bun run lint`: exit 0
- Task 2 filtered client tsc: 0 errors in this plan's files (182 pre-existing errors elsewhere)
- learn.tsx untouched

## Known Stubs

None. Wiring into the builder page is 05-06.

## Self-Check: PASSED

- All four created files exist; commits 5be54c3 and aed575d are on the branch.
