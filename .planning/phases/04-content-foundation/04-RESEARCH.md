# Phase 1: Content Foundation - Research

**Researched:** 2026-02-03
**Domain:** File storage infrastructure and content file management for AdonisJS 6 LMS
**Confidence:** HIGH

## Summary

This phase establishes the foundational infrastructure for file storage that all content types will use. The codebase already has patterns for file uploads (avatar handling in `profile_controller.ts`) but stores files in the public webroot. This phase creates a secure, deduplicated file storage system outside the webroot.

The standard approach for AdonisJS 6 file storage uses the built-in `@adonisjs/drive` package (wrapper around FlyDrive), which provides unified access to local filesystem and cloud providers. For deduplication, use SHA-256 checksums computed via Node.js crypto streams. Files should be stored outside webroot in `storage/content_files/` and served through a dedicated controller with path traversal protection.

Key findings:
- AdonisJS Drive 3.4.1 is the stable version for v6; provides `moveToDisk` method on MultipartFile
- Deduplication by SHA-256 checksum is industry standard; compute hash before storing
- Files outside webroot require explicit serving via `response.download()` with security checks
- Existing CourseContent model already has file fields (`fileUrl`, `fileName`, `fileSize`, `fileType`)

**Primary recommendation:** Create a ContentFile model for deduplicated file storage, implement FileStorageService using native Node.js fs/crypto (without Drive initially for simplicity), and link ContentFile to CourseContent via many-to-many relationship.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js crypto | Built-in | SHA-256 checksum computation | Native, no dependencies, stream-based for large files |
| Node.js fs/promises | Built-in | File system operations | Native async API, already used in codebase |
| @adonisjs/core/helpers | ^6.18 | cuid() for random filenames | Already in codebase, collision-resistant IDs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @adonisjs/drive | ^3.4.1 | File storage abstraction | Future: when S3/cloud storage needed |
| file-type | ^19.x | MIME type validation by magic bytes | Future: strict file validation beyond extension |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fs/crypto | @adonisjs/drive | Drive adds abstraction for cloud storage but adds complexity for local-only storage |
| SHA-256 | BLAKE3 | BLAKE3 is faster but SHA-256 is more widely supported and sufficient for deduplication |
| Many-to-many files | Embedded in CourseContent | Many-to-many enables true deduplication; same file used by multiple contents |

**Installation:**
```bash
# No new packages required - using built-in Node.js modules
# Already have: node:crypto, node:fs/promises, node:path
```

## Architecture Patterns

### Recommended Project Structure
```
app/
├── models/
│   └── content_file.ts         # NEW: ContentFile model
├── services/
│   └── file_storage_service.ts # NEW: FileStorageService
├── controllers/
│   └── files_controller.ts     # NEW: File serving controller
storage/
└── content_files/              # NEW: File storage directory (gitignored)
    ├── 00/                     # Sharded by checksum prefix
    ├── 01/
    └── ...
database/
└── migrations/
    └── XXXX_create_content_files_table.ts  # NEW
    └── XXXX_create_content_content_files_table.ts  # NEW (pivot)
```

### Pattern 1: Checksum-Based Deduplication
**What:** Before storing a file, compute its SHA-256 hash. If a file with that hash already exists, return the existing record instead of storing duplicate.
**When to use:** Every file upload/store operation
**Example:**
```typescript
// Source: Node.js crypto documentation
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

async function computeChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}
```

### Pattern 2: Sharded Storage Directory
**What:** Store files in subdirectories based on checksum prefix (first 2 characters) to avoid filesystem performance issues with many files in one directory.
**When to use:** All file storage operations
**Example:**
```typescript
// storage/content_files/a3/a3f2b1c4d5e6...randomname.pdf
function getStoragePath(checksum: string, filename: string): string {
  const prefix = checksum.substring(0, 2)  // First 2 chars of hash
  return `${prefix}/${checksum.substring(0, 8)}-${filename}`
}
```

### Pattern 3: Secure File Serving with Path Traversal Protection
**What:** Serve files from storage directory via controller with explicit security checks
**When to use:** All file download routes
**Example:**
```typescript
// Source: AdonisJS documentation + Adocasts patterns
import { normalize, sep } from 'node:path'

const PATH_TRAVERSAL_REGEX = /\.\.[\\/]/

export default class FilesController {
  async show({ params, response }: HttpContext) {
    const fileId = params.id
    const file = await ContentFile.find(fileId)

    if (!file) {
      return response.notFound()
    }

    const normalizedPath = normalize(file.storagePath)
    if (PATH_TRAVERSAL_REGEX.test(normalizedPath)) {
      return response.badRequest({ message: 'Malformed path' })
    }

    const fullPath = app.makePath('storage/content_files', normalizedPath)
    return response.download(fullPath, file.filename)
  }
}
```

