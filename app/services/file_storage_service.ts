import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, stat, unlink } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import ContentFile from '#models/content_file'
import env from '#start/env'

/**
 * Detects path traversal sequences (../ or ..\) in a relative storage path.
 */
export const PATH_TRAVERSAL_REGEX = /\.\.[\\/]/

/**
 * Only allow a conservative extension charset when building storage names.
 */
const SAFE_EXTNAME_REGEX = /^[a-z0-9]{1,16}$/i

/**
 * Project root used to anchor the content storage directory.
 *
 * In development and tests this is the application root. When the app runs
 * from the compiled output (`cd build && node bin/server.js`), the
 * application root is `build/`, which `node ace build` empties on every
 * build. In that case anchor on the source checkout that contains `build/`
 * so uploaded files survive a rebuild.
 */
export function projectRoot(): string {
  const appRoot = fileURLToPath(app.appRoot)
  const parent = dirname(appRoot)
  if (basename(appRoot) === 'build' && existsSync(join(parent, 'adonisrc.ts'))) {
    return parent
  }
  return appRoot
}

/**
 * Root directory for content blobs.
 *
 * `CONTENT_STORAGE_PATH` (absolute, or relative to the project root) wins;
 * otherwise `<project root>/storage/content_files`. Production deployments
 * should set it to a persistent volume.
 */
export function resolveContentStorageRoot(): string {
  const configured = env.get('CONTENT_STORAGE_PATH')
  return resolve(projectRoot(), configured || join('storage', 'content_files'))
}

/**
 * Stores course content files outside the webroot, deduplicated by SHA-256.
 *
 * Layout: {storage root}/{first 2 hex chars of checksum}/{cuid}.{ext}
 * The DB stores only the relative path (POSIX separators), so the storage
 * root can move without a data migration.
 */
export default class FileStorageService {
  readonly basePath: string

  constructor(basePath: string = resolveContentStorageRoot()) {
    this.basePath = resolve(basePath)
  }

  /**
   * Store an uploaded file. If a file with the same checksum already exists,
   * the existing record is returned and the temp upload is discarded, unless
   * the existing record's blob is missing on disk: then the upload is used to
   * restore it (self-heal), so re-uploading repairs a lost file.
   */
  async store(file: MultipartFile): Promise<ContentFile> {
    if (!file.tmpPath) {
      throw new Error('File has no temporary path')
    }

    const checksum = await this.computeChecksum(file.tmpPath)

    const existing = await ContentFile.findBy('checksum', checksum)
    if (existing) {
      await this.restoreBlobIfMissing(existing, file)
      return existing
    }

    const storagePath = this.buildStoragePath(checksum, file)
    const [prefix, storageName] = storagePath.split('/')
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
   * Dedup hit: keep the existing blob when it is on disk and discard the
   * upload. Otherwise move the upload (same bytes, same checksum) into the
   * record's path, or into a fresh path if the stored one is invalid.
   */
  private async restoreBlobIfMissing(record: ContentFile, file: MultipartFile): Promise<void> {
    const tmpPath = file.tmpPath!
    let target = this.resolvePath(record.storagePath)

    const kind = target ? await this.pathKind(target) : 'missing'
    if (kind === 'file') {
      await unlink(tmpPath).catch(() => {})
      return
    }

    // Invalid stored path, or something other than a file in the way
    if (!target || kind === 'other') {
      record.storagePath = this.buildStoragePath(record.checksum, file)
      target = this.resolvePath(record.storagePath)!
    }

    await mkdir(dirname(target), { recursive: true })
    try {
      await file.move(dirname(target), { name: basename(target), overwrite: false })
    } catch (error) {
      // A concurrent upload of the same bytes may have restored it first
      if ((await this.pathKind(target)) === 'file') {
        await unlink(tmpPath).catch(() => {})
        return
      }
      throw error
    }

    if (record.$isDirty) {
      await record.save()
    }
  }

  /**
   * Build a new relative storage path: {checksum[0:2]}/{cuid}.{ext}
   */
  private buildStoragePath(checksum: string, file: MultipartFile): string {
    const extname =
      file.extname && SAFE_EXTNAME_REGEX.test(file.extname) ? file.extname.toLowerCase() : 'bin'
    return posix.join(checksum.substring(0, 2), `${cuid()}.${extname}`)
  }

  private async pathKind(path: string): Promise<'file' | 'other' | 'missing'> {
    try {
      const stats = await stat(path)
      return stats.isFile() ? 'file' : 'other'
    } catch {
      return 'missing'
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
