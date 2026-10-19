import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { isAbsolute, join, posix, relative, resolve } from 'node:path'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import ContentFile from '#models/content_file'

/**
 * Detects path traversal sequences (../ or ..\) in a relative storage path.
 */
export const PATH_TRAVERSAL_REGEX = /\.\.[\\/]/

/**
 * Only allow a conservative extension charset when building storage names.
 */
const SAFE_EXTNAME_REGEX = /^[a-z0-9]{1,16}$/i

/**
 * Stores course content files outside the webroot, deduplicated by SHA-256.
 *
 * Layout: storage/content_files/{first 2 hex chars of checksum}/{cuid}.{ext}
 * The DB stores only the relative path (POSIX separators), so the storage
 * root can move without a data migration.
 */
export default class FileStorageService {
  readonly basePath: string

  constructor(basePath: string = app.makePath('storage/content_files')) {
    this.basePath = resolve(basePath)
  }

  /**
   * Store an uploaded file. If a file with the same checksum already exists,
   * the existing record is returned and the temp upload is discarded.
   */
  async store(file: MultipartFile): Promise<ContentFile> {
    if (!file.tmpPath) {
      throw new Error('File has no temporary path')
    }

    const checksum = await this.computeChecksum(file.tmpPath)

    const existing = await ContentFile.findBy('checksum', checksum)
    if (existing) {
      await unlink(file.tmpPath).catch(() => {})
      return existing
    }

    const extname =
      file.extname && SAFE_EXTNAME_REGEX.test(file.extname) ? file.extname.toLowerCase() : 'bin'
    const storageName = `${cuid()}.${extname}`
    const prefix = checksum.substring(0, 2)
    const storagePath = posix.join(prefix, storageName)
    const shardDir = join(this.basePath, prefix)

    await mkdir(shardDir, { recursive: true })
    // Throws on failure (including name collision, since overwrite is off)
    await file.move(shardDir, { name: storageName, overwrite: false })

    try {
      return await ContentFile.create({
        filename: file.clientName,
        storagePath,
        mimeType:
          file.type && file.subtype ? `${file.type}/${file.subtype}` : 'application/octet-stream',
        size: file.size,
        checksum,
      })
    } catch (error) {
      // Never leave an orphan on disk if the insert failed
      await unlink(join(shardDir, storageName)).catch(() => {})

      // Concurrent upload of the same content won the race on the unique
      // checksum constraint: return the winner's record.
      const winner = await ContentFile.findBy('checksum', checksum)
      if (winner) {
        return winner
      }
      throw error
    }
  }

  /**
   * Resolve a ContentFile's absolute path on disk.
   * Throws if the stored relative path would escape the storage root.
   */
  getFullPath(file: ContentFile): string {
    const fullPath = this.resolvePath(file.storagePath)
    if (!fullPath) {
      throw new Error('Invalid storage path')
    }
    return fullPath
  }

  /**
   * Resolve a relative storage path to an absolute path inside the storage
   * root, or return null if it is absolute, contains traversal sequences, or
   * otherwise resolves outside the root.
   */
  resolvePath(storagePath: string): string | null {
    if (!storagePath || isAbsolute(storagePath) || PATH_TRAVERSAL_REGEX.test(storagePath)) {
      return null
    }

    const fullPath = resolve(this.basePath, storagePath)
    const rel = relative(this.basePath, fullPath)
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
      return null
    }

    return fullPath
  }

  /**
   * Compute a SHA-256 checksum by streaming (constant memory for large files).
   */
  computeChecksum(filePath: string): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      const hash = createHash('sha256')
      const stream = createReadStream(filePath)

      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolvePromise(hash.digest('hex')))
      stream.on('error', reject)
    })
  }
}
