# Edonis Course Content Management

## What This Is

A course content management system for Edonis LMS that enables teachers and admins to build courses using a drag-and-drop interface with inline editing. Teachers can create content (pages, files, URLs, assignments), organize it into sections/modules, and import existing courses from Moodle via .mbz backup files. Student engagement is tracked through content completion and activity participation.

## Core Value

Easy course creation with seamless Moodle migration — teachers can import their existing Moodle courses and immediately start teaching.

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

**Moodle Import:**
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

---
*Last updated: 2026-02-03 after initialization*
