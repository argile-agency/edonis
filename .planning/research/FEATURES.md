# Feature Landscape: Course Content Management

**Researched:** 2026-02-03
**Confidence:** MEDIUM

## Table Stakes

Features users expect. Missing = product feels incomplete.

### Content Organization (EXISTING)
- Sections/Modules — CourseModule model
- Content ordering — `order` field
- Nested sections — `parentId` support
- Draft/Published state — `isPublished` field
- Availability dates — `availableFrom`, `availableUntil`

### Content Types (PARTIAL)
- Page (rich text) — Model exists, needs WYSIWYG editor
- File upload/download — Model exists, needs storage implementation
- URL/Link — Model exists, needs embed preview
- Assignment — EXISTING full model with rubrics
- Video embed — `externalUrl` field exists

### Progress Tracking (EXISTING)
- Completion tracking — ContentProgress model
- Progress percentage — getCourseProgress() helper
- Completion types — view, submit, grade, manual

## Differentiators

Features that create competitive advantage.

### Course Builder UX (PRIORITY)
| Feature | Complexity | Priority |
|---------|------------|----------|
| Inline editing | High | P1 - Active |
| Drag-and-drop | Medium | P1 - Active |
| WYSIWYG rich text | High | P1 - Active |
| Content preview | Medium | P2 |
| Autosave | Medium | P2 |

### Migration (PRIORITY)
| Feature | Complexity | Priority |
|---------|------------|----------|
| Moodle .mbz import | High | P1 - Active |
| Course cloning | Low | P2 |
| Course backup/export | Medium | P2 |

## Anti-Features

Deliberately NOT building in v1:

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Plugin architecture | Premature abstraction; build core types first |
| Quiz builder | Complex (question banks, scoring); defer to v2 |
| LTI integration | External tool config complexity; defer to v2 |
| Real-time collaboration | WebSocket complexity; single editor sufficient |
| Co-teacher permissions | Simple model for v1; expand in v2 |
| Full Moodle parity | 50+ activity types; import core types only |

## Feature Dependencies

```
Course Builder Foundation
    ├── Modules/Sections (EXISTING)
    │       └── Content Items (EXISTING)
    │               ├── Page → WYSIWYG Editor
    │               ├── File → File Storage
    │               ├── URL → Link Preview (optional)
    │               └── Assignment (EXISTING)
    ├── Drag-and-Drop → dnd-kit library
    └── Inline Editing → WYSIWYG (shared)

Moodle Import
    ├── MBZ Parser → XML + file extraction
    └── Activity Importers → depends on content types
```

## Moodle Import Mapping

| Moodle Entity | Edonis Entity |
|---------------|---------------|
| Section | CourseModule |
| Page activity | Page CourseContent |
| Resource (file) | File CourseContent |
| URL activity | URL CourseContent |
| Assignment | Assignment model |

### Import Pitfalls
- Embedded files use `@@PLUGINFILE@@` markers needing replacement
- Character encoding variations
- Large .mbz files need streaming extraction
- Moodle 3.x vs 4.x schema variations

---
*Feature research: 2026-02-03*
