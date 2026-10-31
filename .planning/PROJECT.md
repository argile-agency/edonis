# Edonis Course Content Management

## What This Is

A course content management system for Edonis LMS that enables teachers and admins to build courses using a drag-and-drop interface with inline editing. Teachers can create content (pages, files, URLs, assignments), organize it into sections/modules, and import existing courses from Moodle via .mbz backup files. Student engagement is tracked through content completion and activity participation.

## Core Value

Easy course creation with demonstrable AI governance — teachers build and run courses fast, and the institution can prove that every AI use is off by default, policy-routed, budgeted and traceable.

*Changed 2026-10-31 (was "Easy course creation with seamless Moodle migration"): the company roadmap moves Moodle `.mbz` import to v2 and makes AI governance the commercial differentiator. See `.planning/RECONCILIATION-2026-10-31.md`.*

## Milestones (aligned with the company roadmap, 2026-10-31)

| Milestone | Date | Repo phases | Status |
|---|---|---|---|
| Course editor | 2026-11-30 | Phase 5 | planned (10 plans) |
| v0.1 MVP — teacher creates a course (sections + pages), learner follows it; internal use | 2026-12-20 | Phases 1-6 (3 after 5-6, first to drop) | 1, 2, 4 done; 3, 5 planned; 6 editor choice pending |
| v1.0 Governance baseline + first pilots | 2027-03-31 | Phases 7, 8, 10, 12, 9 (if cheap) + 13 Rubric, 14 AI governance, 15 AI Act, 16 Accommodation, 17 Installability | capacity ~7 d vs ~30 🟡 d (RECONCILIATION §3) |
| Soft launch (50 early adopters) | 2027-05-31 | — | — |
| v1.1 | autumn 2027 | requirements only (EDITOR/ASSESS/AI/THEME/ACCOM-V11, BUILD-V2-07/08) | — |
| v2 | undated | Phase 11 Moodle import, PAPER/LTI/QTI/QA-V2, BUILD-V2-06 | not committed |

## Requirements

### Validated

<!-- Shipped and confirmed valuable — existing codebase capabilities -->

- ✓ User authentication with email/password, 2FA, OAuth (Google, GitHub) — existing
- ✓ Role-based access control (admin, manager, teacher, student) — existing
- ✓ Course CRUD (create, read, update, delete courses) — existing
- ✓ Course modules/sections structure — existing
- ✓ Basic course content model (CourseContent) — existing
- ✓ Student enrollments with multiple enrollment methods — existing
- ✓ Assignment creation with rubrics and grading — existing
- ✓ Student submissions with progress tracking — existing
- ✓ Gradebook with category-based grading — existing
- ✓ Lint, typecheck and `as any` ban enforced in code; unit and functional test suites run locally — Validated in Phase 1: Code Health Baseline (GitHub Actions green on postgres/mysql/sqlite since 2026-10-19; red-PR and required-check proofs pending, see 01-HUMAN-UAT.md)
- ✓ `Course.canEnroll()` enforces its enrollment date window — Validated in Phase 1
- ✓ Content file storage foundation: `ContentFile` with checksum dedup, storage outside webroot (`CONTENT_STORAGE_PATH`), authorized `/files/:id/download` (course staff, or enrolled learners on published/available content incl. ancestor modules) — Validated in Phase 4: Content Foundation (redeploy persistence untested until first deployment)
- ✓ Authorization and validation applied uniformly: `app/policies/` (CoursePolicy, EnrollmentPolicy) replaces inline controller checks, every input action validated, transactional enrollment counters (`EnrollmentService`), category cycle rejection, PII decryption failures never returned raw (`PII_DECRYPT_STRICT`, `pii:scan`), 2FA pending timeout plus admin/CLI recovery — Validated in Phase 2: Security and Correctness Hardening (verified on SQLite only; CI on postgres/mysql, DEBT-08 production gate and browser checks pending, see 02-HUMAN-UAT.md)

### Active

<!-- Current scope. Building toward these. -->

**Course Builder:**
- [ ] Drag-and-drop course builder interface
- [ ] Inline editing of content within builder
- [ ] Reorder content items within and between sections
- [ ] Add/remove/rename sections (modules)

