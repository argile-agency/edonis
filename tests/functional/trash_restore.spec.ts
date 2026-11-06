import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import type Course from '#models/course'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import CourseStructureService from '#services/course_structure_service'
import TrashService, { type RestoreOptions, type RestoreTarget } from '#services/trash_service'
import { BulkRefusal } from '../../app/helpers/builder_ids.js'
import { createCourse, createUser } from '#tests/functional/helpers/factories'

/**
 * Builder trash restore and list (phase 05.2, plan 06).
 * Fixture: roots R1, S1, R2 (orders 1..3); S1 {c1, c2, c3, S11 {c4}}.
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

async function fixture() {
  const owner = await createUser({ roles: ['teacher'] })
  const course = await createCourse(owner)
  const r1 = await createModule(course, { order: 1, title: 'R1' })
  const s1 = await createModule(course, { order: 2, title: 'S1' })
  const r2 = await createModule(course, { order: 3, title: 'R2' })
  const s11 = await createModule(course, { parentId: s1.id, order: 1, title: 'S11' })
  const c1 = await createContent(s1, { order: 1, title: 'c1' })
  const c2 = await createContent(s1, { order: 2, title: 'c2' })
  const c3 = await createContent(s1, { order: 3, title: 'c3' })
  const c4 = await createContent(s11, { order: 1, title: 'c4' })
  return { owner, course, r1, s1, r2, s11, c1, c2, c3, c4 }
}

type Fixture = Awaited<ReturnType<typeof fixture>>

const trash = (f: Fixture, sectionIds: number[], contentIds: number[], userId = f.owner.id) =>
  db.transaction((trx) => TrashService.trash(trx, f.course.id, { sectionIds, contentIds }, userId))

const restore = (courseId: number, target: RestoreTarget, options?: RestoreOptions) =>
  db.transaction((trx) => TrashService.restore(trx, courseId, target, options))

const restoreBatch = (courseId: number, batch: string) =>
  db.transaction((trx) => TrashService.restoreBatch(trx, courseId, batch))

/** Runs inside its own transaction and returns the refusal (asserted outside it). */
async function refusal(run: () => Promise<unknown>): Promise<BulkRefusal> {
  const error = await run().then(
    () => null,
    (e: unknown) => e
  )
  if (!(error instanceof BulkRefusal)) throw new Error(`expected a BulkRefusal, got ${error}`)
  return error
}

const ids = <T extends { id: number }>(rows: T[]) => rows.map((r) => r.id)

const liveSections = async (courseId: number, parentId: number | null) => {
  const query = CourseModule.query().where('course_id', courseId)
  if (parentId === null) query.whereNull('parent_id')
  else query.where('parent_id', parentId)
  return ids(await query.orderBy('order', 'asc').orderBy('id', 'asc'))
}

const liveContents = async (moduleId: number) =>
  ids(
    await CourseContent.query()
      .where('module_id', moduleId)
      .orderBy('order', 'asc')
      .orderBy('id', 'asc')
  )

const isTrashed = async (table: 'course_modules' | 'course_contents', id: number) => {
  const row = await db.from(table).where('id', id).firstOrFail()
  return row.deleted_at !== null
}

const byId = (list: number[]) => [...list].sort((a, b) => a - b)

