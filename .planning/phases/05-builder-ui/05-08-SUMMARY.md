---
phase: 05-builder-ui
plan: 08
status: partial (awaiting Task 3 human walkthrough)
subsystem: builder
tags: [a11y, axe, validation, gate]
key-files:
  modified:
    - tests/browser/accessibility.spec.ts
    - .planning/phases/05-builder-ui/05-VALIDATION.md
metrics:
  completed: pending
---

# Phase 05 Plan 08: Builder axe coverage, phase gate, walkthrough (PARTIAL)

Tasks 1-2 are done. Task 3 (`checkpoint:human-verify`, blocking) is waiting for the user's answer. This summary must be completed after that answer.

## Task results

| Task | Commit | Result |
|------|--------|--------|
| 1. axe coverage of the builder page | 46daa07 | New test "course builder has no critical a11y violations". Fixture course for `teacher@edonis.test` with one section holding one content and one empty section, deleted in `finally`. Runs axe in 5 states: at rest, details panel open, actions menu open, "Déplacer vers…" dialog open, "Tout sélectionner" with the bulk bar visible. Typecheck, eslint and prettier pass. |
| 2. Phase gate + VALIDATION | 1495a2e | Node 22: `node ace test unit functional` 339/339 passed; `bun run typecheck` 0; `bun run lint` 0; `bun run check:debt` 0; `bun run build` 0 (SSR and client with dnd-kit); filtered client tsc: 0 errors in builder files. 05-VALIDATION.md: every row has a status, `wave_0_complete: true`, `nyquist_compliant: false`. |
| 3. Walkthrough | — | Awaiting user |

## Axe / browser results

**Not run locally.** 05-02 records `BROWSER_LOCAL: blocked` (Playwright headless shell build 1248 missing). `accessibility.spec.ts`, `builder.spec.ts` and `builder_bulk.spec.ts` have not run anywhere yet. The branch was not pushed, so there is no CI `e2e.yml` result to link. The 11 browser rows of 05-VALIDATION.md are `⬜ not run: <reason>`, so `nyquist_compliant` stays false.

## Deviations from Plan

- The 5 axe runs share one local `check(state)` helper (one `.analyze()` in the source, called 5 times) instead of 5 inline copies. Same tags, filter, log format and per-state assertion message.
- The migration row (05-09 T1) is green on SQLite from the 05-09 evidence. PostgreSQL and MySQL are still pending the CI matrix.

## Pending (to complete after Task 3)

- The user's verbatim answer to the walkthrough, including the content deletion / learner progress answer (single and bulk)
- Gaps for `/gsd:plan-phase 5 --gaps`
- Evidence for the 8 roadmap success criteria (criteria backed only by browser tests stay pending unless a walkthrough step is approved)
- The CI e2e result, once a run exists
- Candidate todo: no UI link leads to `/courses/:id/builder` (pre-existing, out of scope for phase 5)
