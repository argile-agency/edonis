# Roadmap: Edonis Course Content Management

## Overview

This roadmap has two movements. **Phases 1–3 pay down technical debt** accumulated
during the initial build and the ~4-month dormancy: a clean code health baseline,
uniform authorization and validation, and completion of two features that ship in
the UI but have no working backend. **Phases 4–12 then transform Edonis from a
course administration system into a full course authoring platform**: content
foundation, a drag-and-drop builder, each content type, engagement tracking, and
Moodle `.mbz` migration.

The debt-first ordering is deliberate. Phases 5 and 10 modify code that currently
has no policy layer and incomplete validator coverage; hardening first means the
builder work lands on a trustworthy foundation instead of widening the gap.

## Milestones (date-aligned with the company roadmap, 2026-10-31)

Source: vault `01-STRATEGIE-ARGILE` §4 and design note 07 §10 (decided 2026-10-10); mapping, collisions and capacity in `RECONCILIATION-2026-10-31.md`. 🟡 estimates carry **two units** (RECONCILIATION §9): **H** = human-developer days (vault figures for the lots, ~1 d/plan for content phases), **A** = attended AI-assisted days, calibrated on this repo's history (phases 1-2: ≈ 0.4 h per backend plan; frontend and greenfield lots weighted ×2-3, low confidence).

| Milestone | Date | Repo phases | 🟡 H days | 🟡 A days | Capacity |
|---|---|---|---|---|---|
| Course editor | 2026-11-30 | 5 | 13-15 | 2-3 | part of the Nov-Dec days |
| v0.1 MVP — teacher creates a course (sections + pages), learner follows it; internal use | 2026-12-20 | 1 ✓, 2 ✓, 4 ✓, 5 ✓, 5.1 settings and 5.2 trash (inserted 2026-11-03, not sized), 6, then 3 | 13-15 + 10-20 + 3-4 = **26-39** | 2-3 + 1.5-2.5 + 0.6-0.8, plus 0.5-1 human-only = **≈ 5-6.5** | ~10 days announced; option (iii) chosen on the H figure, **to be reconsidered against the A figure** (RECONCILIATION §8-9); fallback option (i) |
| v1.0 Governance baseline + first pilots | 2027-03-31 | option (a), 2026-10-31: 17 → 15 → 16 → 13 → 14, then 7 → 8 → 10 → 12 → 9 | ~8 content + 22 governance ≈ **30** | 2.5-3.5 content + 6.75-9 governance + 0.75-1 human-only = **≈ 10-13.5** | ~7 days: still short by 3-6.5 A (not 23); budget raise to size on the A figure |
| Soft launch (50 early adopters) | 2027-05-31 | — | — | — |
| v1.1 | autumn 2027 | requirements only: EDITOR-V11-01 (typed blocks + revisions; the editor itself moved to Phase 6), ASSESS-V11-01/02, AI-V11-01, THEME-V11-01, ACCOM-V11-01; BUILD-V2-07/08 (vault placement) | — | — | — |
| v2 | undated, not committed | 11 Moodle import (parked); PAPER-V2-01/02, LTI-V2-01, QTI-V2-01, QA-V2-01, BUILD-V2-06 | — | — | — |

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

> **Milestones realigned on 2026-10-31** with the company roadmap (dates, not phase numbers; no phase was
> renumbered). See `RECONCILIATION-2026-10-31.md` for the mapping, the collisions and the capacity view.

**Milestone v0.1 — MVP (2026-12-20):** a teacher creates a course (sections + pages), a learner follows it end to end; internal use. Phase 5 alone is the vault's "Course editor" milestone (2026-11-30).

- [x] **Phase 1: Code Health Baseline** - Lint, type safety, re-enabled test suite (completed 2026-10-13)
- [x] **Phase 2: Security and Correctness Hardening** - Policy layer, validators, transactions (completed 2026-10-20)
- [x] **Phase 4: Content Foundation** - Database models and file storage service (completed 2026-10-19)
- [x] **Phase 5: Builder UI** - Drag-and-drop upgrade of the existing builder, incl. bulk actions (10 plans; 🟡 13-15 H / 2-3 A) (completed 2026-11-03)
- [x] **Phase 5.1: Admin platform settings** - `/admin/settings` page (admin only) to edit `AppSetting` in tabs: Apparence, Page d'accueil, Accès, Contact et support — *inserted 2026-11-03 by the owner before the trash phase, because the public demo needs it now; 6 plans in 3 waves (SETTINGS-01..09)* (completed 2026-11-04)
- [ ] **Phase 5.2: Trash and soft delete** - Recoverable deletes for sections and contents, 30-day configurable retention — *inserted 2026-11-03 by the owner, right after Phase 5; estimate at planning*
- [ ] **Phase 6: Page Content** - Page content type — *decided 2026-10-31: Tiptap-class WYSIWYG with a sanitized HTML/code source mode (PAGE-08); 🟡 10-20 H / 1.5-2.5 A*
- [ ] **Phase 3: Complete Stubbed Features** - Evaluations module and contact form — *not on the MVP critical path: runs after 5-6, first to drop to v1.0 if they slip; 🟡 3-4 H / 0.6-0.8 A*

**Milestone v1.0 — Governance baseline + first pilots (2027-03-31):** files, links, progress tracking, plus the five governance lots (B, C+D, E, F, H). Capacity: ~7 available days vs ~30 🟡 H days / ≈ 10-13.5 🟡 A days (RECONCILIATION §3 and §9). **Sequencing option (a) chosen by the owner on 2026-10-31:** governance first — 17 → 15 → 16 → 13 → 14 — then content 7 → 8 → 10 → 12 → 9; the 2027 budget raise (~+10 d for lots C+D) is still to be decided.

