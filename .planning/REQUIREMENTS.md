# Requirements: Edonis Course Content Management

**Defined:** 2026-02-03
**Core Value:** Easy course creation with seamless Moodle migration

## Technical Debt Requirements

*Added 2026-10-09. Sourced from `.planning/codebase/CONCERNS.md` and verified
against the working tree. These gate the v1 content work (Phases 1-3).*

### Code Health

- [x] **DEBT-01**: `bun run lint` exits 0 (17 errors today: `eqeqeq` in `bulk_enrollment_log.ts`, `course_content.ts`, `submission.ts`; prettier in `database/helpers/schema_helpers.ts`)
- [x] **DEBT-02**: No `as any` assertions remain in `app/` (16 today across 7 files), with `bun run typecheck` still passing
- [x] **DEBT-03**: Functional test suite is re-enabled (`tests/functional/grades.spec.ts.skip`) and runs in CI
- [ ] **DEBT-10**: Functional coverage for gradebook *computation* (instructor matrix, grade categories, overall-grade arithmetic, missing submissions). Deferred from Phase 1, which covered access control only. Scenarios from the deleted `grades.spec.ts.skip` draft, each run as `withInertia()` requests on `route('grades.course')` / `route('grades.index')`:
  - Student index: `grades.index` lists the student's enrolled courses with per-course grade summary
  - Student own grades: a graded `Submission` (85/100, feedback "Good work!") appears in `props.grades` with matching `pointsEarned` and `feedback`
  - Student isolation: with a second enrolled student, the student view returns only the caller's own grades (the draft only asserted `isInstructor: false`, which Phase 1 already covers)
  - Instructor roster: with 2 enrolled students, `props.gradebook` has length 2
  - Instructor matrix: with graded submissions of 90 and 75 on one assignment, each student's `gradebook[].grades[0].pointsEarned` matches
  - Grade categories: two `GradeCategory` rows (Assignments w=50, Quizzes w=30, drop-lowest) are returned in `props.categories` ordered by `position`
  - Overall-grade arithmetic: 80/100 + 40/50 across two categories gives `overallGrade 80`, `earnedPoints 120`, `totalPoints 150`
  - Missing submissions: a published assignment with no submission gives `overallGrade null`, `earnedPoints 0`, `totalPoints 0`, `gradedCount 0`

### Security and Correctness

- [x] **DEBT-04**: Resource-ownership authorization is centralized in `app/policies/` instead of inline controller checks
- [x] **DEBT-05**: Every controller action accepting user input has a validator (5 validators for 16 controllers today)
- [x] **DEBT-06**: Enrollment counter mutations (`enrolledCount`, `currentEnrollments`) run inside a database transaction
- [x] **DEBT-07**: Category tree building detects and rejects cycles instead of looping indefinitely
- [x] **DEBT-08**: Decryption failures are logged and never returned raw in all modes; raises when PII_DECRYPT_STRICT=true
- [x] **DEBT-09**: 2FA pending state has an explicit timeout and a documented recovery path (recovery codes or admin unlock)

### Evaluations Module

- [ ] **EVAL-01**: Teacher sees submissions awaiting grading, scoped to courses they instruct
- [ ] **EVAL-02**: Evaluations dashboard reports accurate total / pending / graded counts
- [ ] **EVAL-03**: Teacher can navigate from the evaluations list into the grading view

### Contact Form

- [ ] **CONTACT-01**: Contact form posts to a backend endpoint with server-side validation
- [ ] **CONTACT-02**: Submission is persisted and notifies the configured address
- [ ] **CONTACT-03**: Contact endpoint is rate-limited

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Course Builder

