import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import type Course from '#models/course'
import ContentFile from '#models/content_file'
import ContentProgress from '#models/content_progress'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import TrashService from '#services/trash_service'
import { createCourse, createUser, uniqueSuffix } from '#tests/functional/helpers/factories'

/**
 * Builder trash (phase 05.2, plan 03): deletes move a subtree to the trash
 * under one batch. Fixture: S1 {c1, c2, S11 {c3}}, S2 {c4}.
 */

async function createModule(
  course: Course,
  overrides: Partial<Pick<CourseModule, 'parentId' | 'order' | 'isPublished' | 'title'>> = {}
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
  overrides: Partial<Pick<CourseContent, 'order' | 'isPublished' | 'title'>> = {}
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

async function fixture() {
  const owner = await createUser({ roles: ['teacher'] })
  const course = await createCourse(owner)
  const s1 = await createModule(course, { order: 1, title: 'S1' })
  const s2 = await createModule(course, { order: 2, title: 'S2' })
  const s11 = await createModule(course, { parentId: s1.id, order: 3, title: 'S11' })
  const c1 = await createContent(s1, { order: 1, title: 'c1' })
  const c2 = await createContent(s1, { order: 2, title: 'c2' })
  const c3 = await createContent(s11, { order: 1, title: 'c3' })
  const c4 = await createContent(s2, { order: 1, title: 'c4' })
  const student = await createUser({ roles: ['student'] })
  await ContentProgress.create({ userId: student.id, contentId: c3.id, status: 'completed' })
  const file = await ContentFile.create({
    storagePath: `ab/${uniqueSuffix()}.txt`,
    size: 4,
    checksum: createHash('sha256').update(uniqueSuffix()).digest('hex'),
  })
  await c3
    .related('files')
    .attach({ [file.id]: { filename: 'Notes.txt', mime_type: 'text/plain' } })
  return { owner, course, s1, s2, s11, c1, c2, c3, c4, student, file }
}

const rawSection = (id: number) => db.from('course_modules').where('id', id).firstOrFail()
const rawContent = (id: number) => db.from('course_contents').where('id', id).firstOrFail()

const trash = (courseId: number, sectionIds: number[], contentIds: number[], userId: number) =>
  db.transaction((trx) => TrashService.trash(trx, courseId, { sectionIds, contentIds }, userId))

test.group('trash | service', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('trashing a section takes its whole subtree under one batch', async ({ assert }) => {
    const f = await fixture()
    const result = await trash(f.course.id, [f.s1.id], [], f.owner.id)

    assert.deepEqual(result.deleted, {
      sectionIds: [f.s1.id, f.s11.id].sort((a, b) => a - b),
      contentIds: [f.c1.id, f.c2.id, f.c3.id].sort((a, b) => a - b),
    })
    assert.lengthOf(result.batch, 36)
    const rows = [
      await rawSection(f.s1.id),
      await rawSection(f.s11.id),
      await rawContent(f.c1.id),
      await rawContent(f.c2.id),
      await rawContent(f.c3.id),
    ]
    for (const row of rows) {
      assert.equal(row.deleted_batch, result.batch)
      assert.equal(Number(row.deleted_by_id), f.owner.id)
      assert.isNotNull(row.deleted_at)
    }
    assert.equal(Number(rows[1].order), 3)
    assert.equal(Number(rows[3].order), 2)

    const [s2, c4] = [await rawSection(f.s2.id), await rawContent(f.c4.id)]
    assert.isNull(s2.deleted_at)
    assert.isNull(c4.deleted_at)
    assert.isNotNull(await db.from('content_progresses').where('content_id', f.c3.id).first())
    assert.isNotNull(
      await db.from('content_content_files').where('course_content_id', f.c3.id).first()
    )
  })

  test('separate deletes are separate batches and separate roots', async ({ assert }) => {
    const f = await fixture()
    const first = await trash(f.course.id, [], [f.c4.id], f.owner.id)
    const second = await trash(f.course.id, [f.s2.id], [], f.owner.id)
    assert.notEqual(first.batch, second.batch)
    assert.deepEqual(second.deleted, { sectionIds: [f.s2.id], contentIds: [] })

    const roots = TrashService.rootsOf(await TrashService.trashedRows(db.connection(), f.course.id))
    assert.sameMembers(
      roots.map((r) => `${r.kind}:${r.id}`),
      [`content:${f.c4.id}`, `section:${f.s2.id}`]
    )

    await trash(f.course.id, [f.s1.id], [], f.owner.id)
    assert.equal(await TrashService.countRoots(f.course.id, db.connection()), 3)
  })

  test('trashing an already trashed id changes nothing', async ({ assert }) => {
    const f = await fixture()
    const first = await trash(f.course.id, [f.s1.id], [], f.owner.id)
    const again = await trash(f.course.id, [f.s1.id], [f.c1.id], f.owner.id)
    assert.deepEqual(again.deleted, { sectionIds: [], contentIds: [] })
    const [s1, c1] = [await rawSection(f.s1.id), await rawContent(f.c1.id)]
    assert.equal(s1.deleted_batch, first.batch)
    assert.equal(c1.deleted_batch, first.batch)
  })

  test('deleted_at round-trips through fromDbDateTime', async ({ assert }) => {
    const f = await fixture()
    const before = DateTime.now()
    await trash(f.course.id, [], [f.c4.id], f.owner.id)
    const row = await rawContent(f.c4.id)
    const deletedAt = TrashService.fromDbDateTime(row.deleted_at)
    assert.isTrue(deletedAt.isValid)
    assert.isBelow(Math.abs(deletedAt.diff(before).as('seconds')), 1.5)
  })
})
