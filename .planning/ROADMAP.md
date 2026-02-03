# Roadmap: Edonis Course Content Management

## Overview

This roadmap transforms Edonis from a course administration system into a full course authoring platform. The journey begins with foundational infrastructure (content models, file storage), builds the drag-and-drop builder interface, implements each content type (Page, File, URL, Assignment), adds engagement tracking, enables Moodle migration, and concludes with permissions and polish. Teachers will be able to build courses visually and import existing Moodle courses on day one.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Content Foundation** - Database models and file storage service
- [ ] **Phase 2: Builder UI** - Drag-and-drop interface with section management
- [ ] **Phase 3: Page Content** - WYSIWYG rich text editor integration
- [ ] **Phase 4: File Content** - File upload, storage, and download
- [ ] **Phase 5: URL Content** - External link management
- [ ] **Phase 6: Assignment Integration** - Link assignments to course sections
- [ ] **Phase 7: Engagement Tracking** - Content completion and progress display
- [ ] **Phase 8: Moodle Import** - Parse and import .mbz backup files
- [ ] **Phase 9: Permissions and Polish** - Access control and final refinements

## Phase Details

### Phase 1: Content Foundation
**Goal**: Establish database models and file storage infrastructure that all content types will use
**Depends on**: Nothing (first phase)
**Requirements**: None directly (infrastructure enables BUILD-*, FILE-*, IMPORT-10)
**Success Criteria** (what must be TRUE):
  1. ContentFile model exists with filename, storage path, MIME type, size, and checksum fields
  2. FileStorageService can store files outside webroot with random names
  3. FileStorageService can retrieve files by ID and serve downloads
  4. Files are deduplicated by checksum (same file uploaded twice uses same storage)
**Plans**: 1 plan

Plans:
- [ ] 01-01-PLAN.md — ContentFile model, FileStorageService, and file download endpoint

### Phase 2: Builder UI
**Goal**: Teachers can visually organize course content with drag-and-drop
**Depends on**: Phase 1
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05, BUILD-06, BUILD-07, BUILD-08, BUILD-09, BUILD-10
**Success Criteria** (what must be TRUE):
  1. Teacher can drag content items to reorder within a section
  2. Teacher can drag content items between sections
  3. Teacher can drag sections to reorder them
  4. Teacher can add, rename, and delete sections
  5. Changes are autosaved with visible save indicator
**Plans**: TBD

Plans:
- [ ] 02-01: Drag-and-drop with dnd-kit
- [ ] 02-02: Section CRUD operations
- [ ] 02-03: Autosave and state management

### Phase 3: Page Content
**Goal**: Teachers can create rich text pages with embedded media
**Depends on**: Phase 2
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04, PAGE-05, PAGE-06, PAGE-07
**Success Criteria** (what must be TRUE):
  1. Teacher can create Page content with WYSIWYG editor in builder
  2. WYSIWYG supports headings, formatting, lists, links, tables
  3. Teacher can embed images (upload or URL) and videos (YouTube/Vimeo)
  4. Content is sanitized on save and render (no XSS)
  5. Student can view rendered Page content in course view
**Plans**: TBD

Plans:
- [ ] 03-01: TipTap editor integration
- [ ] 03-02: Media embedding (images, videos)
- [ ] 03-03: Sanitization and student view

### Phase 4: File Content
**Goal**: Teachers can upload files for students to download
**Depends on**: Phase 1, Phase 2
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, FILE-06
**Success Criteria** (what must be TRUE):
  1. Teacher can create File content by uploading a file
  2. System accepts PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, images, ZIP (up to 50MB)
  3. Files are stored securely outside webroot
  4. Teacher can replace file after creation
  5. Student can download file from course view
**Plans**: TBD

Plans:
- [ ] 04-01: File upload UI with react-dropzone
- [ ] 04-02: File validation and storage
- [ ] 04-03: File download and replacement

### Phase 5: URL Content
**Goal**: Teachers can add external links to course content
**Depends on**: Phase 2
**Requirements**: URL-01, URL-02, URL-03, URL-04
**Success Criteria** (what must be TRUE):
  1. Teacher can create URL content with external link
  2. URL is validated before save
  3. Teacher can add optional description
  4. Student can click to open URL in new tab
**Plans**: TBD

Plans:
- [ ] 05-01: URL content type with validation

### Phase 6: Assignment Integration
**Goal**: Teachers can link existing assignments into course sections
**Depends on**: Phase 2
**Requirements**: ASSIGN-01, ASSIGN-02, ASSIGN-03
**Success Criteria** (what must be TRUE):
  1. Teacher can link existing Assignment to a course section
  2. Assignment appears in builder with link to edit assignment details
  3. Student sees Assignment in course content with their submission status
**Plans**: TBD

Plans:
- [ ] 06-01: Assignment linking in builder
- [ ] 06-02: Student assignment view with status

### Phase 7: Engagement Tracking
**Goal**: Track and display student progress through course content
**Depends on**: Phase 3, Phase 4, Phase 5, Phase 6
**Requirements**: TRACK-01, TRACK-02, TRACK-03, TRACK-04
**Success Criteria** (what must be TRUE):
  1. System tracks content completion per student (Page viewed, File downloaded, URL clicked)
  2. Assignment submission counts as activity participation
  3. Student sees completion checkmarks in course view
  4. Teacher can view student completion status for course content
**Plans**: TBD

Plans:
- [ ] 07-01: Content completion tracking
- [ ] 07-02: Progress display (student and teacher views)

### Phase 8: Moodle Import
**Goal**: Teachers can import existing Moodle courses via .mbz backup files
**Depends on**: Phase 3, Phase 4, Phase 5, Phase 6
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
- [ ] 08-01: MBZ parsing service
- [ ] 08-02: Import preview UI
- [ ] 08-03: Content import execution
- [ ] 08-04: File extraction and reference resolution

### Phase 9: Permissions and Polish
**Goal**: Secure access control and final quality improvements
**Depends on**: Phase 2, Phase 7
**Requirements**: PERM-01, PERM-02, PERM-03
**Success Criteria** (what must be TRUE):
  1. Course instructor can access builder for their own courses only
  2. Admin can access builder for any course
  3. Students cannot access course builder (proper 403 response)
  4. All builder features work consistently across content types
**Plans**: TBD

Plans:
- [ ] 09-01: Builder access control middleware
- [ ] 09-02: Final polish and edge cases

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Content Foundation | 0/1 | Ready to execute | - |
| 2. Builder UI | 0/3 | Not started | - |
| 3. Page Content | 0/3 | Not started | - |
| 4. File Content | 0/3 | Not started | - |
| 5. URL Content | 0/1 | Not started | - |
| 6. Assignment Integration | 0/2 | Not started | - |
| 7. Engagement Tracking | 0/2 | Not started | - |
| 8. Moodle Import | 0/4 | Not started | - |
| 9. Permissions and Polish | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-03*
*Total phases: 9 | Total plans: 21 (estimated)*
