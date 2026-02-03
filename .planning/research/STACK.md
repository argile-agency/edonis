# Technology Stack: Course Content Management

**Researched:** 2026-02-03
**Confidence:** MEDIUM (verify versions before implementation)

## Recommended Stack

### Drag-and-Drop

| Technology | Purpose | Why |
|------------|---------|-----|
| **@dnd-kit/core** | Core drag-drop engine | Modern, accessible, React hooks-based, replaces deprecated react-beautiful-dnd |
| @dnd-kit/sortable | Sortable list primitives | Optimized for reordering, handles nested lists |
| @dnd-kit/utilities | CSS transforms, sensors | Smooth animations, touch support |

**What NOT to use:**
- `react-beautiful-dnd` — Deprecated by Atlassian
- `react-dnd` — Lower-level, poorer accessibility defaults

### WYSIWYG Rich Text Editor

| Technology | Purpose | Why |
|------------|---------|-----|
| **@tiptap/react** | React editor wrapper | Best DX, modular extensions, active development, MIT license |
| @tiptap/starter-kit | Essential extensions | Paragraph, bold, italic, lists, headings |
| @tiptap/extension-image | Image embedding | Drag-drop images, resize handles |
| @tiptap/extension-link | URL links | Auto-detection, custom link UI |
| @tiptap/extension-table | Table support | Common in course content |
| @tiptap/extension-placeholder | Empty state | Better UX for content creation |
| @tiptap/extension-youtube | Video embeds | Common in course content |

**What NOT to use:**
- `Lexical` — Steeper learning curve, smaller extension ecosystem
- `Draft.js` — Deprecated by Meta
- `Quill` — Aging architecture, less TypeScript-friendly
- `CKEditor` — Complex licensing (GPL or commercial)

### File Upload & Storage

| Technology | Purpose | Why |
|------------|---------|-----|
| **AdonisJS Drive** | File storage abstraction | Native to AdonisJS 6, supports local + S3/GCS |
| AdonisJS bodyparser | Multipart parsing | Already configured, handles uploads |
| **react-dropzone** | Frontend file picker | Lightweight, accessible, hooks-based |

**Existing Configuration:**
- `config/bodyparser.ts` — multipart enabled, 20mb limit
- Avatar upload pattern exists in `profile_controller.ts`

### Moodle .mbz Import

| Technology | Purpose | Why |
|------------|---------|-----|
| **tar** | Archive extraction | Native Node.js tar handling, no native deps |
| **fast-xml-parser** | XML parsing | Fastest XML parser, zero dependencies, TypeScript types |

**.mbz Structure:**
```
backup.mbz (tar.gz)
├── moodle_backup.xml     # Backup metadata
├── course/course.xml     # Course settings
├── sections/section_*/   # Section definitions
├── activities/           # Activity XML files
└── files/                # Binary files by contenthash
```

## Installation

```bash
# Frontend
bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
bun add @tiptap/react @tiptap/starter-kit @tiptap/pm
bun add @tiptap/extension-image @tiptap/extension-link @tiptap/extension-table
bun add @tiptap/extension-placeholder @tiptap/extension-youtube
bun add react-dropzone

# Backend
bun add tar fast-xml-parser
bun add -d @types/tar
```

## Integration Notes

- TipTap needs client-only rendering (use dynamic import with `ssr: false`)
- dnd-kit is SSR-safe
- File uploads via Inertia `router.post()` with FormData
- TipTap outputs HTML that should be sanitized with DOMPurify

---
*Stack research: 2026-02-03*
