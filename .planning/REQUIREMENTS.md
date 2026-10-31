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

- [ ] **BUILD-01**: Teacher can drag-and-drop content items to reorder within a section
- [ ] **BUILD-02**: Teacher can drag-and-drop content items between sections
- [ ] **BUILD-03**: Teacher can drag-and-drop sections to reorder them
- [ ] **BUILD-04**: Teacher can add new section (module) to course
- [ ] **BUILD-05**: Teacher can rename a section
- [ ] **BUILD-06**: Teacher can delete an empty section
- [ ] **BUILD-07**: Teacher can add content item to a section (opens type selector)
- [ ] **BUILD-08**: Teacher can edit content inline (modal or expandable form in builder)
- [ ] **BUILD-09**: Teacher can delete content item from section
- [ ] **BUILD-10**: Changes are autosaved (with save indicator)
- [ ] **BUILD-11**: Teacher can select multiple content items and sections (checkboxes, select all/none, quick selections: published, unpublished, by content type); the selection count is announced via aria-live
- [ ] **BUILD-12**: Bulk publish / unpublish selected items
- [ ] **BUILD-13**: Bulk set availability window (available_from / available_until) and bulk date shift, either by N days or by "old start date → new start date" (the shift preserves relative spacing). Applies to module and content dates (available_from / available_until, due_date)
- [ ] **BUILD-14**: Bulk move to another section, bulk duplicate, bulk delete (confirmation required). Duplicated modules and contents store `copied_from_id` (nullable FK, ON DELETE SET NULL)
- [ ] **BUILD-15**: Every bulk action runs in a single DB transaction, validates its payload with VineJS, and writes one audit_log entry listing the affected ids and the action
- [ ] **BUILD-16**: Selection and the bulk action bar are fully keyboard-operable and pass the existing axe-core tests; drag handles and checkboxes do not conflict (activation constraint or dedicated handle)

### Page Content Type

- [ ] **PAGE-01**: Teacher can create Page content with WYSIWYG editor
- [ ] **PAGE-02**: WYSIWYG supports headings, bold, italic, lists, links
- [ ] **PAGE-03**: WYSIWYG supports image embedding (upload or URL)
- [ ] **PAGE-04**: WYSIWYG supports video embedding (YouTube/Vimeo URL)
- [ ] **PAGE-05**: WYSIWYG supports tables
- [ ] **PAGE-06**: Page content is sanitized before save and render (XSS prevention)
- [ ] **PAGE-07**: Student can view rendered Page content

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

Hard rules: no third-party plugin system (internal registries only); AI OFF by default; never build AI-text detection, proctoring, decisional automatic grading or dropout prediction. E1-dependent items are marked.

- [ ] **AIGOV-01**: Three internal extension types exist — `ai_provider`, `ai_capability`, `ai_placement` — registered in core code (no third-party loading)
- [ ] **AIGOV-02**: A router in core resolves provider, capability and limits for a placement; it is not pluginizable
- [ ] **AIGOV-03**: Config hierarchy institution → department → course → user with monotone restriction (a lower level can only restrict), and every decision carries an explainable resolution trace (tested)
- [ ] **AIGOV-04**: Each provider declares a compliance manifest: jurisdiction, trainsOnInput, retention, subprocessors, dpaUrl, transfer mechanism, costModel, maxDataClass
- [ ] **AIGOV-05**: Data classes `public < pedagogical < student_work < assessment < sensitive`; the router refuses a request whose class exceeds the provider's maxDataClass (functional test, not a checkbox)
- [ ] **AIGOV-06**: Money budget with reservation before the call (atomic conditional update `spent + estimate <= limit`), plus `max_output_tokens` and a context cap imposed per capability — **E1-dependent** (`UPDATE … RETURNING` is not available on MySQL/MariaDB)
- [ ] **AIGOV-07**: `ai_usage` append-only ledger (`cost_micros` integers, cached and reasoning token columns, `billed_to` stored, never prompt content) and a separate `ai_audit_log` — **E1-dependent** (partitions, JSONB/GIN)
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
- [ ] **INSTALL-02**: Backup and restore of the database and the content storage, with a verified restore test — **E1-dependent** (one procedure per engine while E1 is open)
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

- **EDITOR-V11-01**: Tiptap editor with typed JSON blocks and revisions (🟡 10-20 d, vault); the MVP editor choice is pending (see `RECONCILIATION-2026-10-31.md` C1)
- **ASSESS-V11-01**: Safe Exam Browser support
- **ASSESS-V11-02**: Track-1 / track-2 assessment labelling
- **AI-V11-01**: Course index + `retrieve` capability for grounded MCQ generation and teacher Q&A — E1-dependent (pgvector)
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
| BUILD-01 | Phase 5 | Pending |
| BUILD-02 | Phase 5 | Pending |
| BUILD-03 | Phase 5 | Pending |
| BUILD-04 | Phase 5 | Pending |
| BUILD-05 | Phase 5 | Pending |
| BUILD-06 | Phase 5 | Pending |
| BUILD-07 | Phase 5 | Pending |
| BUILD-08 | Phase 5 | Pending |
| BUILD-09 | Phase 5 | Pending |
| BUILD-10 | Phase 5 | Pending |
| BUILD-11 | Phase 5 | Pending |
| BUILD-12 | Phase 5 | Pending |
| BUILD-13 | Phase 5 | Pending |
| BUILD-14 | Phase 5 | Pending |
| BUILD-15 | Phase 5 | Pending |
| BUILD-16 | Phase 5 | Pending |
| PAGE-01 | Phase 6 | Pending |
| PAGE-02 | Phase 6 | Pending |
| PAGE-03 | Phase 6 | Pending |
| PAGE-04 | Phase 6 | Pending |
| PAGE-05 | Phase 6 | Pending |
| PAGE-06 | Phase 6 | Pending |
| PAGE-07 | Phase 6 | Pending |
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
| AIGOV-06 | Phase 14 | Pending (E1-dependent) |
| AIGOV-07 | Phase 14 | Pending (E1-dependent) |
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
| INSTALL-02 | Phase 17 | Pending (E1-dependent) |
| INSTALL-03 | Phase 17 | Pending |

**Coverage:**

- Technical debt requirements: 16 total (DEBT ×10, EVAL ×3, CONTACT ×3)
- v1 content requirements: 41 total
- Mapped to phases: 56
- Backlog (not yet mapped to a phase): 1 (DEBT-10)

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-10-09 — technical debt requirements added, traceability renumbered for the 12-phase roadmap*
