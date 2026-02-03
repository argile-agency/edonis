# Architecture: Course Content Management

**Researched:** 2026-02-03
**Confidence:** MEDIUM

## Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │Course Builder│  │Content Viewer│  │Moodle Import Wizard │ │
│  │  - dnd-kit  │  │  - Student   │  │  - Upload/Preview   │ │
│  │  - TipTap   │  │    view      │  │  - Mapping/Execute  │ │
│  └─────────────┘  └─────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │ Inertia.js
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│  ┌──────────────────┐  ┌─────────────────┐                  │
│  │CourseContents    │  │MoodleImport     │                  │
│  │Controller        │  │Controller       │                  │
│  └────────┬─────────┘  └────────┬────────┘                  │
│           │                      │                           │
│  ┌────────▼─────────┐  ┌────────▼────────┐                  │
│  │ContentType       │  │MoodleImport     │                  │
│  │Registry          │  │Service          │                  │
│  └────────┬─────────┘  └────────┬────────┘                  │
│           │                      │                           │
│  ┌────────▼─────────────────────▼────────┐                  │
│  │         FileStorageService            │                  │
│  └───────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                       DATABASE                               │
│  CourseModule ─┬─ CourseContent ─┬─ ContentFile             │
│                │                  │                          │
│                └─ Assignment      └─ ContentProgress         │
└─────────────────────────────────────────────────────────────┘
```

## Content Type System

No plugin architecture needed for v1. Use concrete implementations:

```typescript
// app/content_types/index.ts
export const ContentTypes = {
  page: {
    name: 'Page',
    icon: 'FileText',
    hasContent: true,
    hasFile: false,
    component: 'PageEditor',
  },
  file: {
    name: 'File',
    icon: 'File',
    hasContent: false,
    hasFile: true,
    component: 'FileUploader',
  },
  url: {
    name: 'URL',
    icon: 'Link',
    hasContent: false,
    hasFile: false,
    component: 'UrlEditor',
  },
  assignment: {
    name: 'Assignment',
    icon: 'ClipboardList',
    hasContent: false,
    hasFile: false,
    component: 'AssignmentLinker',
  },
} as const
```

## Data Flow

### Builder Initialization
1. GET /courses/:id/builder
2. Controller loads course with modules.contents preloaded
3. Inertia renders builder with full tree
4. React initializes local state from props

### Content Creation
1. User clicks "Add content" in builder
2. Modal shows content type selection
3. User fills type-specific form
4. POST /modules/:moduleId/contents
5. Server validates, creates CourseContent
6. Returns updated module data
7. Client updates local state

### Drag-Drop Reorder
1. User drags content item
2. dnd-kit handles visual feedback
3. On drop: optimistic UI update
4. PATCH /contents/reorder with new order
5. Server validates, updates in transaction
6. On error: rollback UI state

### File Upload
1. User drops file in uploader
2. react-dropzone handles file
3. POST multipart to /contents/:id/file
4. Server validates (type, size, virus scan later)
5. FileStorageService stores file
6. Creates ContentFile record
7. Links to CourseContent

### Moodle Import
1. POST .mbz file to /courses/:id/import/upload
2. Server extracts to temp directory
3. Parses moodle_backup.xml for structure
4. Returns preview (sections, activities, files)
5. User confirms import
6. POST /courses/:id/import/execute
7. Server processes in background job
8. Maps sections → CourseModules
9. Maps activities → CourseContent by type
10. Extracts files → FileStorageService

## Database Extensions

### ContentFile Model (NEW)
```typescript
// app/models/content_file.ts
export default class ContentFile extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare filename: string  // Original filename

  @column()
  declare storagePath: string  // Internal path

  @column()
  declare mimeType: string

  @column()
  declare size: number  // bytes

  @column()
  declare checksum: string  // SHA256 for dedup

  @manyToMany(() => CourseContent, {
    pivotTable: 'content_content_files'
  })
  declare contents: ManyToMany<typeof CourseContent>
}
```

### Migration
```typescript
// Add to course_contents
await this.schema.alterTable('course_contents', (table) => {
  table.text('rich_content').nullable()  // TipTap JSON/HTML
  table.boolean('content_dirty').defaultTo(false)  // Unsaved changes
})

// New content_files table
await this.schema.createTable('content_files', (table) => {
  table.increments('id')
  table.string('filename', 255).notNullable()
  table.string('storage_path', 500).notNullable()
  table.string('mime_type', 100).notNullable()
  table.bigInteger('size').notNullable()
  table.string('checksum', 64).notNullable()
  table.timestamps(true)
})

// Pivot table
await this.schema.createTable('content_content_files', (table) => {
  table.integer('course_content_id').references('course_contents.id')
  table.integer('content_file_id').references('content_files.id')
  table.primary(['course_content_id', 'content_file_id'])
})
```

## FileStorageService

```typescript
// app/services/file_storage_service.ts
export default class FileStorageService {
  private basePath = app.makePath('storage/content_files')

  async store(file: MultipartFile): Promise<ContentFile> {
    const checksum = await this.computeChecksum(file)

    // Dedup: check if file already exists
    const existing = await ContentFile.findBy('checksum', checksum)
    if (existing) return existing

    // Store with random name (security)
    const storageName = `${cuid()}-${file.clientName}`
    const storagePath = path.join(this.getSubdir(checksum), storageName)

    await file.move(this.basePath, { name: storagePath })

    return ContentFile.create({
      filename: file.clientName,
      storagePath,
      mimeType: file.type,
      size: file.size,
      checksum,
    })
  }

  async getStream(file: ContentFile): Promise<Readable> {
    return fs.createReadStream(path.join(this.basePath, file.storagePath))
  }
}
```

## Build Order

| Phase | Components | Depends On | Risk |
|-------|------------|------------|------|
| 1. Content Foundation | ContentFile model, FileStorageService, content type definitions | Existing models | Low |
| 2. Builder UI | dnd-kit integration, state management, inline forms | Phase 1 | Medium |
| 3. Rich Text | TipTap integration, image embedding, sanitization | Phase 1 | Medium |
| 4. Moodle Import | MBZ parser, import wizard, type mappers | Phases 1-3 | High |

## Anti-Patterns to Avoid

1. **Don't build plugin architecture yet** — Extract patterns after v1, not before
2. **Don't store files in webroot** — Use storage directory with signed URLs
3. **Don't skip sanitization** — TipTap output must be sanitized before render
4. **Don't use blocking imports** — Large .mbz files need streaming/background job
5. **Don't trust Moodle XML** — Validate and sanitize all imported content

---
*Architecture research: 2026-02-03*
