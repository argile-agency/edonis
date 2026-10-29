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

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

**Technical debt remediation:**

- [x] **Phase 1: Code Health Baseline** - Lint, type safety, re-enabled test suite (completed 2026-10-13)
- [x] **Phase 2: Security and Correctness Hardening** - Policy layer, validators, transactions (completed 2026-10-20)
- [ ] **Phase 3: Complete Stubbed Features** - Evaluations module and contact form

**Course content milestone:**

- [x] **Phase 4: Content Foundation** - Database models and file storage service
 (completed 2026-10-19)

- [ ] **Phase 5: Builder UI** - Drag-and-drop upgrade of the existing builder
- [ ] **Phase 6: Page Content** - WYSIWYG rich text editor integration
- [ ] **Phase 7: File Content** - File upload, storage, and download
- [ ] **Phase 8: URL Content** - External link management
- [ ] **Phase 9: Assignment Integration** - Link assignments to course sections
- [ ] **Phase 10: Engagement Tracking** - Teacher-facing completion views
- [ ] **Phase 11: Moodle Import** - Parse and import .mbz backup files
- [ ] **Phase 12: Permissions and Polish** - Access control and final refinements

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
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05, BUILD-06, BUILD-07, BUILD-08, BUILD-09, BUILD-10

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

**Plans**: 8 plans in 5 waves

> **Re-planned 2026-10-29 from research.** The roadmap's three placeholder plans assumed the existing
> reorder endpoints were enough. They are not: cross-section moves and re-parenting need two new locked
> move endpoints, the edit/delete endpoints need JSON + conflict detection, and D-02 was revised to
> 2 levels. Plans are split by file ownership so same-wave plans never touch the same file.

Plans:

**Wave 1**

- [ ] 05-01-PLAN.md — Move endpoints: `POST /contents/:id/move` and `/modules/:id/move` with course-row lock, cycle + 2-level depth checks, `updated_at` conflict token; `parentId` dropped from module update [BUILD-01, BUILD-02, BUILD-03]
- [ ] 05-02-PLAN.md — Pure `inertia/lib/builder_tree.ts` (rows, drop projections, move targets, optimistic apply) unit-tested; D-10 browser base URL from `PORT` + local browser probe [BUILD-01, BUILD-02, BUILD-03, BUILD-06]
- [ ] 05-03-PLAN.md — Serial save queue (pure core + `useSaveQueue` + strict `sendJson`) and accessible save indicator [BUILD-10]

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 05-04-PLAN.md — JSON + conflict on updates, WR-20 clearable/ordered dates, locked refusal of non-empty section delete, depth on create, CSRF JSON case [BUILD-04, BUILD-05, BUILD-06, BUILD-07, BUILD-08, BUILD-09, BUILD-10]
- [ ] 05-05-PLAN.md — Inline title, details panel, actions menu (Monter / Descendre / Déplacer vers… / Supprimer with confirmation) [BUILD-05, BUILD-06, BUILD-08, BUILD-09]

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 05-06-PLAN.md — Builder page rebuilt on flat props: rows, optimistic autosave, menu moves, deletes, creation dialogs; browser tests [BUILD-01..BUILD-10]

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 05-07-PLAN.md — dnd-kit (pinned) drag layer: content and section drag, auto-expand, keyboard with French announcements, touch via handle; SSR smoke + keyboard browser tests [BUILD-01, BUILD-02, BUILD-03, BUILD-10]

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 05-08-PLAN.md — axe coverage of the builder, full gate incl. build, French walkthrough (checkpoint) [BUILD-01..BUILD-10]

### Phase 6: Page Content

**Goal**: Teachers can create rich text pages with embedded media
**Depends on**: Phase 5
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04, PAGE-05, PAGE-06, PAGE-07
**Success Criteria** (what must be TRUE):

  1. Teacher can create Page content with WYSIWYG editor in builder
  2. WYSIWYG supports headings, formatting, lists, links, tables
  3. Teacher can embed images (upload or URL) and videos (YouTube/Vimeo)
  4. Content is sanitized on save and render (no XSS)
  5. Student can view rendered Page content in course view

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

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Code Health Baseline | 5/5 | Complete    | 2026-10-13 |
| 2. Security and Correctness Hardening | 16/16 | Complete    | 2026-10-28 |
| 3. Complete Stubbed Features | 0/2 | Not started | - |
| 4. Content Foundation | 1/1 | Complete   | 2026-10-19 |
| 5. Builder UI | 0/3 | Not started (rescoped) | - |
| 6. Page Content | 0/3 | Not started | - |
| 7. File Content | 0/3 | Not started | - |
| 8. URL Content | 0/1 | Not started | - |
| 9. Assignment Integration | 0/2 | Not started | - |
| 10. Engagement Tracking | 0/2 | Not started (rescoped) | - |
| 11. Moodle Import | 0/4 | Not started | - |
| 12. Permissions and Polish | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-03*
*Restructured: 2026-10-09 — tech debt phases 1-3 prepended, content phases renumbered 1-9 -> 4-12, phases 5 and 10 rescoped against verified codebase reality*
*Total phases: 12 | Total plans: 40 (estimated)*