**Content Types:**
- [ ] Page content type with WYSIWYG rich text editor
- [ ] File content type with upload/download capability
- [ ] URL content type with link and optional embed preview
- [ ] Assignment content type integrated in builder flow

**Moodle Import** *(moved to v2 on 2026-10-31 with Phase 11 and IMPORT-01..11 — company roadmap; kept here until the v2 milestone is planned)*:
- [ ] Parse Moodle .mbz backup file structure
- [ ] Extract and map sections to CourseModules
- [ ] Import Page activities as Page content
- [ ] Import File resources as File content
- [ ] Import URL resources as URL content
- [ ] Import Assignment activities linked to existing Assignment model
- [ ] Extract embedded files and store in Edonis

**Engagement Tracking:**
- [ ] Track content completion per student
- [ ] Track activity participation (assignment submissions)
- [ ] Display completion status in course view

**Permissions:**
- [ ] Instructor can edit their own courses
- [ ] Admin can edit any course

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Plugin architecture for content types — build core types first, extract abstraction in v2
- Quiz content type — requires question bank, complex scoring; defer to v2
- LTI integration (Wooclap, Kialo) — requires external tool configuration; defer to v2
- Time-on-content tracking — completion is sufficient for v1 engagement metrics
- Co-teacher/TA editing permissions — simple instructor + admin model for v1
- Real-time collaboration — single editor at a time is sufficient for v1

## Context

**Existing Foundation:**
- CourseModule model represents sections containing content items
- CourseContent model exists for items within modules
- CourseContentsController with builder() action already present
- `/courses/:id/builder` route exists
- Assignment model with rubrics and grading already implemented
- Progress tracking infrastructure in place (ContentProgress, enrollment.progressPercentage)

**Moodle Migration:**
- Teachers have existing courses in Moodle they need to migrate
- .mbz format is a compressed archive containing:
  - `moodle_backup.xml` — backup metadata
  - `course/course.xml` — course settings
  - `sections/section_*/section.xml` — section definitions
  - `activities/*/` — activity definitions and content
  - `files/` — uploaded files referenced by contenthash

**Tech Stack:**
- AdonisJS 6 + Inertia.js + React 19
- PostgreSQL with Lucid ORM
- Tailwind CSS 4 + shadcn/ui components
- Vite for build/bundling

## Constraints

- **Tech stack**: Must use existing AdonisJS/Inertia/React stack — no separate frontend
- **File storage**: Files stored locally initially; cloud storage (S3) can be added later
- **WYSIWYG**: Use established editor library (TipTap, Lexical, or similar) — don't build from scratch
- **Moodle compatibility**: Support Moodle 3.x and 4.x backup formats (both use similar XML structure)

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CourseModule = Moodle section | Simplifies import mapping, aligns with existing model | — Pending |
| Core types before plugin system | Build concrete implementations first, extract abstraction later | — Pending |
| Inline editing in builder | Better UX than separate edit pages, matches modern course builders | — Pending |
| Instructor + admin permissions only | Simple model for v1, role-based course permissions in v2 | — Pending |
| Gradebook instructor view for admins and edit/manage co-instructors (AS2) | Matches every other course surface; they were wrongly refused | ✓ Approved 2026-10-13 |
| Course outline and progress limited to enrolled students, editors and admins (AS3); module tree sent only to editors; public draft/archived courses visible only to owner, collaborators, enrolled and admins | Closes outline/content exposure to any logged-in user | ✓ Approved 2026-10-13 (AS3) / 2026-10-28 (visibility) |
| Self and key enrolment refused when `canEnroll()` is false (AS4); leaving a course removes the user from its groups (AS5) | The server enforces what the UI only hid; group lists no longer show people who left | ✓ Approved 2026-10-13 / 2026-10-20 |
| Teachers may still publish courses directly; "Sauvegarder"/"Publier" buttons plus a platform setting for course creation requests deferred | User wants a configurable request flow (roles or users, per category) rather than forcing drafts | — Deferred (todo 2026-10-20) |

---
*Last updated: 2026-10-31 — milestones aligned with the company roadmap (v0.1 / v1.0 / v1.1 / v2), core value renamed*
