import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import type Course from '#models/course'
import type User from '#models/user'
import { createHash } from 'node:crypto'
import AuditLog from '#models/audit_log'
import Assignment from '#models/assignment'
import ContentFile from '#models/content_file'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import { createCourse, createUser, uniqueSuffix } from '#tests/functional/helpers/factories'

/**
 * Builder bulk actions (phase 05, plan 09): one course, a batch of sections and
 * contents with their conflict tokens, all-or-nothing, one ids-only audit row.
 * Fixture: S1 {c1, c2, S11}, S2 {c3}.
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

function token(row: { updatedAt: DateTime | null }): string | null {
  return row.updatedAt?.toISO() ?? null
}

const sec = (m: CourseModule) => ({ kind: 'section', id: m.id, updatedAt: token(m) })
const con = (c: CourseContent) => ({ kind: 'content', id: c.id, updatedAt: token(c) })

async function fixture() {
  const owner = await createUser({ roles: ['teacher'] })
  const course = await createCourse(owner)
  const s1 = await createModule(course, { order: 1, title: 'S1' })
  const s2 = await createModule(course, { order: 2, title: 'S2' })
  const s11 = await createModule(course, { parentId: s1.id, order: 1, title: 'S11' })
  const c1 = await createContent(s1, { order: 1, title: 'c1' })
  const c2 = await createContent(s1, { order: 2, title: 'c2' })
  const c3 = await createContent(s2, { order: 1, title: 'c3' })
  return { owner, course, s1, s2, s11, c1, c2, c3 }
}

type Fixture = Awaited<ReturnType<typeof fixture>>

async function postBulk(client: ApiClient, url: string, user: User, body: Record<string, unknown>) {
  const req = client.post(url).withCsrfToken()
  return req.header('accept', 'application/json').json(body).loginAs(user)
}

async function bulkAudits(courseId: number) {
  return AuditLog.query()
    .whereLike('action', 'course.bulk.%')
    .where('resource_id', String(courseId))
}

const fresh = (c: CourseContent) => CourseContent.findOrFail(c.id)
const freshModule = (m: CourseModule) => CourseModule.findOrFail(m.id)

/** Every bulk route with a body that is valid for the fixture apart from `items`. */
const ROUTES: { name: string; body: (f: Fixture) => Record<string, unknown> }[] = [
  { name: 'courses.bulk.publish', body: () => ({ isPublished: false }) },
  {
    name: 'courses.bulk.availability',
    body: () => ({ availableFrom: '2026-11-02', availableUntil: '2026-11-30' }),
  },
  { name: 'courses.bulk.shift', body: () => ({ days: 7 }) },
  { name: 'courses.bulk.move', body: (f) => ({ parentId: f.s2.id }) },
  { name: 'courses.bulk.duplicate', body: () => ({}) },
  { name: 'courses.bulk.delete', body: () => ({}) },
]

test.group('Builder - bulk policy and scope', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('an outsider teacher gets 403 on every bulk route and nothing is written', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const outsider = await createUser({ roles: ['teacher'] })
    for (const r of ROUTES) {
      const url = route(r.name, { id: f.course.id })
      const response = await postBulk(client, url, outsider, { items: [con(f.c1)], ...r.body(f) })
      assert.equal(response.status(), 403, r.name)
    }
    const c1 = await fresh(f.c1)
    assert.isTrue(Boolean(c1.isPublished))
    assert.isNull(c1.availableFrom)
    assert.lengthOf(await bulkAudits(f.course.id), 0)
  })

  test('an admin passes the policy', async ({ client, route }) => {
    const f = await fixture()
    const admin = await createUser({ roles: ['admin'] })
    const url = route('courses.bulk.publish', { id: f.course.id })
    const response = await postBulk(client, url, admin, { items: [con(f.c1)], isPublished: false })
    response.assertStatus(200)
  })

  test('a foreign id in the batch is refused with 422 E_INVALID_ITEMS on every route', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const other = await fixture()
    for (const r of ROUTES) {
      const url = route(r.name, { id: f.course.id })
      const response = await postBulk(client, url, f.owner, {
        items: [con(f.c1), con(other.c1)],
        ...r.body(f),
      })
      assert.equal(response.status(), 422, r.name)
      assert.equal(response.body().code, 'E_INVALID_ITEMS', r.name)
      assert.deepInclude(response.body().ids, { kind: 'content', id: other.c1.id }, r.name)
    }
    const c1 = await fresh(f.c1)
    assert.isTrue(Boolean(c1.isPublished))
    assert.isNull(c1.availableFrom)
    assert.equal(c1.order, 1)
    assert.lengthOf(await bulkAudits(f.course.id), 0)
  })

  test('an empty batch is a validation error', async ({ client, route, assert }) => {
    const f = await fixture()
    for (const r of ROUTES) {
      const url = route(r.name, { id: f.course.id })
      const response = await postBulk(client, url, f.owner, { items: [], ...r.body(f) })
      assert.equal(response.status(), 422, r.name)
      assert.isArray(response.body().errors, r.name)
    }
  })
})