- [ ] **Phase 7: File Content** - File upload, storage, and download
- [ ] **Phase 8: URL Content** - External link management
- [ ] **Phase 10: Engagement Tracking** - Teacher-facing completion views
- [ ] **Phase 12: Permissions and Polish** - Access control and final refinements (12-01 already done by Phase 2)
- [ ] **Phase 9: Assignment Integration** - Link assignments to course sections (confirmed in v1.0 by the owner, 2026-10-31)
- [ ] **Phase 13: Unified rubric and per-question marking** - Lot B 🟡 ~5 H / 1.5-2 A
- [ ] **Phase 14: AI governance core and OpenAI-compatible provider** - Lots C + D 🟡 ~10 H / 3.25-4 A (cross-engine by decision of 2026-10-31)
- [ ] **Phase 15: AI Act article 5 and 50 compliance** - Lot E 🟡 ~2 H / 0.5-0.75 A
- [ ] **Phase 16: Accommodation profile** - Lot F 🟡 ~2 H / 0.5-0.75 A
- [ ] **Phase 17: Installability backup and admin docs** - Lot H 🟡 ~3 H / 1-1.5 A — prerequisite of the paid installation offer and subscriptions

**Milestone v1.1 (autumn 2027):** requirements only, no phase yet — EDITOR-V11-01, ASSESS-V11-01/02, AI-V11-01, THEME-V11-01, ACCOM-V11-01; BUILD-V2-07/08 placed here by the vault (IDs kept).

**Milestone v2 (undated, not committed):**

- [ ] **Phase 11: Moodle Import** - Parse and import .mbz backup files — *moved from v1 on 2026-10-31 (company roadmap); IMPORT-01..11 deferred*

## Phase Details

### Phase 1: Code Health Baseline

**Goal**: Green CI, no `any` escape hatches, and a test suite that actually runs
**Depends on**: Nothing (first phase)
**Requirements**: DEBT-01, DEBT-02, DEBT-03

> **Re-scoped 2026-10-09 during planning.** The original success criteria were written
> before `af99ea1`. Two were already satisfied: `bun run lint` and `bun run typecheck`
> both exit 0 today. Research then established three things the original scope missed:
> (a) CI does **not** enforce lint — `ci.yml` sets `continue-on-error: true` — so "green
> CI" is currently unfalsifiable; (b) the functional CI step is
> `node ace test functional || echo "..."`, which always exits 0, and an empty Japa suite
> exits 0 too; (c) `tests/functional/grades.spec.ts.skip` is not a disabled working test
> but a non-compiling draft producing 15 TypeScript errors, with `@japa/api-client` not
> installed and no `.env.test` to stop it wiping the dev database.
> One of the 16 `as any` casts (`course.ts:272,276`) hides a **live runtime bug**:
> `DateTime.fromJSDate()` applied to a Luxon `DateTime` returns an invalid DateTime, so
> `Course.canEnroll()` has never enforced its enrollment date window.

**Success Criteria** (what must be TRUE):

  1. A lint failure turns CI red — `continue-on-error` is gone from `ci.yml`
  2. `bun run typecheck` still exits 0 after removing all `as any` assertions
  3. `grep -rn "as any\|as never\|as unknown as\|@ts-expect-error" app/` returns 0, and a
     re-introduced `as any` under `app/` fails `bun run lint`

  4. `node ace test functional` runs real tests, and a failing assertion turns CI red
  5. `Course.canEnroll()` enforces its date window, guarded by a unit test

