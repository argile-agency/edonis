# Pitfalls: Course Content Management

**Researched:** 2026-02-03
**Confidence:** MEDIUM

## Critical Pitfalls

### 1. Drag-and-Drop State Desync (Phase 1)

**What goes wrong:** Racing reorder requests corrupt order values when optimistic UI updates don't match server state.

**Why it happens:** Current `reorderModules`/`reorderContents` lack transactions. Multiple rapid drags cause race conditions.

**Consequences:** Content appears in wrong order, inconsistent across page loads, data corruption.

**Prevention:**
- Use database transactions for order updates
- Server generates order values (not client)
- Version field for optimistic locking
- Debounce rapid reorder requests

**Warning signs:** Order differs between users, order changes on refresh.

### 2. WYSIWYG XSS Vulnerability (Phase 2)

**What goes wrong:** Malicious HTML in content field executes when rendered.

**Why it happens:** Content validator accepts raw HTML without sanitization.

**Consequences:** Account takeover, data theft, malicious redirects.

**Prevention:**
- Sanitize with DOMPurify on SAVE and RENDER
- Allowlist tags (no script, iframe, event handlers)
- Content-Security-Policy headers
- Separate render component shared between edit/view

**Warning signs:** Script tags in database, unusual content behavior.

### 3. File Upload Security Holes (Phase 3)

**What goes wrong:** Malicious files uploaded, executed, or cause storage issues.

**Why it happens:** Trusting file extensions, storing in webroot, no size limits.

**Consequences:** Server compromise, malware distribution, storage exhaustion.

**Prevention:**
- Validate magic bytes (not just extension)
- Random filenames (prevent path traversal)
- Store outside webroot
- Per-type size limits (images: 10MB, docs: 50MB)
- Consider virus scanning in v2

**Warning signs:** Executable files in storage, unusual file types.

### 4. Moodle XML Injection - XXE (Phase 4)

**What goes wrong:** XML parser loads external entities, leaking server files.

**Why it happens:** Default XML parser settings allow external entities.

**Consequences:** Server file disclosure, SSRF, denial of service.

**Prevention:**
- Configure fast-xml-parser with `{ ignoreAttributes: false, parseAttributeValue: false }`
- Disable external entity resolution
- Validate XML structure before parsing
- Sandbox extraction to temp directory

**Warning signs:** Parser errors, unusual network requests during import.

### 5. Content Reference Integrity (Phases 3-4)

**What goes wrong:** Imported/moved content has broken file references.

**Why it happens:** Moodle uses `@@PLUGINFILE@@` placeholders; moving content doesn't update URLs.

**Consequences:** Broken images, missing downloads, frustrated users.

**Prevention:**
- Content-addressed file storage (by checksum)
- Resolve URLs at render time (not storage time)
- Import preview shows broken references
- Garbage collection for orphaned files

**Warning signs:** 404s for content files, @@PLUGINFILE@@ visible in content.

## Moderate Pitfalls

### 6. Editor Performance (Phase 2)

**What goes wrong:** TipTap editor becomes slow with large documents (>100KB HTML).

**Prevention:** Lazy-load editor, virtualize long documents, warn on large pastes.

### 7. Drag-and-Drop Accessibility (Phase 1)

**What goes wrong:** Keyboard users can't reorder content.

**Prevention:** dnd-kit includes keyboard support; ensure it's enabled and tested.

### 8. Module Hierarchy Depth (Phase 1)

**What goes wrong:** Deep nesting causes N+1 queries, UI confusion.

**Prevention:** Limit depth to 3 levels, use `getDepth()` check before allowing nesting.

### 9. Concurrent Editing (Phases 1-2)

**What goes wrong:** Two users edit same content, one overwrites the other.

**Prevention:** Optimistic locking with `updatedAt` check; warn on stale save.

### 10. Moodle Activity Type Mismatch (Phase 4)

**What goes wrong:** Unsupported Moodle activity types cause import failures.

**Prevention:** Import preview lists all activities with support status; skip unsupported with warning.

## Minor Pitfalls

### 11. Order Value Fragmentation

**What goes wrong:** After many reorders, order values have large gaps.

**Prevention:** Periodic reindex in background job (low priority).

### 12. Preview vs Student View Mismatch

**What goes wrong:** Teacher preview differs from actual student experience.

**Prevention:** Share render component between preview and student view.

### 13. Lost Focus After Drag

**What goes wrong:** Keyboard focus lost after drag operation.

**Prevention:** dnd-kit's focusable utilities; restore focus to moved item.

## Phase Mapping

| Phase | Critical Pitfalls |
|-------|------------------|
| Phase 1: Builder/DnD | State desync, accessibility, depth, concurrent editing |
| Phase 2: Page/WYSIWYG | XSS sanitization, editor performance, preview/view parity |
| Phase 3: File Upload | Security validation, storage location, reference integrity |
| Phase 4: Moodle Import | XXE prevention, type mismatch, reference rewriting |

## Prevention Checklist

Before each phase is complete, verify:

- [ ] **Phase 1:** Reorder uses transactions, keyboard DnD works, depth limited
- [ ] **Phase 2:** DOMPurify on save AND render, shared render component
- [ ] **Phase 3:** Magic byte validation, random filenames, outside webroot
- [ ] **Phase 4:** XXE disabled, import preview with warnings, file references resolved

---
*Pitfalls research: 2026-02-03*
