---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready_to_plan
stopped_at: Phase 04 complete (1/1) — ready to discuss Phase 5
last_updated: 2026-10-19T16:19:34.454Z
last_activity: 2026-10-19
progress:
  total_phases: 12
  completed_phases: 2
  total_plans: 20
  completed_plans: 6
  percent: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-03)

**Core value:** Easy course creation with seamless Moodle migration
**Current focus:** Phase 5 — builder ui

## Current Position

Phase: 5
Plan: Not started
Status: Ready to plan
Last activity: 2026-10-19

Next recommended run: `/gsd:execute-phase 2` (planned, 14 plans; Phase 5 depends only on Phase 4
and can be discussed/planned in parallel)

Open items from Phase 1: `01-HUMAN-UAT.md` (2 pending) — deliberately-red PR and required-check
names. Green CI on postgres/mysql/sqlite proven 2026-10-19 (push run of e4f777d).

Open items from Phase 4: `04-HUMAN-UAT.md` test 2 skipped — storage persistence across a redeploy,
re-test at first deployment with `CONTENT_STORAGE_PATH` on persistent storage. Out-of-scope
observations OBS-03 (legacy `file_url` seed data → Phase 7) and header dropdown hydration/`asChild`
warnings remain open; OBS-01/02/04 fixed.

