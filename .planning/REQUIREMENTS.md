# Requirements: Edonis Course Content Management

**Defined:** 2026-02-03
**Core Value:** Easy course creation with seamless Moodle migration

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
| BUILD-01 | TBD | Pending |
| BUILD-02 | TBD | Pending |
| BUILD-03 | TBD | Pending |
| BUILD-04 | TBD | Pending |
| BUILD-05 | TBD | Pending |
| BUILD-06 | TBD | Pending |
| BUILD-07 | TBD | Pending |
| BUILD-08 | TBD | Pending |
| BUILD-09 | TBD | Pending |
| BUILD-10 | TBD | Pending |
| PAGE-01 | TBD | Pending |
| PAGE-02 | TBD | Pending |
| PAGE-03 | TBD | Pending |
| PAGE-04 | TBD | Pending |
| PAGE-05 | TBD | Pending |
| PAGE-06 | TBD | Pending |
| PAGE-07 | TBD | Pending |
| FILE-01 | TBD | Pending |
| FILE-02 | TBD | Pending |
| FILE-03 | TBD | Pending |
| FILE-04 | TBD | Pending |
| FILE-05 | TBD | Pending |
| FILE-06 | TBD | Pending |
| URL-01 | TBD | Pending |
| URL-02 | TBD | Pending |
| URL-03 | TBD | Pending |
| URL-04 | TBD | Pending |
| ASSIGN-01 | TBD | Pending |
| ASSIGN-02 | TBD | Pending |
| ASSIGN-03 | TBD | Pending |
| IMPORT-01 | TBD | Pending |
| IMPORT-02 | TBD | Pending |
| IMPORT-03 | TBD | Pending |
| IMPORT-04 | TBD | Pending |
| IMPORT-05 | TBD | Pending |
| IMPORT-06 | TBD | Pending |
| IMPORT-07 | TBD | Pending |
| IMPORT-08 | TBD | Pending |
| IMPORT-09 | TBD | Pending |
| IMPORT-10 | TBD | Pending |
| IMPORT-11 | TBD | Pending |
| TRACK-01 | TBD | Pending |
| TRACK-02 | TBD | Pending |
| TRACK-03 | TBD | Pending |
| TRACK-04 | TBD | Pending |
| PERM-01 | TBD | Pending |
| PERM-02 | TBD | Pending |
| PERM-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 0
- Unmapped: 41 (pending roadmap)

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after initial definition*