- [x] **BUILD-01**: Teacher can drag-and-drop content items to reorder within a section
- [x] **BUILD-02**: Teacher can drag-and-drop content items between sections
- [x] **BUILD-03**: Teacher can drag-and-drop sections to reorder them
- [x] **BUILD-04**: Teacher can add new section (module) to course
- [x] **BUILD-05**: Teacher can rename a section
- [x] **BUILD-06**: Teacher can delete an empty section
- [x] **BUILD-07**: Teacher can add content item to a section (opens type selector)
- [x] **BUILD-08**: Teacher can edit content inline (modal or expandable form in builder)
- [x] **BUILD-09**: Teacher can delete content item from section
- [x] **BUILD-10**: Changes are autosaved (with save indicator)
- [x] **BUILD-11**: Teacher can select multiple content items and sections (checkboxes, select all/none, quick selections: published, unpublished, by content type); the selection count is announced via aria-live
- [x] **BUILD-12**: Bulk publish / unpublish selected items
- [x] **BUILD-13**: Bulk set availability window (available_from / available_until) and bulk date shift, either by N days or by "old start date → new start date" (the shift preserves relative spacing). Applies to module and content dates (available_from / available_until, due_date)
- [x] **BUILD-14**: Bulk move to another section, bulk duplicate, bulk delete (confirmation required). Duplicated modules and contents store `copied_from_id` (nullable FK, ON DELETE SET NULL)
- [x] **BUILD-15**: Every bulk action runs in a single DB transaction, validates its payload with VineJS, and writes one audit_log entry listing the affected ids and the action
- [x] **BUILD-16**: Selection and the bulk action bar are fully keyboard-operable and pass the existing axe-core tests; drag handles and checkboxes do not conflict (activation constraint or dedicated handle)

### Platform Settings (Phase 5.1 — milestone v0.1; added 2026-11-03)

*Source: owner brief `.planning/todos/completed/2026-11-03-admin-platform-settings-page.md` and `05.1-CONTEXT.md` D-01..D-16.*

