import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import User from '#models/user'
import Role from '#models/role'
import Course from '#models/course'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import CourseEnrollment, { type EnrollmentStatus } from '#models/course_enrollment'
import CoursePermission from '#models/course_permission'
import ContentFile from '#models/content_file'
import FileStorageService from '#services/file_storage_service'
import env from '#start/env'

/**
 * Unique suffix so fixtures never collide with seeded rows or each other.
 * `courses.code` is limited to 20 chars.
 */
function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function uniqueCourseCode() {
  return `F${Date.now() % 1_000_000_000}${Math.floor(Math.random() * 1_000_000)}`
}

async function createUser(prefix: string) {
  return User.create({
    email: `${prefix}-${uniqueSuffix()}@test.com`,
    password: 'password',
    fullName: `Test ${prefix}`,
  })
}

const FILE_BODY = 'Lecture notes: week 1'

/**
 * Per-test temporary storage root, wired into FilesController through
 * CONTENT_STORAGE_PATH so tests never write into the real storage folder.
 */
let storageRoot: string

/**
 * Real file on disk under <storageRoot>/<shard>/ so the download path is
 * exercised end-to-end. The storage root is removed in teardown.
 */
async function createStoredFile(shard: string) {
  const name = `${uniqueSuffix()}.txt`
  await mkdir(join(storageRoot, shard), { recursive: true })
  await writeFile(join(storageRoot, shard, name), FILE_BODY)

  return ContentFile.create({
    storagePath: `${shard}/${name}`,
    size: Buffer.byteLength(FILE_BODY),
    checksum: createHash('sha256').update(uniqueSuffix()).digest('hex'),
  })
}

/**
 * Instructor-owned published course with one module, one content linked to
 * a stored file (or to `overrides.file`, to share one blob between courses)
 * under `overrides.filename`, and an actively enrolled student.
 */
async function createCourseWithFile(
  shard: string,
  overrides: {
    contentPublished?: boolean
    enrollmentStatus?: EnrollmentStatus
    courseStatus?: Course['status']
    file?: ContentFile
    filename?: string
  } = {}
) {
  const instructor = await createUser('instructor')
  const student = await createUser('student')

  const course = await Course.create({
    code: uniqueCourseCode(),
    title: 'Files 101',
    instructorId: instructor.id,
    status: overrides.courseStatus ?? 'published',
    visibility: 'public',
  })

  const module = await CourseModule.create({
    courseId: course.id,
    title: 'Week 1',
    isPublished: true,
  })

  const content = await CourseContent.create({
    moduleId: module.id,
    contentType: 'file',
    title: 'Notes',
    isPublished: overrides.contentPublished ?? true,
  })

  const file = overrides.file ?? (await createStoredFile(shard))
  await content.related('files').attach({
    [file.id]: { filename: overrides.filename ?? 'Week 1 notes.txt', mime_type: 'text/plain' },
  })

  await CourseEnrollment.create({
    userId: student.id,
    courseId: course.id,
    status: overrides.enrollmentStatus ?? 'active',
    enrolledAt: DateTime.now(),
  })

  return { instructor, student, course, module, content, file }
}

