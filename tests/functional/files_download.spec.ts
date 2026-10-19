import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import User from '#models/user'
import Role from '#models/role'
import Course from '#models/course'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import CourseEnrollment from '#models/course_enrollment'
import CoursePermission from '#models/course_permission'
import ContentFile from '#models/content_file'

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
 * Real file on disk under storage/content_files/<shard>/ so the download
 * path is exercised end-to-end. Shard dir is removed in teardown.
 */
async function createStoredFile(shard: string) {
  const name = `${uniqueSuffix()}.txt`
  await mkdir(app.makePath('storage/content_files', shard), { recursive: true })
  await writeFile(app.makePath('storage/content_files', shard, name), FILE_BODY)

  return ContentFile.create({
    filename: 'Week 1 notes.txt',
    storagePath: `${shard}/${name}`,
    mimeType: 'text/plain',
    size: Buffer.byteLength(FILE_BODY),
    checksum: createHash('sha256').update(uniqueSuffix()).digest('hex'),
  })
}

/**
 * Instructor-owned published course with one module, one content linked to
 * a stored file, and an actively enrolled student.
 */
async function createCourseWithFile(
  shard: string,
  overrides: { contentPublished?: boolean; enrollmentStatus?: 'active' | 'suspended' } = {}
) {
  const instructor = await createUser('instructor')
  const student = await createUser('student')

  const course = await Course.create({
    code: uniqueCourseCode(),
    title: 'Files 101',
    instructorId: instructor.id,
    status: 'published',
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

  const file = await createStoredFile(shard)
  await content.related('files').attach([file.id])

  await CourseEnrollment.create({
    userId: student.id,
    courseId: course.id,
    status: overrides.enrollmentStatus ?? 'active',
    enrolledAt: DateTime.now(),
  })

  return { instructor, student, course, content, file }
}

test.group('Files - download authorization', (group) => {
  let shard: string

  group.each.setup(async () => {
    shard = `test-${uniqueSuffix()}`
    const cleanupDb = await testUtils.db().withGlobalTransaction()
    return async () => {
      await cleanupDb()
      await rm(app.makePath('storage/content_files', shard), { recursive: true, force: true })
    }
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

  test('admin can download any file, including unlinked ones', async ({ client, route }) => {
    const admin = await createUser('admin')
    const role = await Role.firstOrCreate({ slug: 'admin' }, { name: 'Administrator' })
    await admin.related('roles').attach([role.id])
    const orphan = await createStoredFile(shard)

    const response = await client.get(route('files.download', { id: orphan.id })).loginAs(admin)

    response.assertStatus(200)
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
