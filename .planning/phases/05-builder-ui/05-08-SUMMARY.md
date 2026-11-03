---
phase: 05-builder-ui
plan: 08
status: complete
subsystem: builder
tags: [a11y, axe, validation, gate, walkthrough]
key-files:
  modified:
    - tests/browser/accessibility.spec.ts
    - .planning/phases/05-builder-ui/05-VALIDATION.md
  fixes-during-walkthrough:
    - inertia/components/ui/select.tsx
    - inertia/components/ui/dropdown-menu.tsx
    - inertia/components/ui/button.tsx
    - inertia/app/ssr.tsx
    - inertia/pages/courses/show.tsx
    - inertia/components/builder/item-actions-menu.tsx
    - inertia/components/builder/learner-impact.tsx
    - inertia/components/builder/bulk-action-bar.tsx
    - app/controllers/course_bulk_actions_controller.ts
metrics:
  completed: 2026-11-03
---

# Phase 05 Plan 08: Builder axe coverage, phase gate, walkthrough

The user approved the walkthrough on 2026-11-03. Several issues found during the walkthrough were fixed on main before approval (below).

## Task results

| Task | Commit | Result |
|------|--------|--------|
| 1. axe coverage of the builder page | 46daa07, 1e53818 | New test "course builder has no critical a11y violations", 5 states: at rest, details panel open, actions menu open, "Déplacer vers…" dialog open, "Tout sélectionner" with the bulk bar. Typecheck, eslint and prettier pass. **Never executed** (see below). |
| 2. Phase gate + VALIDATION | 1495a2e | 339/339 unit + functional, typecheck, lint, check:debt and build at 0. VALIDATION: `wave_0_complete: true`, `nyquist_compliant: false`. |
| 3. Walkthrough | — | Approved by the user after the fixes below. |

## User's answers (verbatim)

- Walkthrough: « approuvé »
- Content deletion and learner progress: « Avant la suppression définitive de la progression des apprenants, ça va d'abord dans une corbeille, comme il me semble que c'est défini dans les étapes suivantes. Il faut un message indiquant le nombre d'apprenants impactés par la suppression en cas de suppression et une demande de confirmation comme c'est le cas pour la suppression des sections en lot. »
- Entry point to the builder: option C, « Va pour C. »
- Non-empty section delete: keep the rule, make the disabled item look inactive (« Garder la règle, griser mieux »). Content delete works (« Ça marche »).
- Video embeds blocked by the CSP: « b. on attendra » (deferred to Phase 8, todo filed).

## Fixes made during the walkthrough (on main)

| Commit | Issue found by the user | Fix |
|--------|-------------------------|-----|
| bd48788 | The content type dropdown in the create dialogs did not open | Select and dropdown menus portal at z-50 under DialogContent (z-[100]); raised to z-[110] in the shared components |
| 45fc2f3 | No way to reach the builder; the course page "Contenu" tab showed fake drag handles | Option C: the tab is a read-only outline with an "Ouvrir l'éditeur de cours" button and an explanation; old create dialogs, fake handles and dead edit/delete buttons removed |
| 60a937f | Console: `asChild` warning and Radix id hydration mismatch | `Button asChild` renders through Radix `Slot`; `ssr.tsx` renders the same tree as `app.tsx` (ConnectivityIndicator, PwaInstallPrompt) |
| 893a2c4 | The disabled "Supprimer" of a non-empty section looked active (orange highlight) | No accent highlight, muted and struck-through label, readable reason, thin focus ring |
| d393afb | Delete confirmations must show the number of affected learners | `POST /courses/:id/builder/delete-impact` (policy `edit`, course-scoped, distinct learners in `content_progresses`, 2 functional tests); both delete dialogs show the count |
| 5512e6c | Vimeo video blocked on the learn page | Deferred to Phase 8: `.planning/todos/pending/2026-11-03-video-embeds-blocked-by-csp.md` |

Environment: a stale test process from a wave-1 agent held the Vite HMR port 24678; it was stopped.

After the fixes: 341/341 unit + functional, typecheck, lint and check:debt at 0.

## Success criteria evidence

| # | Criterion | Evidence |
|---|-----------|----------|
| 1-3 | Drag contents within / between sections, drag sections | User walkthrough (steps 1-2) approved; browser specs written, not run |
| 4 | Add / rename / delete still work | Walkthrough steps 3-5; functional tests (05-04) |
| 5 | Autosave with visible indicator | Walkthrough step 3; save queue unit tests (05-03) |
| 6 | Keyboard equivalents for drag | Walkthrough step 7, menu moves (step 6); axe test not run |
| 7 | Bulk actions in ≤ 3 interactions, one audit row each | Walkthrough steps 10-12; functional tests (05-09) |
| 8 | Bulk actions keyboard-operable | Walkthrough step 13; axe test not run |

## Not verified

- **No browser spec has ever run** (`accessibility`, `builder`, `builder_bulk`): Playwright headless shell build 1248 is missing locally (`./node_modules/.bin/playwright install chromium`) and nothing was pushed, so there is no CI e2e run. Criteria 6 and 8 rest on the walkthrough only.
- PostgreSQL and MySQL: only SQLite locally; the CI matrix will be the first run.

## Open items

- **Trash / soft delete phase is not in ROADMAP.md.** 05-CONTEXT (Deferred Ideas, D-06) says a dedicated phase right after phase 5 should be added. Until it exists, a delete is permanent and the dialogs say so. Asked the user on 2026-11-03 whether to add it now; no answer yet.
- Pointer and touch drags and the 600 ms auto-expand have no automated test (05-07).