test.group('Builder - bulk publish, availability, shift', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('unpublish applies to the selected rows only and audits ids (BUILD-12)', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    // Backdate c1 so its new token is visibly newer (SQLite stores seconds)
    await CourseContent.query()
      .where('id', f.c1.id)
      .update({ updated_at: DateTime.now().minus({ hours: 1 }).toFormat('yyyy-MM-dd HH:mm:ss') })
    const c1 = await fresh(f.c1)

    const url = route('courses.bulk.publish', { id: f.course.id })
    const response = await postBulk(client, url, f.owner, {
      items: [sec(f.s1), con(c1), con(f.c3)],
      isPublished: false,
    })

    response.assertStatus(200)
    const body = response.body()
    assert.isFalse(Boolean(await freshModule(f.s1).then((r) => r.isPublished)))
    assert.isFalse(Boolean(await fresh(f.c1).then((r) => r.isPublished)))
    assert.isFalse(Boolean(await fresh(f.c3).then((r) => r.isPublished)))
    assert.isTrue(Boolean(await fresh(f.c2).then((r) => r.isPublished)))
    assert.deepEqual(body.affected, { sectionIds: [f.s1.id], contentIds: [f.c1.id, f.c3.id] })
    assert.deepEqual(body.deleted, { sectionIds: [], contentIds: [] })

    const c1Row = body.contents.find((c: { id: number }) => c.id === f.c1.id)
    assert.isFalse(c1Row.isPublished)
    assert.isAbove(DateTime.fromISO(c1Row.updatedAt).toMillis(), c1.updatedAt!.toMillis())
    for (const row of [...body.sections, ...body.contents]) {
      assert.notProperty(row, 'copiedFromId')
      assert.notProperty(row, 'content')
    }

    const audits = await bulkAudits(f.course.id)
    assert.lengthOf(audits, 1)
    assert.equal(audits[0].action, 'course.bulk.unpublish')
    assert.deepEqual(audits[0].metadata, { sectionIds: [f.s1.id], contentIds: [f.c1.id, f.c3.id] })

    // Publishing back with the fresh tokens of the response
    const tokens = new Map<string, string>(
      [...body.sections.map((s: any) => [`s${s.id}`, s.updatedAt])].concat(
        body.contents.map((c: any) => [`c${c.id}`, c.updatedAt])
      )
    )
    const back = await postBulk(client, url, f.owner, {
      items: [
        { kind: 'section', id: f.s1.id, updatedAt: tokens.get(`s${f.s1.id}`) },
        { kind: 'content', id: f.c1.id, updatedAt: tokens.get(`c${f.c1.id}`) },
      ],
      isPublished: true,
    })
    back.assertStatus(200)
    assert.isTrue(Boolean(await fresh(f.c1).then((r) => r.isPublished)))
    const publishRows = await AuditLog.query()
      .where('action', 'course.bulk.publish')
      .where('resource_id', String(f.course.id))
    assert.lengthOf(publishRows, 1)
  })

  test('a stale token refuses the whole batch with 409 (D-09)', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    await CourseContent.query()
      .where('id', f.c3.id)
      .update({ updated_at: DateTime.now().plus({ minutes: 1 }).toFormat('yyyy-MM-dd HH:mm:ss') })

    const url = route('courses.bulk.publish', { id: f.course.id })
    const response = await postBulk(client, url, f.owner, {
      items: [con(f.c1), con(f.c3)],
      isPublished: false,
    })

    response.assertStatus(409)
    assert.equal(response.body().code, 'E_CONFLICT')
    assert.equal(response.body().items[0].id, f.c3.id)
    assert.equal(response.body().items[0].kind, 'content')
    assert.isString(response.body().items[0].updatedAt)
    assert.isTrue(Boolean(await fresh(f.c1).then((r) => r.isPublished)))
    assert.lengthOf(await bulkAudits(f.course.id), 0)
  })

  test('availability sets and clears the window, and refuses an inverted one (BUILD-13)', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const url = route('courses.bulk.availability', { id: f.course.id })

    const set = await postBulk(client, url, f.owner, {
      items: [sec(f.s2), con(f.c1)],
      availableFrom: '2026-11-02',
      availableUntil: '2026-11-30',
    })
    set.assertStatus(200)
    const s2 = await freshModule(f.s2)
    const c1 = await fresh(f.c1)
    for (const row of [s2, c1]) {
      assert.equal(row.availableFrom?.toISODate(), '2026-11-02')
      assert.equal(row.availableUntil?.toISODate(), '2026-11-30')
    }
    assert.deepEqual(set.body().affected, { sectionIds: [f.s2.id], contentIds: [f.c1.id] })
    const audits = await bulkAudits(f.course.id)
    assert.lengthOf(audits, 1)
    assert.equal(audits[0].action, 'course.bulk.availability')

    const cleared = await postBulk(client, url, f.owner, {
      items: [sec(s2), con(c1)],
      availableFrom: null,
      availableUntil: null,
    })
    cleared.assertStatus(200)
    assert.isNull(await freshModule(f.s2).then((r) => r.availableFrom))
    assert.isNull(await fresh(f.c1).then((r) => r.availableUntil))

    const c1Again = await fresh(f.c1)
    const inverted = await postBulk(client, url, f.owner, {
      items: [con(c1Again)],
      availableFrom: '2026-12-01',
      availableUntil: '2026-11-01',
    })
    inverted.assertStatus(422)
    assert.equal(inverted.body().errors[0].field, 'availableUntil')
    assert.isNull(await fresh(f.c1).then((r) => r.availableFrom))
    assert.lengthOf(await bulkAudits(f.course.id), 2)
  })

  test('shift by days moves every non-null date and keeps nulls (BUILD-13)', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    await f.c1
      .merge({
        availableFrom: DateTime.fromISO('2026-09-01'),
        availableUntil: DateTime.fromISO('2026-09-10'),
        dueDate: DateTime.fromISO('2026-09-05'),
      })
      .save()
    await f.s1.merge({ availableFrom: DateTime.fromISO('2026-09-01'), availableUntil: null }).save()
    const assignment = await Assignment.create({
      courseId: f.course.id,
      moduleId: f.s1.id,
      title: 'Essay',
      dueDate: DateTime.fromISO('2026-09-05'),
    })

    const url = route('courses.bulk.shift', { id: f.course.id })
    const response = await postBulk(client, url, f.owner, {
      items: [sec(f.s1), con(f.c1), con(f.c2)],
      days: 7,
    })

    response.assertStatus(200)
    const c1 = await fresh(f.c1)
    const s1 = await freshModule(f.s1)
    assert.equal(c1.availableFrom?.toISODate(), '2026-09-08')
    assert.equal(c1.availableUntil?.toISODate(), '2026-09-17')
    assert.equal(c1.dueDate?.toISODate(), '2026-09-12')
    assert.equal(s1.availableFrom?.toISODate(), '2026-09-08')
    assert.isNull(s1.availableUntil)
    // c2 has no date at all: untouched, not affected
    assert.deepEqual(response.body().affected, { sectionIds: [f.s1.id], contentIds: [f.c1.id] })

    // OQ-1 (05-09): assignments rows are not builder rows
    const a = await Assignment.findOrFail(assignment.id)
    assert.equal(a.dueDate?.toISODate(), '2026-09-05')

    const audits = await bulkAudits(f.course.id)
    assert.lengthOf(audits, 1)
    assert.equal(audits[0].action, 'course.bulk.shift_dates')
    assert.deepEqual(audits[0].metadata, {
      sectionIds: [f.s1.id],
      contentIds: [f.c1.id, f.c2.id],
      days: 7,
    })

    const back = await postBulk(client, url, f.owner, {
      items: [con(c1)],
      from: '2026-09-08',
      to: '2026-09-01',
    })
    back.assertStatus(200)
    const c1Back = await fresh(f.c1)
    assert.equal(c1Back.availableFrom?.toISODate(), '2026-09-01')
    assert.equal(c1Back.availableUntil?.toISODate(), '2026-09-10')
    assert.equal(c1Back.dueDate?.toISODate(), '2026-09-05')
  })

  test('an invalid shift is refused with E_INVALID_SHIFT and nothing is written', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    await f.c1.merge({ availableFrom: DateTime.fromISO('2026-09-01') }).save()
    const url = route('courses.bulk.shift', { id: f.course.id })

    const zero = await postBulk(client, url, f.owner, { items: [con(f.c1)], days: 0 })
    zero.assertStatus(422)
    assert.equal(zero.body().code, 'E_INVALID_SHIFT')

    const both = await postBulk(client, url, f.owner, {
      items: [con(f.c1)],
      days: 3,
      from: '2026-09-01',
      to: '2026-09-08',
    })
    both.assertStatus(422)
    assert.equal(both.body().code, 'E_INVALID_SHIFT')

    const neither = await postBulk(client, url, f.owner, { items: [con(f.c1)] })
    neither.assertStatus(422)
    assert.equal(neither.body().code, 'E_INVALID_SHIFT')

    const c1 = await fresh(f.c1)
    assert.equal(c1.availableFrom?.toISODate(), '2026-09-01')
    assert.lengthOf(await bulkAudits(f.course.id), 0)
  })
})

