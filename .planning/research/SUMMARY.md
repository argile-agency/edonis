# Project Research Summary

**Project:** Edonis Course Content Management
**Domain:** Learning Management System (Course Authoring)
**Researched:** 2026-02-03
**Confidence:** MEDIUM

## Executive Summary

This project builds a modern course authoring system with drag-and-drop editing and seamless Moodle migration. Research shows that successful course builders combine three elements: (1) intuitive drag-and-drop using modern libraries like dnd-kit, (2) inline WYSIWYG editing via TipTap, and (3) robust import capabilities for legacy platforms. The existing codebase already has strong foundations (CourseModule, CourseContent models, Assignment system with rubrics), making this primarily a frontend enhancement with targeted backend extensions.

The recommended approach follows a four-phase build: start with drag-and-drop foundation and state management (lowest risk), add WYSIWYG editing with proper security (medium risk), implement file storage and handling (medium risk), then tackle Moodle import as the complex capstone (highest risk). This order ensures early user value while deferring the most complex work until simpler patterns are validated.

Critical risks center on security and data integrity. XSS vulnerabilities in rich text content, file upload exploits, and XML External Entity (XXE) attacks during Moodle import are all preventable with proper sanitization, validation, and parser configuration. Additionally, race conditions in drag-drop reordering can corrupt content order if not handled with database transactions and optimistic locking. Each phase has specific mitigation strategies that must be implemented before moving forward.

## Key Findings

### Recommended Stack

The stack leverages modern, actively-maintained libraries that integrate well with the existing AdonisJS/Inertia/React architecture. All recommendations avoid deprecated technologies and prioritize TypeScript support, accessibility, and developer experience.

**Core technologies:**
- **@dnd-kit/core + @dnd-kit/sortable**: Drag-and-drop engine — Modern React hooks-based library with built-in accessibility, replaces deprecated react-beautiful-dnd
- **@tiptap/react + extensions**: WYSIWYG editor — Best developer experience, modular extension system, active development, MIT license
- **react-dropzone**: File upload UI — Lightweight, accessible, hooks-based file picker for frontend
- **AdonisJS Drive**: File storage abstraction — Already integrated in AdonisJS, supports local and cloud storage
- **tar + fast-xml-parser**: Moodle import — Zero native dependencies, TypeScript types, safe XML parsing

**What to avoid:**
- react-beautiful-dnd (deprecated), Lexical (steeper learning curve), Draft.js (deprecated), CKEditor (complex licensing)

### Expected Features

Edonis already has most table stakes features implemented. This project focuses on authoring experience improvements and migration tooling.

**Must have (table stakes):**
- Content organization (sections/modules) — EXISTING via CourseModule
- Content types (page, file, URL, assignment) — Models exist, need UI implementation
- Progress tracking — EXISTING via ContentProgress model
- Draft/published states — EXISTING via isPublished field

**Should have (competitive):**
- Drag-and-drop builder interface — Primary differentiator, modern UX expectation
- Inline WYSIWYG editing — Better than separate edit pages, matches modern course builders
- Moodle .mbz import — Critical for adoption by institutions migrating from Moodle
- Content preview — Shows student view while editing

**Defer (v2+):**
- Plugin architecture — Build core types first, extract patterns later
- Quiz builder with question banks — Complex scoring system, separate feature set
- LTI integration — External tool configuration complexity
- Real-time collaboration — Single editor sufficient for v1
- Co-teacher permissions — Simple instructor + admin model for v1

### Architecture Approach

The architecture extends existing models with new UI layers and backend services. No plugin system needed; concrete implementations for four content types (page, file, URL, assignment) are sufficient for v1.

**Major components:**
1. **Course Builder UI** — React component with dnd-kit, manages local state, sends reorder/update requests
2. **Content Type Registry** — Simple object mapping types to editor components and capabilities (hasContent, hasFile)
3. **FileStorageService** — Handles file uploads with deduplication by checksum, stores outside webroot with random names
4. **MoodleImportService** — Parses .mbz archives, maps sections to CourseModules, extracts files, handles @@PLUGINFILE@@ references
5. **ContentFile Model** (NEW) — Many-to-many with CourseContent, stores filename, storage path, MIME type, size, and checksum