### Anti-Patterns to Avoid
- **Storing files in public directory:** Files in `public/` are directly accessible without authorization checks. Store content files in `storage/` outside webroot.
- **Using file extension for MIME type:** Extensions can be spoofed. Store the MIME type from upload validation or compute from magic bytes.
- **Storing full path in database:** Store only relative path within storage directory. This enables moving storage location without database migration.
- **Creating nested directories on each upload:** Pre-create shard directories (00-ff) or use `{ recursive: true }` to avoid race conditions.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique filenames | Sequential counter | cuid() from @adonisjs/core/helpers | Already used in codebase, collision-resistant |
| Checksum computation | Custom hashing | Node.js crypto.createHash('sha256') | Native, battle-tested, stream-based |
| File validation | Size/type checking | request.file() validation options | Built into AdonisJS bodyparser |
| Path normalization | String manipulation | path.normalize() + regex check | Handle edge cases across platforms |

**Key insight:** File storage seems simple but has many edge cases (path traversal, encoding, concurrent access, large files). Use native Node.js APIs which handle platform differences.

## Common Pitfalls

### Pitfall 1: Blocking Operations on Large Files
**What goes wrong:** Using `readFileSync` or loading entire file into memory for checksum computation
**Why it happens:** Simpler code pattern, works for small files
**How to avoid:** Always use streaming APIs (`createReadStream`, `hash.update(chunk)`)
**Warning signs:** Memory spikes during file uploads, 2GB+ files causing crashes

### Pitfall 2: Race Conditions in Deduplication
**What goes wrong:** Two simultaneous uploads of same file both check for existing, both find none, both create
**Why it happens:** Check-then-insert without transaction
**How to avoid:** Use unique constraint on checksum column, handle constraint violation gracefully (return existing)
**Warning signs:** Duplicate files in storage with same checksum

### Pitfall 3: Orphaned Files
**What goes wrong:** Files exist in storage but no database record points to them
**Why it happens:** Database insert fails after file write, or file write succeeds partially
**How to avoid:** Write file first with temp name, then insert record, then rename to final name. Consider cleanup job.
**Warning signs:** Storage size grows larger than expected based on ContentFile records

### Pitfall 4: MIME Type Spoofing
**What goes wrong:** Accepting claimed MIME type without validation
**Why it happens:** Trusting `file.type` from client
**How to avoid:** Validate via AdonisJS `extnames` option (checks extension), consider magic byte validation for security-sensitive uploads
**Warning signs:** Files with wrong extensions being served with wrong Content-Type

### Pitfall 5: Forgetting to Gitignore Storage
**What goes wrong:** Storage directory gets committed to git
**Why it happens:** New directory not added to .gitignore
**How to avoid:** Add `storage/content_files/` to .gitignore, use `.gitkeep` file to preserve directory structure
**Warning signs:** Large repository size, binary files in commits

## Code Examples

Verified patterns from official sources and existing codebase:

### ContentFile Model
```typescript
// app/models/content_file.ts
// Pattern from existing models in codebase
import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import CourseContent from '#models/course_content'

export default class ContentFile extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare filename: string  // Original filename for display/download

  @column()
  declare storagePath: string  // Relative path within storage/content_files/

  @column()
  declare mimeType: string

  @column()
  declare size: number  // bytes

  @column()
  declare checksum: string  // SHA-256 hex, unique constraint

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @manyToMany(() => CourseContent, {
    pivotTable: 'content_content_files',
    pivotTimestamps: true,
  })
  declare contents: ManyToMany<typeof CourseContent>
}
```

### FileStorageService
```typescript
// app/services/file_storage_service.ts
// Pattern from existing services + AdonisJS file handling docs
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, unlink, stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { join, dirname } from 'node:path'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'
import ContentFile from '#models/content_file'
import type { MultipartFile } from '@adonisjs/core/bodyparser'

export default class FileStorageService {
  private basePath = app.makePath('storage/content_files')

  /**
   * Store a file, deduplicating by checksum
   */
  async store(file: MultipartFile): Promise<ContentFile> {
    if (!file.tmpPath) {
      throw new Error('File has no temporary path')
    }

    // Compute checksum from temp file
    const checksum = await this.computeChecksum(file.tmpPath)

    // Check for existing file with same checksum (deduplication)
    const existing = await ContentFile.findBy('checksum', checksum)
    if (existing) {
      // Clean up temp file since we won't use it
      await unlink(file.tmpPath).catch(() => {})
      return existing
    }

    // Generate storage path with sharding
    const storageName = `${cuid()}.${file.extname}`
    const prefix = checksum.substring(0, 2)
    const storagePath = join(prefix, storageName)
    const fullPath = join(this.basePath, storagePath)

    // Ensure directory exists
    await mkdir(dirname(fullPath), { recursive: true })

    // Move file from temp to storage
    await file.move(dirname(fullPath), { name: storageName })

    // Create database record
    return ContentFile.create({
      filename: file.clientName,
      storagePath,
      mimeType: file.type ?? 'application/octet-stream',
      size: file.size,
      checksum,
    })
  }

  /**
   * Get full filesystem path for a ContentFile
   */
  getFullPath(file: ContentFile): string {
    return join(this.basePath, file.storagePath)
  }

  /**
   * Compute SHA-256 checksum using streams
   */
  private async computeChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256')
      const stream = createReadStream(filePath)

      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }
}
```