/** `[id, order]` pairs of a section's contents, in display order. */
async function contentOrders(moduleId: number): Promise<[number, number][]> {
  const rows = await CourseContent.query()
    .where('module_id', moduleId)
    .orderBy('order', 'asc')
    .orderBy('id', 'asc')
  return rows.map((r) => [r.id, r.order])
}

async function attachFile(content: CourseContent): Promise<ContentFile> {
  const file = await ContentFile.create({
    storagePath: `ab/${uniqueSuffix()}.txt`,
    size: 4,
    checksum: createHash('sha256').update(uniqueSuffix()).digest('hex'),
  })
  await content.related('files').attach({
    [file.id]: { filename: 'Notes.txt', mime_type: 'text/plain' },
  })
  return file
}

async function contentFileCount(): Promise<number> {
  const rows = await ContentFile.query().count('* as total')
  return Number(rows[0].$extras.total)
}

test.group('Builder - bulk move, duplicate, delete', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('move contents runs in tree order and appends to the destination (BUILD-14)', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const url = route('courses.bulk.move', { id: f.course.id })
    const response = await postBulk(client, url, f.owner, {
      items: [con(f.c3), con(f.c1)],
      parentId: f.s2.id,
    })

    response.assertStatus(200)
    assert.deepEqual(await contentOrders(f.s2.id), [
      [f.c1.id, 1],
      [f.c3.id, 2],
    ])
    assert.deepEqual(await contentOrders(f.s1.id), [[f.c2.id, 1]])
    // Moved rows plus the renumbered lists of S1 and S2
    assert.deepEqual(response.body().affected, {
      sectionIds: [],
      contentIds: [f.c1.id, f.c2.id, f.c3.id].sort((a, b) => a - b),
    })

    const audits = await bulkAudits(f.course.id)
    assert.lengthOf(audits, 1)
    assert.equal(audits[0].action, 'course.bulk.move')
    assert.deepEqual(audits[0].metadata, {
      sectionIds: [],
      contentIds: [f.c1.id, f.c3.id].sort((a, b) => a - b),
      parentId: f.s2.id,
    })
  })

  test('a section moves with its own selected content left inside it', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const c11 = await createContent(f.s11, { title: 'c11' })
    const url = route('courses.bulk.move', { id: f.course.id })
    const response = await postBulk(client, url, f.owner, {
      items: [sec(f.s11), con(c11)],
      parentId: f.s2.id,
    })

    response.assertStatus(200)
    const s11 = await freshModule(f.s11)
    const c11Fresh = await fresh(c11)
    assert.equal(s11.parentId, f.s2.id)
    assert.equal(c11Fresh.moduleId, f.s11.id)
  })

  test('a refused depth rolls the whole batch back', async ({ client, route, assert }) => {
    const f = await fixture()
    const url = route('courses.bulk.move', { id: f.course.id })
    const response = await postBulk(client, url, f.owner, {
      items: [sec(f.s1), con(f.c2)],
      parentId: f.s2.id,
    })

    response.assertStatus(422)
    assert.equal(response.body().code, 'E_DEPTH')
    assert.deepEqual(response.body().ids, [{ kind: 'section', id: f.s1.id }])
    const s1 = await freshModule(f.s1)
    const c2 = await fresh(f.c2)
    assert.isNull(s1.parentId)
    assert.equal(c2.moduleId, f.s1.id)
    assert.equal(c2.order, 2)
    assert.lengthOf(await bulkAudits(f.course.id), 0)
  })

  test('a cycle or a content to the root is an invalid destination', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const url = route('courses.bulk.move', { id: f.course.id })

    const cycle = await postBulk(client, url, f.owner, {
      items: [sec(f.s1)],
      parentId: f.s11.id,
    })
    cycle.assertStatus(422)
    assert.equal(cycle.body().code, 'E_INVALID_DESTINATION')

    const toRoot = await postBulk(client, url, f.owner, { items: [con(f.c1)], parentId: null })
    toRoot.assertStatus(422)
    assert.equal(toRoot.body().code, 'E_INVALID_DESTINATION')
    assert.deepEqual(toRoot.body().ids, [{ kind: 'content', id: f.c1.id }])

    const s1 = await freshModule(f.s1)
    assert.isNull(s1.parentId)
    assert.lengthOf(await bulkAudits(f.course.id), 0)
  })

  test('duplicating a content copies its attachments and records copied_from_id (D-12)', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const file = await attachFile(f.c1)
    const filesBefore = await contentFileCount()

    const url = route('courses.bulk.duplicate', { id: f.course.id })
    const response = await postBulk(client, url, f.owner, { items: [con(f.c1)] })

    response.assertStatus(200)
    const copy = await CourseContent.query().where('copied_from_id', f.c1.id).firstOrFail()
    assert.equal(copy.title, 'c1 (copie)')
    assert.equal(copy.moduleId, f.s1.id)
    assert.equal(copy.contentType, 'page')
    // OQ-2 (05-09): copies start as drafts
    assert.isFalse(Boolean(copy.isPublished))
    assert.deepEqual(await contentOrders(f.s1.id), [
      [f.c1.id, 1],
      [copy.id, 2],
      [f.c2.id, 3],
    ])

    const pivots = await CourseContent.query().where('id', copy.id).preload('files').firstOrFail()
    assert.lengthOf(pivots.files, 1)
    assert.equal(pivots.files[0].id, file.id)
    assert.equal(pivots.files[0].$extras.pivot_filename, 'Notes.txt')
    assert.equal(pivots.files[0].$extras.pivot_mime_type, 'text/plain')
    assert.equal(await contentFileCount(), filesBefore)

    assert.include(response.body().affected.contentIds, copy.id)
    const audits = await bulkAudits(f.course.id)
    assert.lengthOf(audits, 1)
    assert.equal(audits[0].action, 'course.bulk.duplicate')
    assert.deepEqual(audits[0].metadata, {
      sectionIds: [],
      contentIds: [f.c1.id],
      createdSectionIds: [],
      createdContentIds: [copy.id],
    })

    // ON DELETE SET NULL on the test engine
    const original = await fresh(f.c1)
    await original.delete()
    const orphan = await fresh(copy)
    assert.isNull(orphan.copiedFromId)
  })

  test('duplicating a section copies its contents and sub-sections', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const c11 = await createContent(f.s11, { title: 'c11' })
    const url = route('courses.bulk.duplicate', { id: f.course.id })
    const response = await postBulk(client, url, f.owner, { items: [sec(f.s1)] })

    response.assertStatus(200)
    const s1Copy = await CourseModule.query().where('copied_from_id', f.s1.id).firstOrFail()
    assert.equal(s1Copy.title, 'S1 (copie)')
    assert.isNull(s1Copy.parentId)
    const roots = await CourseModule.query()
      .where('course_id', f.course.id)
      .whereNull('parent_id')
      .orderBy('order', 'asc')
      .orderBy('id', 'asc')
    assert.deepEqual(
      roots.map((r) => [r.id, r.order]),
      [
        [f.s1.id, 1],
        [s1Copy.id, 2],
        [f.s2.id, 3],
      ]
    )

    const s11Copy = await CourseModule.query().where('copied_from_id', f.s11.id).firstOrFail()
    assert.equal(s11Copy.parentId, s1Copy.id)
    assert.equal(s11Copy.title, 'S11')
    const copies = await CourseContent.query()
      .whereNotNull('copied_from_id')
      .whereIn('module_id', [s1Copy.id, s11Copy.id])
      .orderBy('id', 'asc')
    assert.deepEqual(
      copies.map((c) => [c.copiedFromId, c.title, c.moduleId]),
      [
        [f.c1.id, 'c1', s1Copy.id],
        [f.c2.id, 'c2', s1Copy.id],
        [c11.id, 'c11', s11Copy.id],
      ]
    )
    // No grandchild: nothing deeper than 2 levels
    assert.lengthOf(await CourseModule.query().where('parent_id', s11Copy.id), 0)
    assert.isFalse(Boolean(s1Copy.isPublished))

    const audits = await bulkAudits(f.course.id)
    assert.lengthOf(audits, 1)
    const metadata = audits[0].metadata!
    assert.deepEqual(
      metadata.createdSectionIds,
      [s1Copy.id, s11Copy.id].sort((a, b) => a - b)
    )
    assert.lengthOf(metadata.createdContentIds, 3)
  })

  test('duplicating legacy third-level data is refused', async ({ client, route, assert }) => {
    const f = await fixture()
    const g = await createModule(f.course, { parentId: f.s11.id, title: 'G' })
    const url = route('courses.bulk.duplicate', { id: f.course.id })
    const response = await postBulk(client, url, f.owner, { items: [sec(g)] })

    response.assertStatus(422)
    assert.equal(response.body().code, 'E_DEPTH')
    assert.lengthOf(await CourseModule.query().whereNotNull('copied_from_id'), 0)
    assert.lengthOf(await bulkAudits(f.course.id), 0)
  })

  test('delete removes contents and fully selected sections', async ({ client, route, assert }) => {
    const f = await fixture()
    const url = route('courses.bulk.delete', { id: f.course.id })

    const one = await postBulk(client, url, f.owner, { items: [con(f.c2)] })
    one.assertStatus(200)
    assert.isNull(await CourseContent.find(f.c2.id))
    assert.deepEqual(one.body().deleted, { sectionIds: [], contentIds: [f.c2.id] })

    const both = await postBulk(client, url, f.owner, { items: [sec(f.s2), con(f.c3)] })
    both.assertStatus(200)
    assert.isNull(await CourseModule.find(f.s2.id))
    assert.isNull(await CourseContent.find(f.c3.id))
    assert.deepEqual(both.body().deleted, { sectionIds: [f.s2.id], contentIds: [f.c3.id] })

    const audits = await AuditLog.query()
      .where('action', 'course.bulk.delete')
      .where('resource_id', String(f.course.id))
      .orderBy('id', 'asc')
    assert.lengthOf(audits, 2)
    assert.deepEqual(audits[1].metadata, { sectionIds: [f.s2.id], contentIds: [f.c3.id] })
  })

  test('a section with unselected content inside refuses the whole batch with 409', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const url = route('courses.bulk.delete', { id: f.course.id })
    const response = await postBulk(client, url, f.owner, { items: [sec(f.s1), con(f.c1)] })

    response.assertStatus(409)
    assert.equal(response.body().code, 'E_NOT_EMPTY')
    assert.include(response.body().ids, f.s1.id)
    assert.isNotNull(await CourseModule.find(f.s1.id))
    assert.isNotNull(await CourseModule.find(f.s11.id))
    assert.isNotNull(await CourseContent.find(f.c1.id))
    assert.isNotNull(await CourseContent.find(f.c2.id))
    assert.lengthOf(await bulkAudits(f.course.id), 0)
  })

  test('a fully selected sub-tree is deleted and attachment files are kept', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const c11 = await createContent(f.s11, { title: 'c11' })
    const file = await attachFile(f.c1)
    const url = route('courses.bulk.delete', { id: f.course.id })
    const response = await postBulk(client, url, f.owner, {
      items: [sec(f.s1), con(f.c1), con(f.c2), sec(f.s11), con(c11)],
    })

    response.assertStatus(200)
    for (const id of [f.c1.id, f.c2.id, c11.id]) assert.isNull(await CourseContent.find(id))
    for (const id of [f.s1.id, f.s11.id]) assert.isNull(await CourseModule.find(id))
    assert.deepEqual(response.body().deleted, {
      sectionIds: [f.s1.id, f.s11.id].sort((a, b) => a - b),
      contentIds: [f.c1.id, f.c2.id, c11.id].sort((a, b) => a - b),
    })
    assert.isNotNull(await ContentFile.find(file.id))
    assert.isNotNull(await CourseModule.find(f.s2.id))
  })
})