test.group('Files - download authorization', (group) => {
  let shard: string

  group.each.setup(async () => {
    shard = 'ab'
    storageRoot = await mkdtemp(join(tmpdir(), 'edonis-content-files-'))
    const previousStoragePath = env.get('CONTENT_STORAGE_PATH')
    env.set('CONTENT_STORAGE_PATH', storageRoot)

    const cleanupDb = await testUtils.db().withGlobalTransaction()
    return async () => {
      await cleanupDb()
      env.set('CONTENT_STORAGE_PATH', previousStoragePath ?? '')
      await rm(storageRoot, { recursive: true, force: true })
    }
  })

  test('serves files from the configured storage root', ({ assert }) => {
    assert.equal(new FileStorageService().basePath, resolve(storageRoot))
  })

  test('unauthenticated user is redirected to login', async ({ client, route }) => {
    const { file } = await createCourseWithFile(shard)

    const response = await client.get(route('files.download', { id: file.id })).redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test('enrolled student can download with the original filename', async ({
    client,
    route,
    assert,
  }) => {
    const { student, file } = await createCourseWithFile(shard)

    const response = await client.get(route('files.download', { id: file.id })).loginAs(student)

    response.assertStatus(200)
    assert.equal(response.text(), FILE_BODY)
    assert.include(response.header('content-disposition'), 'Week 1 notes.txt')
  })

  test('course owner can download', async ({ client, route }) => {
    const { instructor, file } = await createCourseWithFile(shard)

    const response = await client.get(route('files.download', { id: file.id })).loginAs(instructor)

    response.assertStatus(200)
  })

  test('course staff with view permission can download unpublished content', async ({
    client,
    route,
  }) => {
    const { course, file } = await createCourseWithFile(shard, { contentPublished: false })
    const assistant = await createUser('assistant')
    await CoursePermission.create({
      courseId: course.id,
      userId: assistant.id,
      permissionLevel: 'view',
    })

    const response = await client.get(route('files.download', { id: file.id })).loginAs(assistant)

    response.assertStatus(200)
  })

  test('admin can download any file, including unlinked ones', async ({
    client,
    route,
    assert,
  }) => {
    const admin = await createUser('admin')
    const role = await Role.firstOrCreate({ slug: 'admin' }, { name: 'Administrator' })
    await admin.related('roles').attach([role.id])
    const orphan = await createStoredFile(shard)

    const response = await client.get(route('files.download', { id: orphan.id })).loginAs(admin)

    response.assertStatus(200)
    assert.include(response.header('content-disposition'), `file-${orphan.id}.txt`)
  })

  test('a file shared by two courses downloads under each course own filename', async ({
    client,
    route,
    assert,
  }) => {
    const first = await createCourseWithFile(shard, { filename: 'A internal draft.txt' })
    const second = await createCourseWithFile(shard, {
      file: first.file,
      filename: 'B exam answers.txt',
    })

    const firstResponse = await client
      .get(route('files.download', { id: first.file.id }))
      .loginAs(first.student)
    const secondResponse = await client
      .get(route('files.download', { id: first.file.id }))
      .loginAs(second.student)

    firstResponse.assertStatus(200)
    assert.include(firstResponse.header('content-disposition'), 'A internal draft.txt')
    secondResponse.assertStatus(200)
    assert.include(secondResponse.header('content-disposition'), 'B exam answers.txt')
    assert.notInclude(secondResponse.header('content-disposition'), 'A internal draft')
  })

  test('non-enrolled user is forbidden', async ({ client, route }) => {
    const { file } = await createCourseWithFile(shard)
    const outsider = await createUser('outsider')

    const response = await client.get(route('files.download', { id: file.id })).loginAs(outsider)

    response.assertStatus(403)
  })

  test('enrolled student cannot download unpublished content', async ({ client, route }) => {
    const { student, file } = await createCourseWithFile(shard, { contentPublished: false })

    const response = await client.get(route('files.download', { id: file.id })).loginAs(student)

    response.assertStatus(403)
  })

  test('content in a child module of an unpublished parent is forbidden', async ({
    client,
    route,
  }) => {
    const { student, course, module, file } = await createCourseWithFile(shard)
    const parent = await CourseModule.create({
      courseId: course.id,
      title: 'Hidden section',
      isPublished: false,
    })
    module.parentId = parent.id
    await module.save()

    const response = await client.get(route('files.download', { id: file.id })).loginAs(student)

    response.assertStatus(403)
  })

  test('content in a child module of a published parent is downloadable', async ({
    client,
    route,
  }) => {
    const { student, course, module, file } = await createCourseWithFile(shard)
    const parent = await CourseModule.create({
      courseId: course.id,
      title: 'Visible section',
      isPublished: true,
    })
    module.parentId = parent.id
    await module.save()

    const response = await client.get(route('files.download', { id: file.id })).loginAs(student)

    response.assertStatus(200)
  })

  test('enrolled student cannot download from a draft course', async ({ client, route }) => {
    const { student, file } = await createCourseWithFile(shard, { courseStatus: 'draft' })

    const response = await client.get(route('files.download', { id: file.id })).loginAs(student)

    response.assertStatus(403)
  })

  test('course owner can still download from a draft course', async ({ client, route }) => {
    const { instructor, file } = await createCourseWithFile(shard, { courseStatus: 'draft' })

    const response = await client.get(route('files.download', { id: file.id })).loginAs(instructor)

    response.assertStatus(200)
  })

  test('archived course serves completed enrollments only', async ({ client, route }) => {
    const completed = await createCourseWithFile(shard, {
      courseStatus: 'archived',
      enrollmentStatus: 'completed',
    })
    const active = await createCourseWithFile(shard, {
      courseStatus: 'archived',
      enrollmentStatus: 'active',
    })

    const completedResponse = await client
      .get(route('files.download', { id: completed.file.id }))
      .loginAs(completed.student)
    const activeResponse = await client
      .get(route('files.download', { id: active.file.id }))
      .loginAs(active.student)

    completedResponse.assertStatus(200)
    activeResponse.assertStatus(403)
  })

  test('suspended enrollment is forbidden', async ({ client, route }) => {
    const { student, file } = await createCourseWithFile(shard, { enrollmentStatus: 'suspended' })

    const response = await client.get(route('files.download', { id: file.id })).loginAs(student)

    response.assertStatus(403)
  })

  test('unlinked file is forbidden for non-admins', async ({ client, route }) => {
    const user = await createUser('user')
    const orphan = await createStoredFile(shard)

    const response = await client.get(route('files.download', { id: orphan.id })).loginAs(user)

    response.assertStatus(403)
  })

  test('missing file id returns 404', async ({ client, route }) => {
    const user = await createUser('user')

    const missing = await client.get(route('files.download', { id: 999999 })).loginAs(user)
    const invalid = await client.get('/files/abc/download').loginAs(user)

    missing.assertStatus(404)
    invalid.assertStatus(404)
  })

  test('tampered storage path with traversal is rejected', async ({ client, route }) => {
    const { instructor, file } = await createCourseWithFile(shard)
    file.storagePath = '../../.env'
    await file.save()

    const response = await client.get(route('files.download', { id: file.id })).loginAs(instructor)

    response.assertStatus(400)
  })
})
