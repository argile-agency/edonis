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

- [ ] **DEBT-04**: Resource-ownership authorization is centralized in `app/policies/` instead of inline controller checks
- [ ] **DEBT-05**: Every controller action accepting user input has a validator (5 validators for 16 controllers today)
- [ ] **DEBT-06**: Enrollment counter mutations (`enrolledCount`, `currentEnrollments`) run inside a database transaction
- [ ] **DEBT-07**: Category tree building detects and rejects cycles instead of looping indefinitely
- [ ] **DEBT-08**: Decryption failures are logged and never returned raw in all modes; raises when PII_DECRYPT_STRICT=true
- [ ] **DEBT-09**: 2FA pending state has an explicit timeout and a documented recovery path (recovery codes or admin unlock)

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

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Builder Enhancements

- **BUILD-V2-01**: Undo/redo for builder actions
- **BUILD-V2-02**: Keyboard shortcuts for common actions
- **BUILD-V2-03**: Course preview mode (see as student)
- **BUILD-V2-04**: Course cloning/templates

### Content Types

- **CONTENT-V2-01**: Quiz content type with question bank
- **CONTENT-V2-02**: H5P interactive content
- **CONTENT-V2-03**: SCORM package support
- **CONTENT-V2-04**: LTI external tool integration

### Collaboration

- **COLLAB-V2-01**: Co-teacher editing permissions
- **COLLAB-V2-02**: Real-time collaboration indicators
- **COLLAB-V2-03**: Content locking during edit

### Analytics

- **ANALYTICS-V2-01**: Time-on-content tracking
- **ANALYTICS-V2-02**: Content engagement heatmap
- **ANALYTICS-V2-03**: Drop-off analysis

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Plugin architecture for content types | Build core types first; extract abstraction in v2 |
| Quiz builder | Complex (question banks, scoring); defer to v2 |
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
| DEBT-04 | Phase 2 | Pending |
| DEBT-05 | Phase 2 | Pending |
| DEBT-06 | Phase 2 | Pending |
| DEBT-07 | Phase 2 | Pending |
| DEBT-08 | Phase 2 | Pending |
| DEBT-09 | Phase 2 | Pending |
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
| IMPORT-01 | Phase 11 | Pending |
| IMPORT-02 | Phase 11 | Pending |
| IMPORT-03 | Phase 11 | Pending |
| IMPORT-04 | Phase 11 | Pending |
| IMPORT-05 | Phase 11 | Pending |
| IMPORT-06 | Phase 11 | Pending |
| IMPORT-07 | Phase 11 | Pending |
| IMPORT-08 | Phase 11 | Pending |
| IMPORT-09 | Phase 11 | Pending |
| IMPORT-10 | Phase 11 | Pending |
| IMPORT-11 | Phase 11 | Pending |
| TRACK-01 | Phase 10 | Pending |
| TRACK-02 | Phase 10 | Pending |
| TRACK-03 | Phase 10 | Pending |
| TRACK-04 | Phase 10 | Pending |
| PERM-01 | Phase 12 | Pending |
| PERM-02 | Phase 12 | Pending |
| PERM-03 | Phase 12 | Pending |

**Coverage:**

- Technical debt requirements: 16 total (DEBT ×10, EVAL ×3, CONTACT ×3)
- v1 content requirements: 41 total
- Mapped to phases: 56
- Backlog (not yet mapped to a phase): 1 (DEBT-10)

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-10-09 — technical debt requirements added, traceability renumbered for the 12-phase roadmap*