**Data flow patterns:**
- Builder initialization: Single load with preloaded modules.contents, initialize React state from props
- Drag-drop reorder: Optimistic UI update, PATCH /contents/reorder, rollback on error
- Content creation: Modal type selection, type-specific form, POST /modules/:id/contents, update local state
- File upload: POST multipart to /contents/:id/file, validate size/type/magic bytes, store via FileStorageService
- Moodle import: Upload .mbz, parse to preview, user confirms, background job processes sections/activities/files

### Critical Pitfalls

Research identified five critical vulnerabilities that must be prevented in specific phases:

1. **Drag-drop state desync (Phase 1)** — Racing reorder requests corrupt order values when optimistic UI doesn't match server state. Prevention: Use database transactions for order updates, server generates order values, version field for optimistic locking, debounce rapid requests.

2. **WYSIWYG XSS vulnerability (Phase 2)** — Malicious HTML in content field executes when rendered, enabling account takeover. Prevention: Sanitize with DOMPurify on SAVE and RENDER, allowlist tags (no script/iframe/handlers), Content-Security-Policy headers, shared render component between edit/view.

3. **File upload security holes (Phase 3)** — Malicious files uploaded, executed, or exhaust storage. Prevention: Validate magic bytes not just extension, random filenames prevent path traversal, store outside webroot, per-type size limits.

4. **XML External Entity (XXE) injection (Phase 4)** — XML parser loads external entities, leaking server files during Moodle import. Prevention: Configure fast-xml-parser to disable external entities, validate XML structure before parsing, sandbox extraction to temp directory.

5. **Content reference integrity (Phases 3-4)** — Imported/moved content has broken file references due to Moodle's @@PLUGINFILE@@ placeholders. Prevention: Content-addressed file storage by checksum, resolve URLs at render time not storage time, import preview shows broken references.

## Implications for Roadmap

Based on research, suggested four-phase structure ordered by risk and dependencies:

### Phase 1: Builder Foundation (Drag-and-Drop)
**Rationale:** Lowest risk, highest user value, no external dependencies. Establishes state management patterns reused in later phases.

**Delivers:** Working drag-and-drop course builder with section and content reordering.

**Addresses:** Inline editing foundation, content organization (existing), drag-and-drop interface (differentiator)

**Implements:** dnd-kit integration, CourseContentsController updates, reorder transactions

