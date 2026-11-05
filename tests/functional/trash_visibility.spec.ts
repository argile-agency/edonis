import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { createHash, randomUUID } from 'node:crypto'
import Course from '#models/course'
import ContentFile from '#models/content_file'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import { createCourse, createUser, uniqueSuffix } from '#tests/functional/helpers/factories'

/**
 * Trash visibility (phase 05.2): trashed sections and contents are invisible to every
 * model query, while raw db.from() reads still see them.
 * Fixture: S1 {c1, S11 {c2}}, S2 {c3, c4}; one file linked to c3 and c4.
 * Trashed: S1, S11, c1, c2 (one batch) and c3 (another batch).
 */

async function createModule(
  course: Course,
  overrides: Partial<Pick<CourseModule, 'parentId' | 'order' | 'title'>> = {}
): Promise<CourseModule> {
  return CourseModule.create({
    courseId: course.id,
    title: 'Test Module',
    order: 1,
    isPublished: true,
    ...overrides,
  })
}

async function createContent(
  module: CourseModule,
  overrides: Partial<Pick<CourseContent, 'order' | 'title'>> = {}
): Promise<CourseContent> {
  return CourseContent.create({
    moduleId: module.id,
    contentType: 'page',
    title: 'Test Content',
    content: 'Body',
    order: 1,
    isPublished: true,
    ...overrides,
  })
}

async function trash(table: string, ids: number[], batch: string, userId: number) {
  await db
    .from(table)
    .whereIn('id', ids)
    .update({
      deleted_at: DateTime.now().toFormat(db.connection().dialect.dateTimeFormat),
      deleted_batch: batch,
      deleted_by_id: userId,
    })
}

async function fixture() {
  const owner = await createUser({ roles: ['teacher'] })
  const course = await createCourse(owner)
  const s1 = await createModule(course, { order: 1, title: 'S1' })
  const s2 = await createModule(course, { order: 2, title: 'S2' })
  const s11 = await createModule(course, { parentId: s1.id, order: 1, title: 'S11' })
  const c1 = await createContent(s1, { order: 1, title: 'c1' })
  const c2 = await createContent(s11, { order: 1, title: 'c2' })
  const c3 = await createContent(s2, { order: 1, title: 'c3' })
  const c4 = await createContent(s2, { order: 2, title: 'c4' })
  const file = await ContentFile.create({
    storagePath: `ab/${uniqueSuffix()}.txt`,
    size: 4,
    checksum: createHash('sha256').update(uniqueSuffix()).digest('hex'),
  })
  for (const c of [c3, c4]) {
    await c.related('files').attach({ [file.id]: { filename: 'Notes.txt', mime_type: 'text/plain' } })
  }

  const batch = randomUUID()
  await trash('course_modules', [s1.id, s11.id], batch, owner.id)
  await trash('course_contents', [c1.id, c2.id], batch, owner.id)
  await trash('course_contents', [c3.id], randomUUID(), owner.id)

  return { owner, course, s1, s2, s11, c1, c2, c3, c4, file }
}

const ids = (rows: { id: number }[]) => rows.map((r) => r.id).sort((a, b) => a - b)

test.group('trash visibility | model hooks', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('query, find and findOrFail hide trashed sections', async ({ assert }) => {
    const f = await fixture()

    const modules = await CourseModule.query().where('course_id', f.course.id)
    assert.deepEqual(ids(modules), [f.s2.id])
    assert.isNull(await CourseModule.find(f.s1.id))
    await assert.rejects(() => CourseModule.findOrFail(f.s1.id))
  })

  test('query hides trashed contents', async ({ assert }) => {
    const f = await fixture()

    const contents = await CourseContent.query().whereIn('id', [f.c1.id, f.c2.id, f.c3.id, f.c4.id])
    assert.deepEqual(ids(contents), [f.c4.id])
  })

  test('preloads and related queries hide trashed rows', async ({ assert }) => {
    const f = await fixture()

    const course = await Course.query()
      .where('id', f.course.id)
      .preload('modules', (q) => q.preload('contents').preload('children'))
      .firstOrFail()
    assert.deepEqual(ids(course.modules), [f.s2.id])
    assert.deepEqual(ids(course.modules[0].contents), [f.c4.id])
    assert.deepEqual(course.modules[0].children, [])

    assert.deepEqual(ids(await f.s2.related('contents').query()), [f.c4.id])
  })

  test('paginate counts only live rows', async ({ assert }) => {
    const f = await fixture()

    const page = await CourseModule.query().where('course_id', f.course.id).paginate(1, 10)
    assert.equal(page.total, 1)
    assert.deepEqual(ids(page.all()), [f.s2.id])
  })

  test('many-to-many from ContentFile hides trashed contents', async ({ assert }) => {
    const f = await fixture()

    assert.deepEqual(ids(await f.file.related('contents').query()), [f.c4.id])
  })

  test('raw db.from() still sees trashed rows', async ({ assert }) => {
    const f = await fixture()

    const modules = await db.from('course_modules').where('course_id', f.course.id)
    assert.lengthOf(modules, 3)
    const contents = await db
      .from('course_contents')
      .whereIn('id', [f.c1.id, f.c2.id, f.c3.id, f.c4.id])
    assert.lengthOf(contents, 4)
  })

  test('a new section reads back live', async ({ assert }) => {
    const f = await fixture()

    const created = await createModule(f.course, { order: 3, title: 'S3' })
    const fresh = await CourseModule.findOrFail(created.id)
    assert.isNull(fresh.deletedAt)
  })
})
