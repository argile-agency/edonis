import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import FileStorageService, { resolveContentStorageRoot } from '#services/file_storage_service'
import ContentFile from '#models/content_file'
import env from '#start/env'

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Minimal stand-in for a bodyparser MultipartFile: a temp file on disk plus
 * the metadata and `move()` behaviour FileStorageService relies on.
 */
async function fakeUpload(
  tmpDir: string,
  content: string,
  clientName: string,
  extname: string | undefined = clientName.split('.').pop()
) {
  const tmpPath = join(tmpDir, `upload-${uniqueSuffix()}`)
  await writeFile(tmpPath, content)

  const file = {
    tmpPath,
    clientName,
    extname,
    type: 'application',
    subtype: 'pdf',
    size: Buffer.byteLength(content),
    async move(location: string, options: { name: string }) {
      await rename(tmpPath, join(location, options.name))
    },
  }

  return file as unknown as MultipartFile
}

test.group('FileStorageService', (group) => {
  let basePath: string
  let tmpDir: string

  group.each.setup(async () => {
    const root = await mkdtemp(join(tmpdir(), 'edonis-file-storage-'))
    basePath = join(root, 'content_files')
    tmpDir = join(root, 'uploads')
    await mkdir(tmpDir, { recursive: true })

    const cleanupDb = await testUtils.db().withGlobalTransaction()
    return async () => {
      await cleanupDb()
      await rm(root, { recursive: true, force: true })
    }
  })

  test('computes a SHA-256 checksum by streaming', async ({ assert }) => {
    const service = new FileStorageService(basePath)
    const path = join(tmpDir, 'hello.txt')
    await writeFile(path, 'hello world')

    assert.equal(
      await service.computeChecksum(path),
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
    )
  })

  test('stores a new file in a checksum-sharded directory', async ({ assert }) => {
    const service = new FileStorageService(basePath)
    const content = `unique-content-${uniqueSuffix()}`
    const record = await service.store(await fakeUpload(tmpDir, content, 'Syllabus.PDF'))

    assert.equal(record.filename, 'Syllabus.PDF')
    assert.equal(record.mimeType, 'application/pdf')
    assert.equal(record.size, Buffer.byteLength(content))
    assert.lengthOf(record.checksum, 64)
    assert.match(record.storagePath, new RegExp(`^${record.checksum.slice(0, 2)}/[a-z0-9]+\\.pdf$`))
    assert.isTrue(existsSync(service.getFullPath(record)))
  })

  test('returns the existing record for duplicate content and discards the upload', async ({
    assert,
  }) => {
    const service = new FileStorageService(basePath)
    const content = `duplicate-content-${uniqueSuffix()}`

    const first = await service.store(await fakeUpload(tmpDir, content, 'a.pdf'))
    const secondUpload = await fakeUpload(tmpDir, content, 'b.pdf')
    const second = await service.store(secondUpload)

    assert.equal(second.id, first.id)
    assert.equal(second.storagePath, first.storagePath)
    assert.isFalse(existsSync(secondUpload.tmpPath!))

    const count = await ContentFile.query().where('checksum', first.checksum).count('* as total')
    assert.equal(Number(count[0].$extras.total), 1)
  })

  test('re-uploading restores a missing blob at the existing record path', async ({ assert }) => {
    const service = new FileStorageService(basePath)
    const content = `self-heal-${uniqueSuffix()}`

    const first = await service.store(await fakeUpload(tmpDir, content, 'a.pdf'))
    await rm(service.getFullPath(first))

    const reupload = await fakeUpload(tmpDir, content, 'b.pdf')
    const healed = await service.store(reupload)

    assert.equal(healed.id, first.id)
    assert.equal(healed.storagePath, first.storagePath)
    assert.equal(await readFile(service.getFullPath(healed), 'utf8'), content)
    assert.isFalse(existsSync(reupload.tmpPath!))
  })

  test('re-uploading repairs a record whose storage path is invalid', async ({ assert }) => {
    const service = new FileStorageService(basePath)
    const content = `self-heal-invalid-${uniqueSuffix()}`

    const first = await service.store(await fakeUpload(tmpDir, content, 'a.pdf'))
    first.storagePath = '../outside.pdf'
    await first.save()

    const healed = await service.store(await fakeUpload(tmpDir, content, 'a.pdf'))
    const reloaded = await ContentFile.findOrFail(first.id)

    assert.equal(healed.id, first.id)
    assert.match(
      reloaded.storagePath,
      new RegExp(`^${first.checksum.slice(0, 2)}/[a-z0-9]+\\.pdf$`)
    )
    assert.equal(await readFile(service.getFullPath(reloaded), 'utf8'), content)
  })

  test('falls back to .bin for missing or unsafe extensions', async ({ assert }) => {
    const service = new FileStorageService(basePath)
    const record = await service.store(
      await fakeUpload(tmpDir, `ext-${uniqueSuffix()}`, 'evil', '../../x')
    )

    assert.match(record.storagePath, /\.bin$/)
  })

  test('resolvePath rejects traversal and absolute paths', ({ assert }) => {
    const service = new FileStorageService(basePath)

    assert.isNull(service.resolvePath('../secret.txt'))
    assert.isNull(service.resolvePath('ab/../../secret.txt'))
    assert.isNull(service.resolvePath('ab\\..\\..\\secret.txt'))
    assert.isNull(service.resolvePath('/etc/passwd'))
    assert.isNull(service.resolvePath(''))
    assert.equal(service.resolvePath('ab/file.pdf'), join(basePath, 'ab', 'file.pdf'))
  })
})

test.group('FileStorageService - storage root', (group) => {
  let previous: string | undefined

  group.each.setup(() => {
    previous = env.get('CONTENT_STORAGE_PATH')
    return () => env.set('CONTENT_STORAGE_PATH', previous ?? '')
  })

  test('defaults to storage/content_files under the project root', ({ assert }) => {
    env.set('CONTENT_STORAGE_PATH', '')

    assert.equal(resolveContentStorageRoot(), app.makePath('storage', 'content_files'))
    assert.equal(new FileStorageService().basePath, app.makePath('storage', 'content_files'))
  })

  test('honours an absolute CONTENT_STORAGE_PATH', ({ assert }) => {
    const absolute = join(tmpdir(), 'edonis-configured-root')
    env.set('CONTENT_STORAGE_PATH', absolute)

    assert.equal(resolveContentStorageRoot(), absolute)
    assert.equal(new FileStorageService().basePath, absolute)
  })

  test('resolves a relative CONTENT_STORAGE_PATH against the project root', ({ assert }) => {
    env.set('CONTENT_STORAGE_PATH', 'var/files')

    assert.equal(resolveContentStorageRoot(), app.makePath('var', 'files'))
  })
})