test.group('trash | restore', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a section comes back in place with its batch only; a content of an earlier batch after it', async ({
    assert,
  }) => {
    const f = await fixture()
    await trash(f, [], [f.c2.id])
    await trash(f, [f.s1.id], [])

    const result = await restore(f.course.id, { kind: 'section', id: f.s1.id })
    assert.deepEqual(await liveSections(f.course.id, null), [f.r1.id, f.s1.id, f.r2.id])
    assert.deepEqual(await liveSections(f.course.id, f.s1.id), [f.s11.id])
    assert.deepEqual(await liveContents(f.s1.id), [f.c1.id, f.c3.id])
    assert.deepEqual(await liveContents(f.s11.id), [f.c4.id])
    assert.isTrue(await isTrashed('course_contents', f.c2.id))
    assert.deepEqual(result.outcome.affected, {
      sectionIds: byId([f.s1.id, f.s11.id]),
      contentIds: byId([f.c1.id, f.c3.id, f.c4.id]),
    })
    assert.equal(result.title, 'S1')
    assert.isFalse(result.fallback)
    assert.equal(result.outcome.auditAction, 'course.trash.restore')

    const c2 = await restore(f.course.id, { kind: 'content', id: f.c2.id })
    assert.deepEqual(await liveContents(f.s1.id), [f.c1.id, f.c2.id, f.c3.id])
    assert.deepEqual(c2.contentIds, [f.c2.id])
    assert.include(c2.outcome.touchedSections ?? [], f.s1.id)
  })

  test('siblings trashed meanwhile shift the position', async ({ assert }) => {
    const f = await fixture()
    await trash(f, [f.r1.id], [])
    await trash(f, [f.s1.id], [])
    await restore(f.course.id, { kind: 'section', id: f.s1.id })
    assert.deepEqual(await liveSections(f.course.id, null), [f.s1.id, f.r2.id])
    assert.isTrue(await isTrashed('course_modules', f.r1.id))
  })

  test('a sub-section trashed before its parent returns under the restored parent', async ({
    assert,
  }) => {
    const f = await fixture()
    await trash(f, [f.s11.id], [])
    await trash(f, [f.s1.id], [])
    await restore(f.course.id, { kind: 'section', id: f.s1.id })
    assert.isTrue(await isTrashed('course_modules', f.s11.id))
    const result = await restore(f.course.id, { kind: 'section', id: f.s11.id })
    assert.isFalse(result.fallback)
    assert.deepEqual(await liveSections(f.course.id, f.s1.id), [f.s11.id])
    assert.deepEqual(await liveContents(f.s11.id), [f.c4.id])
  })

  test('a section whose parent is trashed falls back to the end of the roots', async ({
    assert,
  }) => {
    const f = await fixture()
    await trash(f, [f.s11.id], [])
    await trash(f, [f.s1.id], [])
    const result = await restore(f.course.id, { kind: 'section', id: f.s11.id })
    assert.isTrue(result.fallback)
    assert.deepEqual(await liveSections(f.course.id, null), [f.r1.id, f.r2.id, f.s11.id])
    assert.deepEqual(await liveContents(f.s11.id), [f.c4.id])
  })

  test('a section that would exceed 2 levels falls back to the end of the roots', async ({
    assert,
  }) => {
    const f = await fixture()
    await trash(f, [f.s11.id], [])
    await db.transaction(async (trx) => {
      const s1 = await CourseModule.query({ client: trx }).where('id', f.s1.id).firstOrFail()
      const moved = await CourseStructureService.moveModule(trx, f.course.id, s1, f.r1.id, 0)
      assert.isTrue(moved.ok)
    })
    const result = await restore(f.course.id, { kind: 'section', id: f.s11.id })
    assert.isTrue(result.fallback)
    assert.deepEqual(await liveSections(f.course.id, null), [f.r1.id, f.r2.id, f.s11.id])
    assert.deepEqual(await liveSections(f.course.id, f.s1.id), [])
  })

  test('a content whose section is trashed is refused unless the section comes back', async ({
    assert,
  }) => {
    const f = await fixture()
    await trash(f, [], [f.c4.id])
    await trash(f, [f.s11.id], [])

    const refused = await refusal(() => restore(f.course.id, { kind: 'content', id: f.c4.id }))
    assert.equal(refused.status, 409)
    assert.equal(refused.body.code, 'E_PARENT_TRASHED')
    assert.deepEqual(refused.body.section, { id: f.s11.id, title: 'S11' })
    assert.isTrue(await isTrashed('course_contents', f.c4.id))

    const result = await restore(
      f.course.id,
      { kind: 'content', id: f.c4.id },
      { withSection: true }
    )
    assert.deepEqual(result.restoredSection, { id: f.s11.id, title: 'S11' })
    assert.deepEqual(await liveSections(f.course.id, f.s1.id), [f.s11.id])
    assert.deepEqual(await liveContents(f.s11.id), [f.c4.id])
    assert.deepEqual(result.sectionIds, [f.s11.id])
    assert.deepEqual(result.contentIds, [f.c4.id])
    assert.isNull(result.destination)
  })

  test('a content whose section is trashed can go to another live section', async ({ assert }) => {
    const f = await fixture()
    const d1 = await createContent(f.r2, { order: 1, title: 'd1' })
    await trash(f, [], [f.c4.id])
    await trash(f, [f.s11.id], [])

    const other = await createCourse(f.owner)
    const foreign = await createModule(other, { title: 'Foreign' })
    const refused = await refusal(() =>
      restore(f.course.id, { kind: 'content', id: f.c4.id }, { moduleId: foreign.id })
    )
    assert.equal(refused.status, 422)
    assert.equal(refused.body.code, 'E_INVALID_DESTINATION')
    assert.isTrue(await isTrashed('course_contents', f.c4.id))

    const result = await restore(
      f.course.id,
      { kind: 'content', id: f.c4.id },
      { moduleId: f.r2.id }
    )
    assert.deepEqual(result.destination, { id: f.r2.id, title: 'R2' })
    assert.deepEqual(await liveContents(f.r2.id), [d1.id, f.c4.id])
    assert.isTrue(await isTrashed('course_modules', f.s11.id))
  })

  test('a live, foreign or already restored id is not in the trash', async ({ assert }) => {
    const f = await fixture()
    const live = await refusal(() => restore(f.course.id, { kind: 'content', id: f.c1.id }))
    assert.equal(live.status, 404)
    assert.equal(live.body.code, 'E_NOT_IN_TRASH')

    await trash(f, [f.r1.id], [])
    const other = await createCourse(f.owner)
    const foreign = await refusal(() => restore(other.id, { kind: 'section', id: f.r1.id }))
    assert.equal(foreign.status, 404)

    await restore(f.course.id, { kind: 'section', id: f.r1.id })
    const again = await refusal(() => restore(f.course.id, { kind: 'section', id: f.r1.id }))
    assert.equal(again.status, 404)
    assert.equal(again.body.code, 'E_NOT_IN_TRASH')
  })

  test('restoreBatch restores every root of a batch in place', async ({ assert }) => {
    const f = await fixture()
    const { batch } = await trash(f, [f.r1.id], [f.c1.id])
    const result = await restoreBatch(f.course.id, batch)
    assert.deepEqual(await liveSections(f.course.id, null), [f.r1.id, f.s1.id, f.r2.id])
    assert.deepEqual(await liveContents(f.s1.id), [f.c1.id, f.c2.id, f.c3.id])
    assert.deepEqual(result.sectionIds, [f.r1.id])
    assert.deepEqual(result.contentIds, [f.c1.id])
    assert.equal(result.batch, batch)
    assert.isFalse(result.fallback)
  })

  test('restoreBatch is all-or-nothing and scoped to the course', async ({ assert }) => {
    const f = await fixture()
    const { batch } = await trash(f, [f.r1.id], [f.c1.id])
    await trash(f, [f.s1.id], [])

    const refused = await refusal(() => restoreBatch(f.course.id, batch))
    assert.equal(refused.status, 409)
    assert.equal(refused.body.code, 'E_PARENT_TRASHED')
    assert.isTrue(await isTrashed('course_modules', f.r1.id))
    assert.isTrue(await isTrashed('course_contents', f.c1.id))

    const unknown = await refusal(() => restoreBatch(f.course.id, randomUUID()))
    assert.equal(unknown.status, 404)
    const other = await createCourse(f.owner)
    const foreign = await refusal(() => restoreBatch(other.id, batch))
    assert.equal(foreign.status, 404)
  })

  test('restored rows get a fresh conflict token', async ({ assert }) => {
    const f = await fixture()
    const old = TrashService.toDbDateTime(DateTime.fromISO('2020-01-01T00:00:00'), db.connection())
    await db.from('course_modules').whereIn('id', [f.s1.id, f.s11.id]).update({ updated_at: old })
    await db.from('course_contents').whereIn('id', [f.c1.id]).update({ updated_at: old })
    await trash(f, [f.s1.id], [])
    await restore(f.course.id, { kind: 'section', id: f.s1.id })

    const year = async (table: string, id: number) => {
      const row = await db.from(table).where('id', id).firstOrFail()
      return TrashService.fromDbDateTime(row.updated_at).year
    }
    assert.isAbove(await year('course_modules', f.s1.id), 2020)
    assert.isAbove(await year('course_modules', f.s11.id), 2020)
    assert.isAbove(await year('course_contents', f.c1.id), 2020)
  })
})