- [x] **SETTINGS-01**: An administrator opens `/admin/settings` from an admin-only item of the user menu and edits the singleton `AppSetting` row in four tabs (Apparence, Page d'accueil, Accès, Contact et support), each saved independently, with a French success toast; the active tab survives the save round-trip
- [x] **SETTINGS-02**: Only admins can read or write the settings: route middleware (auth + role admin) plus a controller-level policy check; teacher, manager and student get 403, anonymous visitors are redirected to `/login`
- [x] **SETTINGS-03**: Invalid input is rejected field by field in French and nothing is persisted: required name/colour/hero title, max lengths, `#RRGGBB` colour (stored uppercase), valid email, `http(s)`-only links (support URL may also be a root-relative path), image URLs root-relative or same-origin only (CSP `imgSrc` unchanged), `socialLinks` limited to facebook/twitter/linkedin/github; `headerHtml`, `footerHtml`, `isActive` and the unexposed fields cannot be written through the page
- [x] **SETTINGS-04**: Each save that changes something writes exactly one audit row (`admin.settings.update`) holding only the changed keys with their old and new values, in the same transaction as the change; a save with no change writes none and says « Aucune modification à enregistrer. »
- [x] **SETTINGS-05**: Single-instance settings, stated in code: the page works on a fresh database (creates the `is_active` row), saves update that row and never insert a second one; new nullable `announcement_text` column through a reversible migration valid on PostgreSQL, MySQL/MariaDB and SQLite; `socialLinks` stored through the shared JSON column helper; the seeder gives fresh installs the defaults without overwriting an admin's edits
- [x] **SETTINGS-06**: Every exposed setting has a visible effect: app name, logo and primary colour in the header; hero title, subtitle and image on the public home page; favicon as `<link rel="icon">`; contact email, support link and social links in the home footer; unsafe stored URLs are not rendered
- [x] **SETTINGS-07**: A plain-text announcement banner (`announcementText`, max 280) is shown at the top of the home page when set, never rendered as HTML, the contact email inside it rendered as a `mailto:` link; it replaces the hard-coded demo banner
- [x] **SETTINGS-08**: When registration is off, `GET /register`, `POST /register` and a first Google/GitHub login (account creation) are refused with « Les inscriptions sont fermées sur cette plateforme. Contactez un administrateur pour obtenir un compte. » on `/login`, and every « Inscription » / « Créer un compte » link is hidden; existing accounts still sign in, including through OAuth
- [x] **SETTINGS-09**: The settings page is accessible: every control labelled, help and errors tied with `aria-describedby`, `aria-invalid` on errors, keyboard-navigable tabs, a `#main-content` landmark, and an axe-core browser test (critical/serious) on the four tabs

### Trash and Soft Delete (Phase 5.2 — milestone v0.1; added 2026-11-05)

Owner decisions D-01..D-19 in `.planning/phases/05.2-trash-and-soft-delete/05.2-CONTEXT.md`.

- [ ] **TRASH-01**: `course_modules` and `course_contents` gain `deleted_at`, `deleted_batch` and `deleted_by_id` through a reversible migration valid on PostgreSQL, MySQL/MariaDB and SQLite; no row is lost on `up` or `down` (seeded SQLite count check)
- [ ] **TRASH-02**: Deleting a section or a content in the builder (single or bulk) moves it and its whole subtree to the trash in one batch, under the course lock, with one ids-only audit row; learner progress, file links and assignments are kept; a non-empty section can be deleted (`E_NOT_EMPTY` is gone)
- [ ] **TRASH-03**: Trashed rows are invisible in every read path (builder, course page, learn, outline, progress percentage, file download, gradebook assignments of a trashed section, moves, duplicate, create-into); the progress percentage counts each live content once
- [ ] **TRASH-04**: `/courses/:id/trash` lists the batch roots, most recent first, with title, type, original section, deleted by, deleted at and days left (warning at 3 days or fewer); it is linked from a « Corbeille (N) » button in the builder header and from the course page « Contenu » tab
- [ ] **TRASH-05**: Restore puts an item back at its original parent and position with the rows of its delete batch below it (other batches stay trashed); a section whose parent is gone or too deep returns at the end of the root sections; a content whose section is trashed offers « Restaurer aussi la section » or « Restaurer dans une autre section… » (409 `E_PARENT_TRASHED` as race guard)
- [ ] **TRASH-06**: After a builder delete, a toast « « X » déplacé dans la corbeille. » (bulk: « N éléments déplacés dans la corbeille. ») offers « Annuler » for 10 seconds, which restores the whole batch
- [ ] **TRASH-07**: Viewing the trash and restoring are open to course editors (owner, edit/manage collaborators, admins); permanent delete and « Vider la corbeille » are limited to the owner and admins, enforced server-side
- [ ] **TRASH-08**: `node ace trash:purge` (nightly cron, optional) and a lazy purge when a course trash page opens share one service that removes expired items, detaches linked assignments (submissions and grades kept), deletes a stored file only when no content references it any more, is idempotent and writes one audit row per course
- [ ] **TRASH-09**: The trash retention is set in a « Corbeille » tab of `/admin/settings`: integer days from 1 to 365, default 30, audited; lowering it applies to items already in the trash at the next purge
- [ ] **TRASH-10**: The delete confirmations (single, bulk) and the permanent-delete confirmations show the learner count over every affected content, descendants included, with the trash wording and the retention in days

### Page Content Type

- [ ] **PAGE-01**: Teacher can create Page content with WYSIWYG editor
- [ ] **PAGE-02**: WYSIWYG supports headings, bold, italic, lists, links
- [ ] **PAGE-03**: WYSIWYG supports image embedding (upload or URL)
- [ ] **PAGE-04**: WYSIWYG supports video embedding (YouTube/Vimeo URL)
- [ ] **PAGE-05**: WYSIWYG supports tables
- [ ] **PAGE-06**: Page content is sanitized before save and render (XSS prevention)
- [ ] **PAGE-07**: Student can view rendered Page content
- [ ] **PAGE-08**: Teacher can edit raw HTML and code blocks in a source mode of the editor; the content passes an allow-list sanitizer on save and on render, and no script, event handler or `javascript:` URL ever executes (owner decision 2026-10-31: Tiptap-class editor "better than TinyMCE")

### File Content Type

- [ ] **FILE-01**: Teacher can create File content by uploading a file
- [ ] **FILE-02**: Supported file types: PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, images, ZIP
- [ ] **FILE-03**: File size limit: 50MB per file
- [ ] **FILE-04**: Files are stored securely outside webroot
- [ ] **FILE-05**: Teacher can replace file after creation
- [ ] **FILE-06**: Student can download file

### URL Content Type

- [ ] **URL-01**: Teacher can create URL content with external link
- [ ] **URL-02**: URL is validated before save
- [ ] **URL-03**: Teacher can optionally add description
- [ ] **URL-04**: Student can click to open URL in new tab

### Assignment Integration

- [ ] **ASSIGN-01**: Teacher can link existing Assignment to course section
- [ ] **ASSIGN-02**: Assignment appears in course builder with link to edit
- [ ] **ASSIGN-03**: Student sees Assignment in course content with submission status

### Moodle Import

> **Moved to v2 on 2026-10-31** (kept here so the IDs stay stable): the company roadmap (`01-STRATEGIE-ARGILE` §4, design note 07 §10) places Moodle `.mbz` import in V2 (undated, not committed). Phase 11 keeps its number and is parked in the v2 milestone of `ROADMAP.md`. See `RECONCILIATION-2026-10-31.md`.

- [ ] **IMPORT-01**: Teacher can upload Moodle .mbz backup file
- [ ] **IMPORT-02**: System parses .mbz and shows import preview (sections, activities)
- [ ] **IMPORT-03**: Preview shows which activities will be imported vs skipped
- [ ] **IMPORT-04**: Teacher can confirm or cancel import
- [ ] **IMPORT-05**: Moodle sections are imported as CourseModules
- [ ] **IMPORT-06**: Moodle Page activities are imported as Page content
- [ ] **IMPORT-07**: Moodle File resources are imported as File content
- [ ] **IMPORT-08**: Moodle URL resources are imported as URL content
- [ ] **IMPORT-09**: Moodle Assignment activities create linked Assignments
- [ ] **IMPORT-10**: Embedded files are extracted and stored
- [ ] **IMPORT-11**: @@PLUGINFILE@@ references are rewritten to valid URLs

### Engagement Tracking

- [ ] **TRACK-01**: System tracks content completion per student
- [ ] **TRACK-02**: System tracks assignment submission as activity participation
- [ ] **TRACK-03**: Student sees completion checkmarks in course view
- [ ] **TRACK-04**: Teacher can view student completion status

### Permissions

- [ ] **PERM-01**: Course instructor can access builder for their courses
- [ ] **PERM-02**: Admin can access builder for any course
- [ ] **PERM-03**: Students cannot access course builder

### Rubric and Marking (lot B — milestone v1.0, 🟡 ~5 d, vault 2026-10-10; added 2026-10-31)

Needs the existing assignments / submissions / grades model; needs NO quiz builder (see `RECONCILIATION-2026-10-31.md` §2).

- [ ] **RUBRIC-01**: A `rubric` object (criteria × levels × points) exists independently of any assignment and is attached by reference to an assessment, whatever its modality (online, paper, oral, practical)
- [ ] **RUBRIC-02**: Rubrics are versioned; a version that has been used to mark anything is immutable, and editing it creates a new version (same convention the future quiz slots will use for `fixed_version`)
- [ ] **RUBRIC-03**: Marking is recorded per criterion / per question against a specific rubric version; the submission total is recomputed from the parts, never typed
- [ ] **RUBRIC-04**: When the attached grid version changes, affected marks are recomputed retroactively and the deltas are reported to the marker before they apply
- [ ] **RUBRIC-05**: Edge cases (missing criterion, out-of-range points, conflicting marks) land in a resolution queue instead of being resolved silently
- [ ] **RUBRIC-06**: Finalised marks are locked; unlocking is an explicit action that writes an `audit_logs` entry
- [ ] **RUBRIC-07**: Existing `assignments.rubric_data` / `submissions.rubric_scores` JSON is migrated to rubric objects (or kept read-only as legacy) with no data loss

### AI Governance (lots C + D — milestone v1.0, 🟡 ~8 d + ~2 d, vault 2026-10-10; added 2026-10-31)

Hard rules: no third-party plugin system (internal registries only); AI OFF by default; never build AI-text detection, proctoring, decisional automatic grading or dropout prediction. E1 was resolved by the owner on 2026-10-31: the three engines (PostgreSQL, MySQL/MariaDB, SQLite) are mandatory, so every item below must be designed and tested cross-engine.

- [ ] **AIGOV-01**: Three internal extension types exist — `ai_provider`, `ai_capability`, `ai_placement` — registered in core code (no third-party loading)
- [ ] **AIGOV-02**: A router in core resolves provider, capability and limits for a placement; it is not pluginizable
- [ ] **AIGOV-03**: Config hierarchy institution → department → course → user with monotone restriction (a lower level can only restrict), and every decision carries an explainable resolution trace (tested)
- [ ] **AIGOV-04**: Each provider declares a compliance manifest: jurisdiction, trainsOnInput, retention, subprocessors, dpaUrl, transfer mechanism, costModel, maxDataClass
- [ ] **AIGOV-05**: Data classes `public < pedagogical < student_work < assessment < sensitive`; the router refuses a request whose class exceeds the provider's maxDataClass (functional test, not a checkbox)
- [ ] **AIGOV-06**: Money budget with reservation before the call (atomic conditional update `spent + estimate <= limit`), plus `max_output_tokens` and a context cap imposed per capability — cross-engine (E1 resolved 2026-10-31): `SELECT … FOR UPDATE` plus a conditional update inside a transaction, no `UPDATE … RETURNING` (absent on MySQL/MariaDB)
- [ ] **AIGOV-07**: `ai_usage` append-only ledger (`cost_micros` integers, cached and reasoning token columns, `billed_to` stored, never prompt content) and a separate `ai_audit_log` — cross-engine (E1 resolved 2026-10-31): `jsonColumn` helper, no partitions, tested on the three engines
- [ ] **AIGOV-08**: AI is OFF by default, including after upgrades and migrations (tested)
- [ ] **AIGOV-09**: One "OpenAI-compatible" provider configured by baseURL; Ollama runs the AI tests in CI (lot D)
- [ ] **AIGOV-10**: Capability "MCQ generation": output is always `status = draft`; human validation is mandatory before any learner can see it
- [ ] **AIGOV-11**: Capability "accessibility assistance" (alt-text, summaries) with WCAG in the system prompt
- [ ] **AIGOV-12**: Implementation on the Vercel AI SDK (Apache-2.0), no external gateway; the never-build list is enforced by the absence of such capability types (tested)

### AI Act Compliance (lot E — milestone v1.0, 🟡 ~2 d; added 2026-10-31)

- [ ] **AIACT-01**: A "you are interacting with an AI" notice is shown at every AI placement and cannot be masked by any theme or customization (art. 50; tested against a theme override)
- [ ] **AIACT-02**: Emotion recognition, attention tracking and proctoring are structurally absent — no capability type, no code path, documented (art. 5; test asserts absence)
- [ ] **AIACT-03**: Opt-out and human-review request form, persisted, audited and visible to the person who filed it

### Accommodation Profile (lot F — milestone v1.0, 🟡 ~2 d; added 2026-10-31)

- [ ] **ACCOM-01**: An accommodation profile is attached to the person (extra time / time multiplier, format overrides); it is personal data (encrypted where applicable, scoped access)
- [ ] **ACCOM-02**: Time and format overrides are resolved from the profile at attempt or deadline time, never typed per attempt (tested)
- [ ] **ACCOM-03**: The profile is included in the GDPR export and in account anonymization

### Installability (lot H — milestone v1.0, 🟡 ~3 d; added 2026-10-31)

Without H the paid "installation" offer and the subscriptions do not exist.

- [ ] **INSTALL-01**: A fresh install completes in under 30 minutes from the documented steps (a timed run is recorded)
- [ ] **INSTALL-02**: Backup and restore of the database and the content storage, with a verified restore test — cross-engine (E1 resolved 2026-10-31): one documented procedure per engine (pg_dump, mysqldump, SQLite file copy)
- [ ] **INSTALL-03**: Admin documentation: install, upgrade, backup/restore, environment reference

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Builder Enhancements

- **BUILD-V2-01**: Undo/redo for builder actions
- **BUILD-V2-02**: Keyboard shortcuts for common actions
- **BUILD-V2-03**: Course preview mode (see as student)
- **BUILD-V2-04**: Course cloning/templates
- **BUILD-V2-05**: Bulk group restriction (apply a group/grouping restriction to selected items)
- **BUILD-V2-06**: Deploy one item to N courses (linked copies, idempotent job with report, same pattern as `bulk_enrollment_logs`)
- **BUILD-V2-07**: Course template × cohorts instantiation ("rentrée en un clic")
- **BUILD-V2-08**: Upstream links for shared blocks/questions/rubrics: `sync_policy` latest | pinned, "update available" review, local overrides limited to title/dates/availability/group/points, never the body; an in-progress attempt never changes version. Groundwork taken in v1: `copied_from_id` on duplicated modules and contents (BUILD-14), no UI, no sync

### Content Types

- **CONTENT-V2-01**: Quiz content type with question bank
- **CONTENT-V2-02**: H5P interactive content
- **CONTENT-V2-03**: SCORM package support
- **CONTENT-V2-04**: LTI external tool integration

### Collaboration

- **COLLAB-V2-01**: Co-teacher editing permissions
- **COLLAB-V2-02**: Real-time collaboration indicators
- **COLLAB-V2-03**: Content locking during edit

### v1.1 — autumn 2027 (company roadmap; requirements only, no phase yet; added 2026-10-31)

- **EDITOR-V11-01**: Typed JSON blocks and revisions on top of the Phase 6 editor (the Tiptap-class editor itself moved to Phase 6 / v0.1 by owner decision on 2026-10-31, see PAGE-08 and `RECONCILIATION-2026-10-31.md` §8)
- **ASSESS-V11-01**: Safe Exam Browser support
- **ASSESS-V11-02**: Track-1 / track-2 assessment labelling
- **AI-V11-01**: Course index + `retrieve` capability for grounded MCQ generation and teacher Q&A — E1 resolved 2026-10-31 (three engines mandatory): pgvector is excluded; an engine-neutral vector store is a design question for v1.1
- **THEME-V11-01**: Theme tokens by prompt
- **ACCOM-V11-01**: Accommodation profile by prompt
- *Placed in V1.1 by the vault while keeping their IDs:* **BUILD-V2-07** (course template × cohorts) and **BUILD-V2-08** (upstream links for shared blocks/questions/rubrics). *"Date shift" appears in the vault's V1.1 list; BUILD-13 (bulk date shift) is already in Phase 5 — flagged as C6, not decided.*

### v2 — undated, not committed (additions 2026-10-31)

- **PAPER-V2-01**: Full paper assessment workflow
- **PAPER-V2-02**: OMR (optical mark recognition)
- **LTI-V2-01**: LTI 1.3 platform role (the only public boundary)
- **QTI-V2-01**: Partial QTI 3 import/export
- **QA-V2-01**: Student course Q&A
- *Also v2:* **BUILD-V2-06** matrix deployment; **IMPORT-01..11** Moodle import (moved from v1, Phase 11)

### Analytics

- **ANALYTICS-V2-01**: Time-on-content tracking
- **ANALYTICS-V2-02**: Content engagement heatmap
- **ANALYTICS-V2-03**: Drop-off analysis

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Plugin architecture for content types | Build core types first; extract abstraction in v2 |
| Quiz builder | Complex (question banks, scoring); defer to v2. When built, a quiz slot source must support `latest_version` \| `fixed_version` \| `random_from_bank` |
| LTI integration | External tool configuration complexity; v2 |
| Real-time collaboration | WebSocket complexity; single editor sufficient |
| Time-on-content tracking | Completion tracking sufficient for v1 |
| Co-teacher permissions | Simple instructor + admin model for v1 |
| Full Moodle activity parity | 50+ types; import core types only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEBT-01 | Phase 1 | Complete |
| DEBT-02 | Phase 1 | Complete |
| DEBT-03 | Phase 1 | Complete |
| DEBT-04 | Phase 2 | Complete |
| DEBT-05 | Phase 2 | Complete |
| DEBT-06 | Phase 2 | Complete |
| DEBT-07 | Phase 2 | Complete |
| DEBT-08 | Phase 2 | Complete |
| DEBT-09 | Phase 2 | Complete |
| DEBT-10 | Backlog | Pending |
| EVAL-01 | Phase 3 | Pending |
| EVAL-02 | Phase 3 | Pending |
| EVAL-03 | Phase 3 | Pending |
| CONTACT-01 | Phase 3 | Pending |
| CONTACT-02 | Phase 3 | Pending |
| CONTACT-03 | Phase 3 | Pending |
| BUILD-01 | Phase 5 | Complete |
| BUILD-02 | Phase 5 | Complete |
| BUILD-03 | Phase 5 | Complete |
| BUILD-04 | Phase 5 | Complete |
| BUILD-05 | Phase 5 | Complete |
| BUILD-06 | Phase 5 | Complete |
| BUILD-07 | Phase 5 | Complete |
| BUILD-08 | Phase 5 | Complete |
| BUILD-09 | Phase 5 | Complete |
| BUILD-10 | Phase 5 | Complete |
| BUILD-11 | Phase 5 | Complete |
| BUILD-12 | Phase 5 | Complete |
| BUILD-13 | Phase 5 | Complete |
| BUILD-14 | Phase 5 | Complete |
| BUILD-15 | Phase 5 | Complete |
| BUILD-16 | Phase 5 | Complete |
| SETTINGS-01 | Phase 5.1 | Complete |
| SETTINGS-02 | Phase 5.1 | Complete |
| SETTINGS-03 | Phase 5.1 | Complete |
| SETTINGS-04 | Phase 5.1 | Complete |
| SETTINGS-05 | Phase 5.1 | Complete |
| SETTINGS-06 | Phase 5.1 | Complete |
| SETTINGS-07 | Phase 5.1 | Complete |
| SETTINGS-08 | Phase 5.1 | Complete |
| SETTINGS-09 | Phase 5.1 | Complete |
| TRASH-01 | Phase 5.2 | Pending |
| TRASH-02 | Phase 5.2 | Pending |
| TRASH-03 | Phase 5.2 | Pending |
| TRASH-04 | Phase 5.2 | Pending |
| TRASH-05 | Phase 5.2 | Pending |
| TRASH-06 | Phase 5.2 | Pending |
| TRASH-07 | Phase 5.2 | Pending |
| TRASH-08 | Phase 5.2 | Pending |
| TRASH-09 | Phase 5.2 | Pending |
| TRASH-10 | Phase 5.2 | Pending |
| PAGE-01 | Phase 6 | Pending |
| PAGE-02 | Phase 6 | Pending |
| PAGE-03 | Phase 6 | Pending |
| PAGE-04 | Phase 6 | Pending |
| PAGE-05 | Phase 6 | Pending |
| PAGE-06 | Phase 6 | Pending |
| PAGE-07 | Phase 6 | Pending |
| PAGE-08 | Phase 6 | Pending |
| FILE-01 | Phase 7 | Pending |
| FILE-02 | Phase 7 | Pending |
| FILE-03 | Phase 7 | Pending |
| FILE-04 | Phase 7 | Pending |
| FILE-05 | Phase 7 | Pending |
| FILE-06 | Phase 7 | Pending |
| URL-01 | Phase 8 | Pending |
| URL-02 | Phase 8 | Pending |
| URL-03 | Phase 8 | Pending |
| URL-04 | Phase 8 | Pending |
| ASSIGN-01 | Phase 9 | Pending |
| ASSIGN-02 | Phase 9 | Pending |
| ASSIGN-03 | Phase 9 | Pending |
| IMPORT-01 | Phase 11 (v2, moved 2026-10-31 — company roadmap) | Deferred |
| IMPORT-02 | Phase 11 (v2, moved 2026-10-31 — company roadmap) | Deferred |
| IMPORT-03 | Phase 11 (v2, moved 2026-10-31 — company roadmap) | Deferred |
| IMPORT-04 | Phase 11 (v2, moved 2026-10-31 — company roadmap) | Deferred |
| IMPORT-05 | Phase 11 (v2, moved 2026-10-31 — company roadmap) | Deferred |
| IMPORT-06 | Phase 11 (v2, moved 2026-10-31 — company roadmap) | Deferred |
| IMPORT-07 | Phase 11 (v2, moved 2026-10-31 — company roadmap) | Deferred |
| IMPORT-08 | Phase 11 (v2, moved 2026-10-31 — company roadmap) | Deferred |
| IMPORT-09 | Phase 11 (v2, moved 2026-10-31 — company roadmap) | Deferred |
| IMPORT-10 | Phase 11 (v2, moved 2026-10-31 — company roadmap) | Deferred |
| IMPORT-11 | Phase 11 (v2, moved 2026-10-31 — company roadmap) | Deferred |
| TRACK-01 | Phase 10 | Pending |
| TRACK-02 | Phase 10 | Pending |
| TRACK-03 | Phase 10 | Pending |
| TRACK-04 | Phase 10 | Pending |
| PERM-01 | Phase 12 | Pending |
| PERM-02 | Phase 12 | Pending |
| PERM-03 | Phase 12 | Pending |
| RUBRIC-01 | Phase 13 | Pending |
| RUBRIC-02 | Phase 13 | Pending |
| RUBRIC-03 | Phase 13 | Pending |
| RUBRIC-04 | Phase 13 | Pending |
| RUBRIC-05 | Phase 13 | Pending |
| RUBRIC-06 | Phase 13 | Pending |
| RUBRIC-07 | Phase 13 | Pending |
| AIGOV-01 | Phase 14 | Pending |
| AIGOV-02 | Phase 14 | Pending |
| AIGOV-03 | Phase 14 | Pending |
| AIGOV-04 | Phase 14 | Pending |
| AIGOV-05 | Phase 14 | Pending |
| AIGOV-06 | Phase 14 | Pending (cross-engine) |
| AIGOV-07 | Phase 14 | Pending (cross-engine) |
| AIGOV-08 | Phase 14 | Pending |
| AIGOV-09 | Phase 14 | Pending |
| AIGOV-10 | Phase 14 | Pending |
| AIGOV-11 | Phase 14 | Pending |
| AIGOV-12 | Phase 14 | Pending |
| AIACT-01 | Phase 15 | Pending |
| AIACT-02 | Phase 15 | Pending |
| AIACT-03 | Phase 15 | Pending |
| ACCOM-01 | Phase 16 | Pending |
| ACCOM-02 | Phase 16 | Pending |
| ACCOM-03 | Phase 16 | Pending |
| INSTALL-01 | Phase 17 | Pending |
| INSTALL-02 | Phase 17 | Pending (cross-engine) |
| INSTALL-03 | Phase 17 | Pending |

**Coverage:**

- Technical debt requirements: 16 total (DEBT ×10, EVAL ×3, CONTACT ×3)
- v1 content requirements: 41 total
- Mapped to phases: 56
- Backlog (not yet mapped to a phase): 1 (DEBT-10)
- Platform settings requirements (Phase 5.1, milestone v0.1, added 2026-11-03): 9 total (SETTINGS-01..09), all mapped
- Trash requirements (Phase 5.2, milestone v0.1, added 2026-11-05): 10 total (TRASH-01..10), all mapped

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-10-09 — technical debt requirements added, traceability renumbered for the 12-phase roadmap*
*Last updated: 2026-11-03 — SETTINGS-01..09 added for Phase 5.1 (admin platform settings)*
*Last updated: 2026-11-05 — TRASH-01..10 added for Phase 5.2 (trash and soft delete)*