**Avoids:** State desync (critical pitfall #1) via transactions and optimistic locking

**Security checklist:**
- Reorder uses database transactions
- Keyboard drag-and-drop works (accessibility)
- Module depth limited to 3 levels
- Optimistic locking with updatedAt check

### Phase 2: Content Pages (WYSIWYG)
**Rationale:** Builds on Phase 1 state management, medium complexity. TipTap integration is well-documented but requires security attention.

**Delivers:** Rich text page editor with image embedding, inline editing within builder.

**Uses:** @tiptap/react + extensions (from STACK.md)

**Implements:** Page content type, TipTap integration, DOMPurify sanitization

**Avoids:** XSS vulnerability (critical pitfall #2) via sanitization on save AND render

**Security checklist:**
- DOMPurify sanitizes on save and render
- Shared render component between edit/view
- Content-Security-Policy headers configured
- No script/iframe/event handlers in allowlist

### Phase 3: File Management
**Rationale:** Required before Moodle import (Phase 4). File storage patterns must be proven before handling extracted Moodle files.

**Delivers:** File and URL content types, file upload/download, deduplication by checksum.

**Implements:** ContentFile model, FileStorageService, react-dropzone UI

**Avoids:** File security holes (critical pitfall #3) and reference integrity (critical pitfall #5)

**Security checklist:**
- Magic byte validation (not just extension)
- Random filenames prevent path traversal
- Files stored outside webroot
- Per-type size limits enforced

### Phase 4: Moodle Import
**Rationale:** Most complex, highest risk. Depends on all previous phases (builder UI, page editor, file storage). Should only start after other patterns validated.

**Delivers:** .mbz upload wizard, section/activity mapping, file extraction, import preview with warnings.

**Uses:** tar + fast-xml-parser (from STACK.md)

**Implements:** MoodleImportService, import wizard UI, background job processing

**Avoids:** XXE injection (critical pitfall #4) and reference integrity (critical pitfall #5)

**Security checklist:**
- XXE disabled in fast-xml-parser config
- Import preview lists all activities with support status
- @@PLUGINFILE@@ references resolved to actual files
- Unsupported activity types skipped with warning

### Phase Ordering Rationale

This order follows three principles discovered in research:

1. **Risk progression**: Start with proven patterns (dnd-kit, TipTap are mature libraries), defer complex custom logic (Moodle XML parsing) until foundation solid
2. **Dependency chain**: File storage must exist before Moodle import, builder UI must exist before inline editing, state management must work before adding complexity
3. **Incremental value**: Each phase delivers usable features independently — teachers can build courses after Phase 1, add content after Phase 2, upload files after Phase 3, then finally import existing courses

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 4 (Moodle Import):** Moodle 3.x vs 4.x XML schema variations need investigation, activity type mapping completeness requires validation against real .mbz files

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Builder):** dnd-kit documentation is comprehensive, drag-drop patterns well-established
- **Phase 2 (WYSIWYG):** TipTap documentation excellent, sanitization patterns standard
- **Phase 3 (File Management):** File upload security is well-documented domain, AdonisJS Drive patterns proven

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Libraries verified as actively maintained, versions need checking before installation |
| Features | MEDIUM | Table stakes validated against existing codebase, differentiators inferred from modern course builders |
| Architecture | MEDIUM | Patterns align with AdonisJS conventions, no plugin abstraction reduces complexity |
| Pitfalls | MEDIUM | Security vulnerabilities researched from OWASP/NIST guidance, Moodle-specific issues from community reports |

**Overall confidence:** MEDIUM

Research confidence is medium across the board because this synthesizes best practices from established patterns rather than official specifications. Technology choices are verified (libraries exist, are actively maintained, have good TypeScript support) but specific version compatibility hasn't been tested. Architecture recommendations align with AdonisJS patterns in the existing codebase. Security pitfalls are based on common vulnerabilities in similar systems (WYSIWYG editors, file uploads, XML parsers) rather than penetration testing of Edonis specifically.

### Gaps to Address

Areas where research was inconclusive or needs validation during implementation:

- **Moodle schema variations**: Real .mbz files from Moodle 3.x vs 4.x may have undocumented differences — validate with actual teacher-provided backups during Phase 4 planning
- **TipTap performance**: Research indicates potential slowdowns with >100KB HTML documents, but threshold depends on editor configuration — monitor during Phase 2, add lazy loading if needed
- **File deduplication edge cases**: Checksum-based deduplication works for identical files, but handling near-duplicates (same file, different metadata) needs product decision — document in Phase 3 planning
- **Content migration completeness**: Moodle has 50+ activity types; research identified core types (page, file, URL, assignment) but long-tail coverage unknown — acceptable to skip unsupported types with warnings

## Sources

### Primary (HIGH confidence)
- **@dnd-kit/core documentation** — Verified library status, accessibility features, React hooks API
- **@tiptap/react documentation** — Extension system, security recommendations, TypeScript support
- **AdonisJS 6 documentation** — Drive service configuration, multipart file handling, Lucid ORM patterns
- **OWASP guidelines** — XSS prevention (sanitization), file upload security (magic bytes, path traversal), XXE prevention

### Secondary (MEDIUM confidence)
- **Moodle community forums** — .mbz structure, common import issues, @@PLUGINFILE@@ handling patterns
- **fast-xml-parser documentation** — XXE prevention configuration, parsing performance characteristics
- **React ecosystem comparisons** — Library deprecation status (react-beautiful-dnd, Draft.js), replacement recommendations

### Tertiary (LOW confidence)
- **Course builder UX patterns** — Inferred from modern LMS interfaces, not validated with user research
- **Moodle 3.x vs 4.x differences** — Community reports suggest similar XML structure, needs validation with real files

---
*Research completed: 2026-02-03*
*Ready for roadmap: yes*