/** Moves a trashed row's `deleted_at` back in time (dialect format). */
const trashedAgo = (table: 'course_modules' | 'course_contents', id: number, days: number) =>
  db
    .from(table)
    .where('id', id)
    .update({
      deleted_at: TrashService.toDbDateTime(DateTime.now().minus({ days }), db.connection()),
    })

const list = (courseId: number, retentionDays = 30) =>
  TrashService.list(courseId, retentionDays, db.connection())

test.group('trash | list', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('lists batch roots, most recent first, with their section and descendants', async ({
    assert,
  }) => {
    const f = await fixture()
    await trash(f, [], [f.c2.id])
    await trashedAgo('course_contents', f.c2.id, 2)
    await trash(f, [f.s1.id], [])

    const rows = await list(f.course.id)
    assert.deepEqual(
      rows.map((r) => `${r.kind}:${r.id}`),
      [`section:${f.s1.id}`, `content:${f.c2.id}`]
    )
    const [s1, c2] = rows
    assert.equal(s1.title, 'S1')
    assert.isNull(s1.type)
    assert.isNull(s1.originalSection)
    assert.isNull(s1.sectionTrashed)
    assert.equal(s1.descendantCount, 5)
    assert.deepEqual(s1.contentIds, byId([f.c1.id, f.c2.id, f.c3.id, f.c4.id]))
    assert.equal(s1.deletedBy, 'Test User')
    assert.equal(c2.type, 'page')
    assert.deepEqual(c2.originalSection, { id: f.s1.id, title: 'S1' })
    assert.deepEqual(c2.sectionTrashed, { id: f.s1.id, title: 'S1' })
    assert.deepEqual(c2.contentIds, [f.c2.id])
    assert.equal(c2.descendantCount, 0)
    assert.notEqual(s1.batch, c2.batch)
  })

  test('days left follow the current retention', async ({ assert }) => {
    const f = await fixture()
    await trash(f, [f.r1.id], [])
    await trash(f, [f.r2.id], [])
    await trashedAgo('course_modules', f.r2.id, 28)
    await trash(f, [], [f.c1.id])
    await trashedAgo('course_contents', f.c1.id, 31)

    const rows = await list(f.course.id)
    const days = new Map(rows.map((r) => [`${r.kind}:${r.id}`, r.daysLeft]))
    assert.equal(days.get(`section:${f.r1.id}`), 30)
    assert.equal(days.get(`section:${f.r2.id}`), 2)
    assert.isAtMost(days.get(`content:${f.c1.id}`)!, 0)
    const [shorter] = await list(f.course.id, 7)
    assert.equal(shorter.daysLeft, 7)
  })

  test('deleted by: full name, nameless user, missing user', async ({ assert }) => {
    const f = await fixture()
    const editor = await createUser()
    await db.from('users').where('id', editor.id).update({ full_name: null })
    await trash(f, [f.r1.id], [], editor.id)

    const [named] = await list(f.course.id)
    assert.equal(named.deletedBy, 'Utilisateur sans nom')
    await db.from('users').where('id', editor.id).delete()
    const [missing] = await list(f.course.id)
    assert.isNull(missing.deletedBy)
  })

  test('deletedAt is ISO and matches the stored instant', async ({ assert }) => {
    const f = await fixture()
    await trash(f, [f.r1.id], [])
    const [row] = await list(f.course.id)
    const stored = await db.from('course_modules').where('id', f.r1.id).firstOrFail()
    const parsed = DateTime.fromISO(row.deletedAt)
    assert.isTrue(parsed.isValid)
    assert.equal(
      parsed.toUnixInteger(),
      TrashService.fromDbDateTime(stored.deleted_at).toUnixInteger()
    )
  })

  test('live rows and other courses never appear', async ({ assert }) => {
    const f = await fixture()
    const other = await fixture()
    await trash(other, [other.s1.id], [])
    assert.deepEqual(await list(f.course.id), [])
    await trash(f, [], [f.c3.id])
    const rows = await list(f.course.id)
    assert.deepEqual(
      rows.map((r) => r.id),
      [f.c3.id]
    )
  })
})