**Plans**: 5 plans in 3 waves

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Remove `as any` Clusters A–C (type-only, zero behaviour delta) [wave 1]
- [x] 01-02-PLAN.md — Fix the `canEnroll()` date-window runtime bug + unit test [wave 1]
- [x] 01-03-PLAN.md — Functional test infrastructure (`.env.test`, api-client, spec rewrite) [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-04-PLAN.md — `jsonColumnConfig` dedup (7 safe sites) + `as any` ESLint guard [wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-05-PLAN.md — CI gate enforcement (lint + unit + functional) [wave 3] *(GitHub Actions proof pending — local gates proven only)*

### Phase 2: Security and Correctness Hardening

**Goal**: Authorization and validation applied uniformly; no silent failures
**Depends on**: Phase 1
**Requirements**: DEBT-04, DEBT-05, DEBT-06, DEBT-07, DEBT-08, DEBT-09
**Success Criteria** (what must be TRUE):

  1. `app/policies/` exists and all resource-ownership checks route through it:
     `grep -rn "hasPermission(\|hasRole(\|instructorId ===\|isInstructor(\|\.roles\.some(" app/controllers` returns 0

  2. Every action in the DEBT-05 inventory (17 actions) reads input only via `request.validateUsing()`:
     `grep -rn "request\.\(only\|input\|all\)(" app/controllers` returns 0

  3. Enrollment counter mutations run inside a transaction using atomic conditional increments, and
     counters equal `COUNT(*)` of their source rows after any sequence of enrol/unenrol operations

  4. Category update rejects a parent that is the category itself or a descendant; descendant
     `path`/`depth` are recomputed on move

  5. Decryption failures are logged and never returned raw in all modes; raises when
     PII_DECRYPT_STRICT=true. Prerequisites: PII columns can hold ciphertext, and existing rows are scanned/repaired before raising is enabled

  6. 2FA pending state has an explicit timeout and a documented recovery path

> **Re-scoped 2026-10-09 after research** (`02-RESEARCH.md`). Criteria 1-5 were reworded to match
> what the code actually does: category tree building cannot loop (the bug is that `update` creates
> cycles), `decrypt` never throws (it returns `null`), and a transaction alone does not stop
> over-capacity enrolment. Phase 2 requires Phase 1 to be executed first (test infrastructure and
> the `canEnroll()` fix).

**Plans**: 16 plans (14 + 2 gap closure)

> Sliced by file ownership (fine granularity): same-wave plans share no files. Behaviour changes AS2–AS5
> each ship as an isolated commit behind their own `checkpoint:human-verify`; the DEBT-08 raise is gated by a
> blocking production check (Q1) and an env flag (`PII_DECRYPT_STRICT`, default off). Release ordering: 02-02 deployed +
> `pii:scan` (with `--fix` for legacy plaintext) before 02-07; strict mode enabled per environment only after a clean scan.
> 02-01 registers Shield's CSRF test client (`.withCsrfToken()`), which every Phase 2 write test uses.

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Bouncer 3 foundation: CSRF test harness + test factories, CoursePolicy/EnrollmentPolicy (behaviour-preserving), Inertia 403 page (axe-checked), gradebook via policy [DEBT-04]
- [x] 02-02-PLAN.md — Widen phone/mobile_phone for ciphertext + `pii:scan` (report-only by default, audited fixes) [DEBT-08]
- [x] 02-03-PLAN.md — 2FA pending state: 10-min expiry, 5-attempt lock, per-user throttle [DEBT-09]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-04-PLAN.md — courses_controller onto CoursePolicy + A4 permission IDOR [DEBT-04]
- [x] 02-05-PLAN.md — enrollments_controller policies (A1 fix), validators V9–V12, A9 scoping, AS4 checkpoint [DEBT-04, DEBT-05]
- [x] 02-06-PLAN.md — Category cycle rejection + subtree path/depth recompute + integrity command [DEBT-07]
- [x] 02-07-PLAN.md — Q1 prod check, then decryption failures logged/never raw, raising behind `PII_DECRYPT_STRICT` + silent-auth rethrow + 2FA decrypt audit [DEBT-08]
- [x] 02-08-PLAN.md — Admin 2FA reset, `user:reset-2fa` break-glass CLI, recovery doc [DEBT-09]
- [x] 02-09-PLAN.md — AS2 gradebook access for admins / edit co-instructors (checkpoint) [DEBT-04]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-10-PLAN.md — course_contents onto CoursePolicy, A2/A3/A5/A8 scoping, V17, AS3 checkpoint [DEBT-04, DEBT-05]
- [x] 02-11-PLAN.md — courses_controller validators V1–V7, V14 + form contract fixes + A9 [DEBT-05]
- [x] 02-12-PLAN.md — Listing/avatar/account validators + numeric route-param matchers [DEBT-05]
- [x] 02-13-PLAN.md — EnrollmentService: transactional atomic counters + audited `enrollment:recount` [DEBT-06]

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-14-PLAN.md — Admin participants via service, COUNT(*) invariant, AS5 checkpoint, `check:debt` gates [DEBT-06]

**Gap closure** *(from 02-VERIFICATION.md; 02-16 waits for 02-15, shared files)*

- [x] 02-15-PLAN.md — CR-02: enrolment keys never serialized to learners, enrollments.show gated by CoursePolicy.viewEnrollmentPage [DEBT-04]
- [x] 02-16-PLAN.md — CR-03: courses.show module tree only for editors; published-only view for non-staff (checkpoint) [DEBT-04]

### Phase 3: Complete Stubbed Features

**Milestone**: v0.1 MVP (2026-12-20) — placed after Phases 5 and 6 on 2026-10-31: not on the MVP critical path (evaluations list and contact form), first to drop to v1.0 if 5-6 slip. Confirmed by the owner on 2026-10-31.
**Goal**: Nothing in the UI promises a capability the backend does not deliver
**Depends on**: Phase 2
**Requirements**: EVAL-01, EVAL-02, EVAL-03, CONTACT-01, CONTACT-02, CONTACT-03
**Success Criteria** (what must be TRUE):

  1. Teacher sees submissions awaiting grading, scoped to courses they instruct
  2. Evaluations dashboard reports accurate total / pending / graded counts
  3. Teacher can navigate from the evaluations list into the grading view
  4. Contact form posts to a validated backend endpoint
  5. Contact submission is persisted and notifies the configured address
  6. Contact endpoint is rate-limited

**Plans**: 6 plans

> Sliced by file ownership (fine granularity): same-wave plans share no files. The `/evaluations` route stays
> `auth`-only (student 403 via the `viewEvaluations` policy action, not `middleware.role`), so `start/routes.ts`
> belongs to the contact work only. Only admins see every course; managers are scoped like any user (D-03 revised,
> no gradebook widening). The teacher dashboard card gating (OQ1) ships as an isolated revertable commit with a
> blocking human check. Mail uses nodemailer 10 directly
> (`@adonisjs/mail` 9 pins vulnerable nodemailer 6; 10 needs AdonisJS 7). 03-05 also fixes 02-REVIEW CR-04.

Plans:
**Wave 1**

- [ ] 03-01-PLAN.md — CoursePolicy `viewEvaluations` + `scopeGradableCourses` (admin-only unrestricted scope), assignment/submission factories [EVAL-01, EVAL-03]
- [ ] 03-02-PLAN.md — `POST /contact`: contact_messages table, validator with honeypot, persist-first, per-IP `contactThrottle` [CONTACT-01, CONTACT-02, CONTACT-03]

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 03-03-PLAN.md — Evaluations list: counters over the whole gradable scope (filters ignored), course/assignment filters, sorts, 20 per page, gradebook links [EVAL-01, EVAL-02, EVAL-03]
- [ ] 03-04-PLAN.md — nodemailer 10 `MailService`, optional SMTP env, notify after persist with `notified_at` [CONTACT-02]
- [ ] 03-05-PLAN.md — Contact page posts for real, GDPR export/deletion of contact messages, CR-04 `student_id` fix, retention note [CONTACT-01, CONTACT-02]

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 03-06-PLAN.md — Seeded submissions for the demo teacher, axe cases for /evaluations and /contact, dashboard cards only when allowed and reworded (checkpoint) [EVAL-01, CONTACT-01]

### Phase 4: Content Foundation

**Goal**: Establish database models and file storage infrastructure that all content types will use
**Depends on**: Phase 1
**Requirements**: None directly (infrastructure enables BUILD-*, FILE-*, IMPORT-10)
**Success Criteria** (what must be TRUE):

  1. ContentFile model exists with filename, storage path, MIME type, size, and checksum fields
  2. FileStorageService can store files outside webroot with random names
  3. FileStorageService can retrieve files by ID and serve downloads
  4. Files are deduplicated by checksum (same file uploaded twice uses same storage)

**Plans**: 1 plan

Plans:

- [x] 04-01-PLAN.md — ContentFile model, FileStorageService, and file download endpoint

### Phase 5: Builder UI

**Goal**: Upgrade the existing dialog-based builder to true drag-and-drop
**Depends on**: Phase 4
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05, BUILD-06, BUILD-07, BUILD-08, BUILD-09, BUILD-10, BUILD-11, BUILD-12, BUILD-13, BUILD-14, BUILD-15, BUILD-16

> **Scope note (2026-10-09):** this is a *replacement*, not a greenfield build.
> `course_contents_controller.ts` already implements module CRUD, content CRUD,
> `reorderModules` and `reorderContents`, all wired in `start/routes.ts`.
> `inertia/pages/courses/builder.tsx` (454 lines) already renders the builder with
> dialog-based forms. The gaps are: no `dnd-kit` dependency, no drag interaction,
> no inline editing, and no autosave. Plan against the existing code.

**Success Criteria** (what must be TRUE):

  1. Teacher can drag content items to reorder within a section
  2. Teacher can drag content items between sections
  3. Teacher can drag sections to reorder them
  4. Existing add / rename / delete section flows still work after the rewrite
  5. Changes are autosaved with visible save indicator
  6. Drag interactions have keyboard-accessible equivalents (a11y baseline is already enforced by axe-core tests)
  7. Teacher can select N items/sections and publish, unpublish, shift dates, move, duplicate or delete them in ≤ 3 interactions, with one audit entry per bulk action
  8. Bulk actions and selection are keyboard-operable (manual check + axe-core)

> **Scope addition (2026-10-31, vault design notes 08/09, arbitrage E5):** bulk selection and bulk actions
> (BUILD-11..16) are part of the builder from day one — about 2-3 days if designed into the list rendering
> now, 5+ days if retrofitted after dnd-kit and inline editing ship (precedents: Moodle 4.2 bulk editing,
> Blackboard Ultra Batch Edit, Brightspace Manage Dates). Reuse itself is deferred to v2 (BUILD-V2-05..08);
> the only hook taken now is `copied_from_id` on duplicated modules/contents (no UI, no sync).

**Plans**: 10 plans in 6 waves

> **Re-planned 2026-10-29 from research.** The roadmap's three placeholder plans assumed the existing
> reorder endpoints were enough. They are not: cross-section moves and re-parenting need two new locked
> move endpoints, the edit/delete endpoints need JSON + conflict detection, and D-02 was revised to
> 2 levels. Plans are split by file ownership so same-wave plans never touch the same file; same-wave plans run in
> parallel git worktrees (default `workflow.use_worktrees`), with file-scoped per-task gates and full suites at the plan and post-merge gates.
> Autonomy: 05-01..05-06 autonomous; 05-07 not autonomous (pauses for a French library decision only if classic dnd-kit misbehaves); 05-08 not autonomous (French walkthrough checkpoint).
>
> **Extended 2026-10-31 for the scope addition (D-11 / D-12, BUILD-11..16):** two plans added, 05-09 (bulk endpoints + `copied_from_id`, wave 2) and 05-10 (selection + bulk action bar, wave 5); 05-08 moves to wave 6 so its axe states and walkthrough cover bulk actions. Coexistence changes in the verified plans: 05-01 moves its move core into `app/services/course_structure_service.ts` (reused by the bulk move); 05-06 reserves the row's selection slot and reuses 05-09's props loader; 05-07 keeps drag listeners on the handle only. 05-09 and 05-10 are autonomous; two provisional defaults in 05-09 (OQ-1 assignments not shifted, OQ-2 copies start as drafts) need the user's answer before 05-09 executes.

Plans:

**Wave 1**

- [x] 05-01-PLAN.md — Move endpoints: `POST /contents/:id/move` and `/modules/:id/move` with course-row lock, cycle + 2-level depth checks, `updated_at` conflict token; `parentId` dropped from module update; one ids-only audit row per move [BUILD-01, BUILD-02, BUILD-03]
- [x] 05-02-PLAN.md — Pure `inertia/lib/builder_tree.ts` (rows, drop projections, move targets, optimistic apply) unit-tested; D-10 browser base URL from `PORT` + local browser probe [BUILD-01, BUILD-02, BUILD-03, BUILD-06]
- [x] 05-03-PLAN.md — Serial save queue (pure core + `useSaveQueue` + strict `sendJson`) and accessible save indicator [BUILD-10]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-04-PLAN.md — JSON + conflict on updates, WR-20 clearable/ordered dates, locked refusal of non-empty section delete, depth on create under the course lock, audit rows on deletes, CSRF JSON case [BUILD-04, BUILD-05, BUILD-06, BUILD-07, BUILD-08, BUILD-09, BUILD-10]
- [x] 05-05-PLAN.md — Inline title, details panel, actions menu (Monter / Descendre / Déplacer vers… / Supprimer with confirmation) [BUILD-05, BUILD-06, BUILD-08, BUILD-09]
- [x] 05-09-PLAN.md — Bulk endpoints (publish/unpublish, availability, date shift, move via the shared move service, duplicate with attachments, delete) in one transaction each with one ids-only audit row; reversible `copied_from_id` migration; date-shift helper [BUILD-12, BUILD-13, BUILD-14, BUILD-15]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-06-PLAN.md — Builder page rebuilt on flat props (4 tasks: row, flat props + functional test, page, browser tests): optimistic autosave, menu moves, deletes, creation dialogs with new sections auto-expanded; browser tests incl. add flows [BUILD-01..BUILD-10]

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 05-07-PLAN.md — dnd-kit (pinned) drag layer: content and section drag, auto-expand, keyboard with French announcements, touch via handle; SSR smoke + keyboard browser tests; *not autonomous: conditional French library decision* [BUILD-01, BUILD-02, BUILD-03, BUILD-10]

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 05-10-PLAN.md — Selection (checkboxes, all/none, quick selections, live count) and bulk action bar with dialogs, through the save queue; browser tests incl. keyboard, checkbox vs handle and axe [BUILD-11, BUILD-12, BUILD-13, BUILD-14, BUILD-16]

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 05-08-PLAN.md — axe coverage of the builder (incl. selection state), full gate incl. build, validation sign-off (Nyquist only if browser rows ran), French walkthrough incl. add flows and bulk actions (checkpoint, not autonomous) [BUILD-01..BUILD-16]

### Phase 05.1: Admin platform settings (INSERTED)

**Milestone**: v0.1 MVP (2026-12-20). Inserted on 2026-11-03 by the owner (« Immédiatement, avant 5.1 »), ahead of the trash phase, because the public demo (demo.edonis.org) can only be changed by SQL today. Not in the v0.1 capacity figures yet: size it at planning.
**Goal:** An administrator changes the platform settings from the UI, without a database edit or a deploy, and every exposed setting has a visible effect
**Requirements**: SETTINGS-01, SETTINGS-02, SETTINGS-03, SETTINGS-04, SETTINGS-05, SETTINGS-06, SETTINGS-07, SETTINGS-08, SETTINGS-09
**Depends on:** Phase 5
**Plans:** 6/6 plans complete
**Brief:** `.planning/todos/completed/2026-11-03-admin-platform-settings-page.md` (acceptance criteria and out of scope)

**Owner decisions (2026-11-03):**

- `headerHtml` / `footerHtml` are not exposed in v1 (raw HTML on every page is an XSS vector)
- New plain-text `announcementText` field (cross-engine, reversible migration), shown on the home page; it replaces the demo banner hard-coded in `home.tsx` (`2fc5399`) and the seeder fills it
- Logo and favicon as URL fields; upload later
- Settings that are stored but have no effect: wire the ones that matter (contact email, support URL and social links in the footer, favicon as `<link rel="icon">`, hero image in the hero, `allowRegistration` enforced on the register page and route); remove the rest from the form (secondary and accent colours, `showStats`, `showPublicCourses`, `welcomeMessage` if it duplicates the hero)
- Single-instance in v1: `app_settings` keeps the `is_active` singleton without `tenant_id`, stated explicitly
- Conventions: controller + VineJS validator in `app/`, authorization in the controller as well as the route middleware (admin only), one audit row per save, French labels, an axe test, columns valid on the three engines

Plans:

> **Planned 2026-11-03** (no research, owner decisions D-01..D-16 in `05.1-CONTEXT.md`). Plans split by file ownership so same-wave plans run in parallel worktrees. Resolved at planning: images are root-relative or same-origin URLs only, CSP `imgSrc` unchanged (D-15 default); admin authorization in the controller through a `PlatformSettingsPolicy` (keeps `check:debt` at 0); the settings seeder switches to `firstOrCreate` (production does not run `db:seed`), so after deploy the demo shows no banner until an admin sets it on /admin/settings. 05.1-01..05 autonomous; 05.1-06 not autonomous (French walkthrough).

Plans:

**Wave 1**

- [x] 05.1-01-PLAN.md — `announcement_text` migration, `AppSetting` singleton helpers and JSON fix, seeders (`firstOrCreate`, admin menu item), per-tab VineJS validators with French messages and safe URL rules [SETTINGS-01, SETTINGS-03, SETTINGS-05]
- [x] 05.1-02-PLAN.md — Registration off enforced on `/register` and on OAuth account creation; sign-up links hidden on login and about [SETTINGS-08]
- [x] 05.1-03-PLAN.md — Public effects: announcement banner, hero image, footer contact/support/social with render guards, favicon, header « Inscription » and admin menu entry [SETTINGS-01, SETTINGS-06, SETTINGS-07, SETTINGS-08]
- [x] 05.1-04-PLAN.md — `/admin/settings` page: four tabs, four independent forms, accessible fields and errors [SETTINGS-01, SETTINGS-03, SETTINGS-09]

**Wave 2** *(blocked on 05.1-01 and 05.1-04)*

- [x] 05.1-05-PLAN.md — `PlatformSettingsPolicy`, controller (show, update with changed-keys audit in one transaction), routes, functional tests [SETTINGS-01, SETTINGS-02, SETTINGS-03, SETTINGS-04, SETTINGS-05]

**Wave 3** *(blocked on Waves 1-2)*

- [x] 05.1-06-PLAN.md — axe test on the four tabs, full gate, French walkthrough and demo post-deploy step (checkpoint, not autonomous) [SETTINGS-01..SETTINGS-09]

### Phase 05.2: Trash and soft delete (INSERTED)

**Milestone**: v0.1 MVP (2026-12-20). Inserted on 2026-11-03 by the owner (« Juste après la phase 5 ») from the Phase 5 deferred idea D-06 (`05-CONTEXT.md`, Deferred Ideas). Not in the v0.1 capacity figures of the milestone table yet: size it at planning.
**Goal:** Deleting a section or a content moves it to a trash instead of removing it, so nothing (structure, files, learner progress) is lost by mistake
**Requirements**: TBD at planning (TRASH-xx in REQUIREMENTS.md)
**Depends on:** Phase 5
**Plans:** 0 plans

**Scope from the owner (05-CONTEXT D-06 and 2026-11-03):**

- Soft delete with `deleted_at` (CLAUDE.md database conventions) for sections and contents; learner progress is kept while an item is in the trash
- Trash reachable from the course and from course editing, with restore
- Emptied after 30 days by default; retention configurable in the platform administration settings
- Confirmation before deleting, with the count of affected learners (shipped in Phase 5, `d393afb`, to keep)
- Lifts Phase 5's "empty section only" rule (D-05) once deletes are recoverable
- Touches the course list, the learner outline and every progress query (deleted items must disappear for learners)

Plans:

- [ ] TBD (run /gsd:plan-phase 05.2 to break down)

### Phase 6: Page Content

**Milestone**: v0.1 MVP (2026-12-20). **Editor decided by the owner on 2026-10-31 (RECONCILIATION C1):** a WYSIWYG editor of the Tiptap class ("better than TinyMCE"), with a source mode to edit raw HTML and code blocks inside a sanitized field — allow-list sanitizer on save and on render, no script, event handler or `javascript:` URL ever executes (PAGE-06, PAGE-08). Typed JSON blocks and revisions stay in v1.1 (EDITOR-V11-01). 🟡 ~10-20 d (the vault's figure for Tiptap + blocks; the editor alone sits at the low end). Plan 06-01 "TipTap editor integration" stands.
**Goal**: Teachers can create rich text pages with embedded media
**Depends on**: Phase 5
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04, PAGE-05, PAGE-06, PAGE-07, PAGE-08
**Success Criteria** (what must be TRUE):

  1. Teacher can create Page content with WYSIWYG editor in builder
  2. WYSIWYG supports headings, formatting, lists, links, tables
  3. Teacher can embed images (upload or URL) and videos (YouTube/Vimeo)
  4. Content is sanitized on save and render (no XSS)
  5. Student can view rendered Page content in course view
  6. Teacher can switch to a source view to edit HTML and code blocks; a payload containing `<script>`, an `onerror=` handler and a `javascript:` URL is stripped on save and never executes on render (functional test on the saved content, browser test on the render)

**Plans**: TBD

Plans:

- [ ] 06-01: TipTap editor integration
- [ ] 06-02: Media embedding (images, videos)
- [ ] 06-03: Sanitization and student view

### Phase 7: File Content

**Goal**: Teachers can upload files for students to download
**Depends on**: Phase 4, Phase 5
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, FILE-06
**Success Criteria** (what must be TRUE):

  1. Teacher can create File content by uploading a file
  2. System accepts PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, images, ZIP (up to 50MB)
  3. Files are stored securely outside webroot
  4. Teacher can replace file after creation
  5. Student can download file from course view

**Plans**: TBD

Plans:

- [ ] 07-01: File upload UI with react-dropzone
- [ ] 07-02: File validation and storage
- [ ] 07-03: File download and replacement

### Phase 8: URL Content

**Goal**: Teachers can add external links to course content
**Depends on**: Phase 5
**Requirements**: URL-01, URL-02, URL-03, URL-04
**Success Criteria** (what must be TRUE):

  1. Teacher can create URL content with external link
  2. URL is validated before save
  3. Teacher can add optional description
  4. Student can click to open URL in new tab

**Plans**: TBD

Plans:

- [ ] 08-01: URL content type with validation

### Phase 9: Assignment Integration

**Goal**: Teachers can link existing assignments into course sections
**Depends on**: Phase 5
**Requirements**: ASSIGN-01, ASSIGN-02, ASSIGN-03
**Success Criteria** (what must be TRUE):

  1. Teacher can link existing Assignment to a course section
  2. Assignment appears in builder with link to edit assignment details
  3. Student sees Assignment in course content with their submission status

**Plans**: TBD

Plans:

- [ ] 09-01: Assignment linking in builder
- [ ] 09-02: Student assignment view with status

### Phase 10: Engagement Tracking

**Goal**: Complete and surface student progress through course content
**Depends on**: Phase 6, Phase 7, Phase 8, Phase 9

> **Scope note (2026-10-09):** backend tracking already exists. The
> `content_progress` model and migration are in place, and
> `course_contents_controller.ts` implements `updateProgress`, `markComplete` and
> `getCourseProgress` with routes wired. The gaps are: per-content-type completion
> triggers (Page viewed / File downloaded / URL clicked) and the teacher-facing
> completion view. Plan against the existing code.

**Requirements**: TRACK-01, TRACK-02, TRACK-03, TRACK-04
**Success Criteria** (what must be TRUE):

  1. Each content type fires the appropriate completion trigger
  2. Assignment submission counts as activity participation
  3. Student sees completion checkmarks in course view
  4. Teacher can view student completion status for course content

**Plans**: TBD

Plans:

- [ ] 10-01: Per-content-type completion triggers
- [ ] 10-02: Teacher completion dashboard

### Phase 11: Moodle Import

**Milestone**: **v2 (undated, not committed) — moved from v1 on 2026-10-31** because the company roadmap (`01-STRATEGIE-ARGILE` §4, design note 07 §10) places Moodle `.mbz` import in V2. The phase keeps its number and its IMPORT-01..11 requirements (status Deferred). Phase 4's storage foundation and Phase 6-9 content types remain its prerequisites.
**Goal**: Teachers can import existing Moodle courses via .mbz backup files
**Depends on**: Phase 6, Phase 7, Phase 8, Phase 9
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-07, IMPORT-08, IMPORT-09, IMPORT-10, IMPORT-11
**Success Criteria** (what must be TRUE):

  1. Teacher can upload Moodle .mbz backup file
  2. System shows import preview with sections and activities (supported vs skipped)
  3. Teacher can confirm or cancel import
  4. Moodle sections are imported as CourseModules
  5. Page, File, URL activities are imported as corresponding content types
  6. Assignment activities create linked Assignments
  7. Embedded files are extracted and @@PLUGINFILE@@ references are resolved

**Plans**: TBD

Plans:

- [ ] 11-01: MBZ parsing service
- [ ] 11-02: Import preview UI
- [ ] 11-03: Content import execution
- [ ] 11-04: File extraction and reference resolution

### Phase 12: Permissions and Polish

**Goal**: Secure access control and final quality improvements
**Depends on**: Phase 2, Phase 5, Phase 10
**Requirements**: PERM-01, PERM-02, PERM-03
**Success Criteria** (what must be TRUE):

  1. Course instructor can access builder for their own courses only
  2. Admin can access builder for any course
  3. Students cannot access course builder (proper 403 response)
  4. All builder features work consistently across content types

**Plans**: TBD

Plans:

- [x] 12-01: Builder access control via the Phase 2 policy layer (completed 2026-10-28)
- [ ] 12-02: Final polish and edge cases

## Progress

**Execution Order (realigned 2026-10-31):**
v0.1: 1 ✓ -> 2 ✓ -> 4 ✓ -> 5 ✓ -> 5.1 -> 5.2 -> 6 -> 3 · v1.0 (option (a), owner 2026-10-31): governance 17 -> 15 -> 16 -> 13 -> 14, then content 7 -> 8 -> 10 -> 12 -> 9 · v2: 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Code Health Baseline | 5/5 | Complete    | 2026-10-13 |
| 2. Security and Correctness Hardening | 16/16 | Complete    | 2026-10-28 |
| 3. Complete Stubbed Features | 0/6 | Planned (v0.1, after 5-6) | - |
| 4. Content Foundation | 1/1 | Complete   | 2026-10-19 |
| 5. Builder UI | 10/10 | Complete    | 2026-11-03 |
| 5.1. Admin platform settings | 6/6 | Complete   | 2026-11-04 |
| 5.2. Trash and soft delete | 0/0 | Not planned (v0.1, inserted 2026-11-03) | - |
| 6. Page Content | 0/3 | Not started | - |
| 7. File Content | 0/3 | Not started | - |
| 8. URL Content | 0/1 | Not started | - |
| 9. Assignment Integration | 0/2 | Not started | - |
| 10. Engagement Tracking | 0/2 | Not started (rescoped) | - |
| 11. Moodle Import | 0/4 | Not started | - |
| 12. Permissions and Polish | 0/2 | Not started | - |

### Phase 13: Unified rubric and per-question marking

**Milestone**: v1.0 Governance baseline + first pilots (2027-03-31) — company roadmap lot B, 🟡 ~5 d (vault estimate). Added 2026-10-31.
**Goal**: One versioned `rubric` object marks any assessment (online, paper, oral, practical) per criterion, with lock, audit and retroactive recompute — without a quiz builder
**Depends on**: Phase 2 (policies, audit logging); uses the existing assignments / submissions / grades model (see RECONCILIATION §2 for what lot B needs and does not need)
**Requirements**: RUBRIC-01, RUBRIC-02, RUBRIC-03, RUBRIC-04, RUBRIC-05, RUBRIC-06, RUBRIC-07
**Success Criteria** (what must be TRUE):

  1. One rubric can be attached to an `essay` assignment and to an `offline` (paper / oral / practical) assignment; marking either records one row per criterion and the submission total equals the sum of the rows (functional test)
  2. Editing a rubric version that already has marks creates a new version; the used version's rows cannot be updated (immutability enforced at the data layer, tested)
  3. Switching an assignment to a newer grid version recomputes the affected totals and produces a delta report shown to the marker before anything applies
  4. An out-of-range or missing-criterion mark lands in the resolution queue; the submission total stays unchanged until it is resolved
  5. A finalised mark cannot change without an explicit unlock, which writes an `audit_logs` row
  6. Legacy `assignments.rubric_data` / `submissions.rubric_scores` remain readable after migration; `bun run check:debt` stays 0; CI green on the three engines

**Plans**: TBD

Plans:

- [ ] TBD (run /gsd:plan-phase 13 to break down)

### Phase 14: AI governance core and OpenAI-compatible provider

**Milestone**: v1.0 Governance baseline + first pilots (2027-03-31) — company roadmap lots C (🟡 ~8 d) + D (🟡 ~2 d). Added 2026-10-31. **E1 resolved by the owner on 2026-10-31: the three engines (PostgreSQL, MySQL/MariaDB, SQLite) are mandatory.** AIGOV-06 reserves budget with `SELECT … FOR UPDATE` plus a conditional update inside a transaction (no `UPDATE … RETURNING`); AIGOV-07 uses the `jsonColumn` helper and no partitions; both are tested on the three CI engines (RECONCILIATION §4).
**Goal**: AI is off by default and every call is policy-routed, data-classed, budgeted and ledgered, with one real provider and CI coverage — never AI-text detection, proctoring, decisional grading or dropout prediction
**Depends on**: Phase 2 (policies, audit logging, PII handling)
**Requirements**: AIGOV-01, AIGOV-02, AIGOV-03, AIGOV-04, AIGOV-05, AIGOV-06, AIGOV-07, AIGOV-08, AIGOV-09, AIGOV-10, AIGOV-11, AIGOV-12
**Success Criteria** (what must be TRUE):

  1. On a fresh install and after running all migrations on an existing database, no AI placement is enabled (tested)
  2. A request classed `student_work` sent to a provider whose manifest says `maxDataClass = pedagogical` is refused by the router, and the resolution trace names the rule that refused it (functional test, not a checkbox)
  3. A course-level setting cannot enable what the department disabled (monotone restriction), and the trace shows every level consulted
  4. Two concurrent calls against a budget with room for one: exactly one reservation succeeds, the other is refused — tested on every CI engine
  5. `ai_usage` has no prompt-content column, is insert-only (updates and deletes refused, tested), stores `cost_micros`, cached/reasoning tokens and `billed_to`; `ai_audit_log` is a separate table
  6. MCQ generation always yields `status = draft` items invisible to learners until a human validates them; accessibility assistance uses the WCAG system prompt (snapshot test)
  7. CI runs the AI functional tests against Ollama; the provider is configured by `baseURL` only (no SDK-specific wiring)
  8. No capability type and no code path exists for AI-text detection, proctoring, decisional automatic grading or dropout prediction (registry test + grep gate); the Vercel AI SDK is the only AI dependency, no external gateway

**Plans**: TBD

Plans:

- [ ] TBD (run /gsd:plan-phase 14 to break down)

### Phase 15: AI Act article 5 and 50 compliance

**Milestone**: v1.0 Governance baseline + first pilots (2027-03-31) — company roadmap lot E, 🟡 ~2 d. Added 2026-10-31. Only meaningful once Phase 14 exists.
**Goal**: People always know when they interact with an AI, can opt out and ask for human review, and the prohibited practices of article 5 are structurally absent
**Depends on**: Phase 14
**Requirements**: AIACT-01, AIACT-02, AIACT-03
**Success Criteria** (what must be TRUE):

  1. Every AI placement renders the "you are interacting with an AI" notice; a theme or customization override that tries to hide it fails (browser test + axe)
  2. The capability registry has no type for emotion recognition, attention tracking or proctoring; a test asserts their absence and the admin docs list them as never-build
  3. The opt-out / human-review form persists a traceable request (audit row, visible to the requester), and AI placements honour the opt-out for that person

**Plans**: TBD

Plans:

- [ ] TBD (run /gsd:plan-phase 15 to break down)

### Phase 16: Accommodation profile

**Milestone**: v1.0 Governance baseline + first pilots (2027-03-31) — company roadmap lot F, 🟡 ~2 d. Added 2026-10-31.
**Goal**: Accommodations follow the person: time and format overrides come from a profile attached to the user and are never retyped per attempt
**Depends on**: Phase 2 (PII encryption, GDPR export and anonymization)
**Requirements**: ACCOM-01, ACCOM-02, ACCOM-03
**Success Criteria** (what must be TRUE):

  1. A profile with a 1.5 time multiplier yields the extended deadline or duration on an attempt with no per-attempt input (functional test)
  2. Profile fields are encrypted where personal and readable only by the person, course staff with the right permission and admins (403 tests)
  3. The GDPR export includes the profile and account anonymization removes it (tests extend the account GDPR spec)

**Plans**: TBD

Plans:

- [ ] TBD (run /gsd:plan-phase 16 to break down)

### Phase 17: Installability backup and admin docs

**Milestone**: v1.0 Governance baseline + first pilots (2027-03-31) — company roadmap lot H, 🟡 ~3 d. Added 2026-10-31. **Without it the paid "installation" offer and the subscriptions do not exist.** E1 resolved on 2026-10-31 (three engines mandatory): INSTALL-02 needs one documented backup/restore procedure per engine (pg_dump, mysqldump, SQLite file copy); the 🟡 3 d figure is the vault's and predates this decision — revisit it at planning.
**Goal**: An institution installs Edonis in under 30 minutes and can back up and restore it, from the admin documentation alone
**Depends on**: Phase 4 (`CONTENT_STORAGE_PATH`), Phase 2
**Requirements**: INSTALL-01, INSTALL-02, INSTALL-03
**Success Criteria** (what must be TRUE):

  1. A timed fresh install from the install guide on a clean machine completes in under 30 minutes (recorded as a HUMAN-UAT item)
  2. A backup then a restore onto a fresh database and content storage reproduce the row counts and a sample file checksum (functional test on SQLite; manual on the production engine until E1 is decided)
  3. The admin docs cover install, upgrade, backup/restore and every environment variable declared in `start/env.ts` (grep gate: each env key appears in the docs)

**Plans**: TBD

Plans:

- [ ] TBD (run /gsd:plan-phase 17 to break down)

---
*Roadmap created: 2026-02-03*
*Restructured: 2026-10-09 — tech debt phases 1-3 prepended, content phases renumbered 1-9 -> 4-12, phases 5 and 10 rescoped against verified codebase reality*
*Realigned: 2026-10-31 — milestones v0.1 / v1.0 / v1.1 / v2 aligned with the company roadmap; Phase 11 parked in v2; Phases 13-17 added for the governance lots B, C+D, E, F, H (no phase renumbered). Flat format kept on purpose: the installed GSD treats any heading containing `vX.Y` as a milestone section and then filters phase directories by the current milestone, which would hide phases 1-4 from the tooling; milestones are therefore expressed in the `## Phases` grouping, the per-phase `**Milestone**` lines and the `## Milestones` table.*
*Total phases: 17 (Phase 11 parked in v2) | Total plans: 38 planned (phases 1-5) + unplanned phases 6-10, 12-17*