Progress (12-phase roadmap): [##........] 17% (2/12 phases)

> **Important:** the 0% figure measures the *content milestone roadmap only*.
> The product itself is substantially built — see "Codebase Reality Check" below.
> Do not assume a greenfield codebase when planning.

## Codebase Reality Check

*Verified 2026-10-09 by direct inspection of the working tree.*

### Shipped and working

| Domain | State |
|---|---|
| Auth | email/password, 2FA TOTP, OAuth Google + GitHub, rate limiting |
| Authorization | RBAC (admin/manager/teacher/student) via `role_middleware`, `course_permission` model |
| Courses | CRUD, categories (tree), modules, contents, outline, learn view |
| Enrollments | multiple methods, requests, cohorts, groups, groupings, bulk import |
| Assessment | assignments with rubrics, submissions, gradebook with grade categories |
| Admin | app settings, menus/menu items/locations, audit logs, user management |
| Compliance | GDPR (consent versioning, export, account deletion), PII encryption |
| Platform | PWA, a11y (jsx-a11y + axe-core), CSP, multi-tenancy, multi-DB (PG/MySQL/MariaDB/SQLite) |
| CI/CD | GitHub Actions: CI, E2E, code quality, CodeQL; Infomaniak deployment documented |

Scale: 25 Lucid models, 16 controllers, 31 migrations, ~99 commits.

### Already built, contrary to roadmap assumptions

The roadmap was written as if phases 2 and 7 were greenfield. They are not:

- `app/controllers/course_contents_controller.ts` (522 lines) already implements
  `builder`, `learn`, `outline`, module CRUD, content CRUD, `reorderModules`,
  `reorderContents`, `updateProgress`, `markComplete`, `getCourseProgress`.

- Routes for all of the above are wired in `start/routes.ts` (lines ~292–345).
- `inertia/pages/courses/builder.tsx` (454 lines), `learn.tsx`, `outline.tsx` exist.
- `content_progress` model + migration exist.
- `course_content.ts` already declares content types:
  `page | file | video | link | assignment | quiz`.

**Implication for Phase 2 (Builder UI):** it is a *replacement/upgrade*, not a build
from zero. The current builder uses dialog-based forms; reordering endpoints exist
but there is no drag-and-drop UI.

**Implication for Phase 7 (Engagement Tracking):** backend tracking largely exists;
the gap is the teacher-facing completion view and consistent per-content-type
completion triggers.

### Genuinely missing (roadmap still valid here)

- `ContentFile` model and `FileStorageService` — Phase 1 is accurate, nothing exists.
- No `dnd-kit` dependency → no drag-and-drop.
- No `tiptap` (or any WYSIWYG) dependency → Page content is plain.
- No `react-dropzone` / upload pipeline → File content type is non-functional.
- No `.mbz` parsing — Moodle import is entirely unstarted.

### Health signals

- `bun run typecheck` — **passes clean**.
- `bun run lint` — **passes clean** as of `af99ea1` (2026-10-09). The previous
  17 errors were resolved: the 16 `eqeqeq` hits were *all* intentional nullish
  checks (`!= null` / `== null`) in Lucid `prepare`/`consume` column hooks, so
  the fix was the standard `{ null: 'ignore' }` rule option, **not** a rewrite
  to strict equality (which would have dropped `undefined` handling). The
  prettier error was auto-fixed.

- **Refactor opportunity found while fixing lint:** `app/helpers/json_column.ts`
  exports `jsonColumnConfig`, but 8 `@column({ prepare, consume })` blocks
  duplicate it verbatim across `assignment.ts`, `bulk_enrollment_log.ts` (×2),
  `course_content.ts`, `submission.ts` (×3). Byte-identical logic, ~48 lines of
  duplication. Good candidate for a Phase 1 plan — deliberately *not* done as a
  drive-by.

- `as any` occurrences: 16 across 7 files (`handler.ts` ×5, `user.ts` ×3,
  `course.ts` ×2, `course_category.ts` ×2, `course_contents_controller.ts` ×2,
  `cohort.ts` ×1, `dashboard_controller.ts` ×1).

- Tests: 5 Playwright browser specs (`auth`, `grades`, `navigation`,
  `user_management`, `accessibility`). Functional tests are **disabled**
  (`tests/functional/grades.spec.ts.skip`). No unit tests.

- `app/policies/` does **not exist** — authorization is scattered across
  middleware and inline controller checks.

- `app/validators/` covers only 5 domains (auth, course, course_content,
  profile, user) out of 16 controllers.

## Performance Metrics

**Velocity:**

- Total plans completed: 6
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |
| 04 | 1 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: N/A (no completed plans under GSD yet)

*Updated after each plan completion*
| Phase 04 P01 | 11min | 3 tasks | 11 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- 2026-10-09: Tech debt remediation takes priority over the content milestone
  after the ~4-month dormancy. Scope = tiers A (code health), B (stubbed
  features), C (hardening). Tier D (performance: indexes, N+1, role cache) is
  deliberately deferred until there is real traffic to measure.

- 2026-10-09: Tech debt structured as integer phases 1-3 prepended to the
  roadmap, not as a separate milestone. GSD forbids decimal insertion before
  Phase 1, so the content phases were renumbered 1-9 -> 4-12. Safe because zero
  plans had been executed.

- [Phase 04]: 04-01: Content file downloads require auth + per-course authorization (admin, course staff via hasPermission view, or active/completed enrollment on published+available content); orphan files admin-only
- [Phase 04]: 04-01: Content blobs stored outside webroot at storage/content_files/{sha256[0:2]}/{cuid}.{ext}, deduped by UNIQUE checksum; DB stores POSIX relative path

### Roadmap Evolution

- Phase 1 added: Code Health Baseline (tech debt tier A)
- Phase 2 added: Security and Correctness Hardening (tech debt tier C)
- Phase 3 added: Complete Stubbed Features (tech debt tier B)
- Phases 1-9 renumbered to 4-12 (content milestone shifted, no work lost)
- Phase 5 (ex-2, Builder UI) rescoped: upgrade of existing builder, not greenfield
- Phase 10 (ex-7, Engagement Tracking) rescoped: backend already exists, gap is
  per-type triggers + teacher view

- Phase 12 (ex-9, Permissions) now depends on the Phase 2 policy layer

### Pending Todos

- ~~`docs/DEPLOYMENT_TROUBLESHOOTING.md` untracked~~ — reviewed for secrets
  (only placeholders: `<votre-domaine>`, `m0n$Pa#sword` as an escaping example),
  committed 2026-10-09.

- ~~Commit the 2026-10-09 planning restructure~~ — done 2026-10-09.
- ~~Lint quick win~~ — done, `af99ea1`.
- Dedupe the 8 inline JSON column configs onto `jsonColumnConfig` (see Health
  signals). Fold into Phase 1 planning.

### GSD Tooling Notes (2026-10-09)

- Active GSD install: `~/.claude/get-shit-done/` at **v1.42.3** (= npm latest,
  confirmed via `node ~/.claude/get-shit-done/bin/check-latest-version.cjs`).
  This is what the 67 `gsd-*` skills resolve against. No update needed.

- **Resolved:** the second copy at `~/.config/opencode/get-shit-done/` was stale
  at v1.11.1 (old GSD v1 layout). It is now also at **v1.42.3**, so both runtime
  roots are aligned. No divergence left to work around.

- **Correction to an earlier note:** `gsd-sdk` is not missing — in v1.42.3 the CLI
  is `~/.claude/get-shit-done/bin/gsd-tools.cjs`. The workflow docs still use the
  older `gsd-sdk query <x>` naming. Real commands include `phase`, `state`,
  `roadmap`, `requirements`, `milestone`, `progress`. Invoke via
  `node ~/.claude/get-shit-done/bin/gsd-tools.cjs <command>` (not on PATH).
  The 2026-10-09 restructure was done manually but follows the same file formats.

### Blockers/Concerns

Full inventory in `.planning/codebase/CONCERNS.md`. Highest-signal items:

**Functional gaps (features that look shipped but are not):**

- `evaluations_controller.ts` is a stub — returns `pendingEvaluations: []` and
  zeroed stats. Teachers cannot see work awaiting grading.

- Contact form (`inertia/pages/pages/contact.tsx`) has UI but no backend action;
  the route maps to `PagesController.contact` which only renders.

**Correctness / safety:**

- Enrollment counters (`enrolledCount`, `currentEnrollments`) incremented manually
  without transactions — can drift.

- `encryption_service.ts` returns the raw value when decryption fails, silently
  masking corruption.

- Category tree building has no cycle detection — potential infinite loop.
- Input validation coverage incomplete; authorization checks not applied uniformly.

**Performance:**

- N+1 / preload-before-filter in `courses_controller.ts` listing.
- 4-level nested preload in course show.
- Missing composite indexes on `(course_id, status)`, `(user_id, created_at)`,
  `(course_id, user_id)`, `(is_published, created_at)`.

- Roles reloaded from DB on every request (no cache).
- Local Windows env: node ace processes segfault on exit (139); node ace test can report exit 1 with lost output. See .planning/phases/04-content-foundation/deferred-items.md

## Session Continuity

Last session: 2026-10-19T09:53:20.135Z
Stopped at: GSD install verified at v1.42.3 across both runtime roots; planning
restructure committed; lint baseline brought to zero errors (`af99ea1`).
Working tree is clean. Ready to plan Phase 1.
Resume file: None

**To resume, in order:**

1. Plan Phase 1 (Code Health Baseline) — `/gsd:plan-phase 1`. Three plans are
   sketched in ROADMAP.md: lint cleanup, `as any` removal, functional test
   re-enable. **Rescope note:** the lint plan is now largely satisfied; the live
   work in that slot is the `jsonColumnConfig` dedup (8 call sites) plus keeping
   lint green in CI.

2. `as any` removal: 16 occurrences across 7 files — `handler.ts` ×5, `user.ts`
   ×3, `course.ts` ×2, `course_category.ts` ×2, `course_contents_controller.ts`
   ×2, `cohort.ts` ×1, `dashboard_controller.ts` ×1.

3. Re-enable `tests/functional/grades.spec.ts.skip`; there are still no unit
   tests at all.

4. Do not start Phase 4 (Content Foundation) before Phases 1-3 — the debt-first
   ordering is a deliberate decision, see Decisions above.

---
*Last updated: 2026-10-09 — GSD verified v1.42.3, planning committed, lint baseline green*