### File Download Route and Controller
```typescript
// start/routes.ts - Add to existing routes
router.get('/files/:id/download', [FilesController, 'download']).as('files.download')

// app/controllers/files_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { normalize } from 'node:path'
import app from '@adonisjs/core/services/app'
import ContentFile from '#models/content_file'

const PATH_TRAVERSAL_REGEX = /\.\.[\\/]/

export default class FilesController {
  async download({ params, response }: HttpContext) {
    const file = await ContentFile.find(params.id)

    if (!file) {
      return response.notFound({ message: 'File not found' })
    }

    const normalizedPath = normalize(file.storagePath)
    if (PATH_TRAVERSAL_REGEX.test(normalizedPath)) {
      return response.badRequest({ message: 'Invalid file path' })
    }

    const fullPath = app.makePath('storage/content_files', normalizedPath)

    return response.download(fullPath, file.filename)
  }
}
```

### Migration for content_files Table
```typescript
// database/migrations/XXXX_create_content_files_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'content_files'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('filename', 255).notNullable()
      table.string('storage_path', 500).notNullable()
      table.string('mime_type', 100).notNullable()
      table.bigInteger('size').unsigned().notNullable()
      table.string('checksum', 64).notNullable().unique()  // SHA-256 hex = 64 chars

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Index for deduplication lookups
      table.index(['checksum'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

### Migration for Pivot Table
```typescript
// database/migrations/XXXX_create_content_content_files_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'content_content_files'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('course_content_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('course_contents')
        .onDelete('CASCADE')

      table.integer('content_file_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('content_files')
        .onDelete('CASCADE')

      table.primary(['course_content_id', 'content_file_id'])
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store in public/ directory | Store in storage/ outside webroot | Security best practice | Files require controller to serve, enables authorization |
| Trust file extension | Validate via extnames + optionally magic bytes | Ongoing | Prevents MIME type spoofing |
| @adonisjs/drive v2 | @adonisjs/drive v3.4.1 (FlyDrive wrapper) | August 2024 | New API, better cloud support |
| Single storage directory | Sharded directories by hash prefix | Performance at scale | Avoids filesystem limits (~10k files per directory) |

**Deprecated/outdated:**
- `file.move()` to public directory: Use storage directory instead for content files
- Relying on `file.type` from client: Always validate server-side

## Open Questions

Things that couldn't be fully resolved:

1. **Authorization for file downloads**
   - What we know: Files should be served through controller, not static middleware
   - What's unclear: Should file access check course enrollment? Or is file ID obscurity sufficient for now?
   - Recommendation: For Phase 1, serve files by ID without enrollment check. Add authorization in later phase when building content viewer.

2. **Cleanup of orphaned files**
   - What we know: Files can become orphaned if pivot table entries deleted but file still has no references
   - What's unclear: When should cleanup run? How to handle files referenced by multiple contents?
   - Recommendation: Add reference counting or periodic cleanup job in later phase. Many-to-many naturally handles multi-reference.

3. **Maximum file size**
   - What we know: bodyparser currently limits to 20mb, but course files (videos) could be larger
   - What's unclear: What's the expected maximum file size for LMS content?
   - Recommendation: Keep 20mb for now, increase per-route if needed for video upload feature.

## Sources

### Primary (HIGH confidence)
- [AdonisJS File Uploads Documentation](https://docs.adonisjs.com/guides/basics/file-uploads) - File validation, moveToDisk, MultipartFile API
- [AdonisJS Drive Documentation](https://docs.adonisjs.com/guides/digging-deeper/drive) - Storage abstraction, configuration
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html) - createHash, streaming hash computation
- Existing codebase: `app/controllers/profile_controller.ts` - Avatar upload pattern
- Existing codebase: `app/models/course_content.ts` - Current file field definitions

### Secondary (MEDIUM confidence)
- [Adocasts: Using Wildcard Route Param to Download Storage Images](https://adocasts.com/lessons/using-a-wildcard-route-param-to-download-storage-images) - Path traversal protection pattern
- [@adonisjs/drive GitHub Releases](https://github.com/adonisjs/drive/releases) - Version 3.4.1 confirmed current stable

### Tertiary (LOW confidence)
- File deduplication best practices from [Design Gurus](https://www.designgurus.io/answers/detail/how-would-you-manage-large-file-storage-multipart-checksums-dedupe) - General CAS patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using native Node.js modules, verified against AdonisJS docs
- Architecture: HIGH - Patterns verified from existing codebase and official documentation
- Pitfalls: MEDIUM - Common patterns, but specific to this implementation

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable infrastructure patterns)
