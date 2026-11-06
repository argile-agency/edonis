import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { createHash } from 'node:crypto'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import type Course from '#models/course'
import type User from '#models/user'
import AuditLog from '#models/audit_log'
import ContentFile from '#models/content_file'
import ContentProgress from '#models/content_progress'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import TrashService from '#services/trash_service'
import TrashPurgeService from '#services/trash_purge_service'
import CoursePolicy from '#policies/course_policy'
import {
  assertNotCsrfRejected,
  createCourse,
  createUser,
  enrollUser,
  grantPermission,
  uniqueSuffix,
} from '#tests/functional/helpers/factories'

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

function token(row: { updatedAt: DateTime | null }): string | null {
  return row.updatedAt?.toISO() ?? null
}

async function deleteJson(client: ApiClient, url: string, user: User) {
  const req = client.delete(url).withCsrfToken()
  return req.header('accept', 'application/json').loginAs(user)
}

async function postJson(client: ApiClient, url: string, user: User, body: Record<string, unknown>) {
  const req = client.post(url).withCsrfToken()
  return req.header('accept', 'application/json').json(body).loginAs(user)
}

const audits = (action: string) => AuditLog.query().where('action', action)

const byId = (a: number, b: number) => a - b

test.group('trash | write path', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('JSON delete of a non-empty section trashes its subtree and audits once', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const url = route('modules.delete', { moduleId: f.s1.id })
    const response = await deleteJson(client, url, f.owner)

    response.assertStatus(200)
    const { batch } = response.body()
    assert.deepEqual(response.body(), { item: { id: f.s1.id }, batch })
    for (const row of [
      await rawSection(f.s1.id),
      await rawSection(f.s11.id),
      await rawContent(f.c1.id),
      await rawContent(f.c2.id),
      await rawContent(f.c3.id),
    ]) {
      assert.equal(row.deleted_batch, batch)
    }
    assert.isNull(await CourseModule.find(f.s1.id))
    assert.isNotNull(await db.from('content_progresses').where('content_id', f.c3.id).first())

    const rows = await audits('course.module.delete').where('resource_id', String(f.s1.id))
    assert.lengthOf(rows, 1)
    assert.deepEqual(rows[0].metadata, {
      courseId: f.course.id,
      batch,
      sectionIds: [f.s1.id, f.s11.id].sort(byId),
      contentIds: [f.c1.id, f.c2.id, f.c3.id].sort(byId),
    })
  })

  test('HTML delete of a section redirects with the trash flash', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const req = client.delete(route('modules.delete', { moduleId: f.s2.id })).withCsrfToken()
    const response = await req.loginAs(f.owner).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('success'), '« S2 » déplacé dans la corbeille.')
    const row = await rawContent(f.c4.id)
    assert.isNotNull(row.deleted_at)
  })

  test('JSON delete of a content answers its batch and audits once', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const response = await deleteJson(
      client,
      route('contents.delete', { contentId: f.c4.id }),
      f.owner
    )

    response.assertStatus(200)
    const { batch } = response.body()
    assert.deepEqual(response.body(), { item: { id: f.c4.id }, batch })
    const row = await rawContent(f.c4.id)
    assert.equal(row.deleted_batch, batch)
    const rows = await audits('course.content.delete').where('resource_id', String(f.c4.id))
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].metadata?.batch, batch)
  })

  test('bulk delete trashes every descendant under one batch', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const url = route('courses.bulk.delete', { id: f.course.id })
    const items = [
      { kind: 'section', id: f.s1.id, updatedAt: token(f.s1) },
      { kind: 'content', id: f.c4.id, updatedAt: token(f.c4) },
    ]
    const response = await postJson(client, url, f.owner, { items })

    response.assertStatus(200)
    const { batch, deleted } = response.body()
    assert.lengthOf(batch, 36)
    assert.deepEqual(deleted.sectionIds, [f.s1.id, f.s11.id].sort(byId))
    assert.includeMembers(deleted.contentIds, [f.c1.id, f.c2.id, f.c3.id, f.c4.id])
    const row = await rawContent(f.c3.id)
    assert.equal(row.deleted_batch, batch)

    const rows = await audits('course.bulk.delete').where('resource_id', String(f.course.id))
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].metadata?.batch, batch)
  })

  test('a trashed row can no longer be edited or bulk-selected', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    await trash(f.course.id, [f.s1.id], [], f.owner.id)

    const req = client.put(route('modules.update', { moduleId: f.s1.id })).withCsrfToken()
    const put = await req.header('accept', 'application/json').json({ title: 'X' }).loginAs(f.owner)
    put.assertStatus(404)

    const url = route('courses.bulk.delete', { id: f.course.id })
    const items = [{ kind: 'content', id: f.c1.id, updatedAt: token(f.c1) }]
    const bulk = await postJson(client, url, f.owner, { items })
    bulk.assertStatus(422)
    assert.equal(bulk.body().code, 'E_INVALID_ITEMS')
  })

  test('an outsider teacher gets 403 and nothing is trashed', async ({ client, route, assert }) => {
    const f = await fixture()
    const outsider = await createUser({ roles: ['teacher'] })
    const m = await deleteJson(client, route('modules.delete', { moduleId: f.s1.id }), outsider)
    m.assertStatus(403)
    const c = await deleteJson(client, route('contents.delete', { contentId: f.c4.id }), outsider)
    c.assertStatus(403)
    assert.lengthOf(await TrashService.trashedRows(db.connection(), f.course.id), 0)
  })

  test('the builder page gets the trash count and retention', async ({ client, route, assert }) => {
    const f = await fixture()
    await trash(f.course.id, [f.s1.id], [], f.owner.id)
    await trash(f.course.id, [], [f.c4.id], f.owner.id)

    const url = route('courses.builder', { id: f.course.id })
    const response = await client.get(url).withInertia().loginAs(f.owner)
    response.assertStatus(200)
    const props = response.inertiaProps as {
      trash: { count: number; retentionDays: number }
      sections: { id: number }[]
      contents: { id: number }[]
    }
    assert.deepEqual(props.trash, { count: 2, retentionDays: 30 })
    assert.notInclude(
      props.sections.map((s) => s.id),
      f.s1.id
    )
    assert.notInclude(
      props.contents.map((c) => c.id),
      f.c4.id
    )
  })

  test('course progress counts each live content once', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course, { order: 1 })
    const sub = await createModule(course, { parentId: s.id, order: 1 })
    const cA = await createContent(s, { title: 'cA' })
    const cB = await createContent(sub, { title: 'cB' })
    const student = await createUser({ roles: ['student'] })
    await enrollUser(course, student)
    await ContentProgress.create({ userId: student.id, contentId: cA.id, status: 'completed' })
    const url = route('courses.progress', { id: course.id })
    const progress = async () => {
      const response = await client.get(url).header('accept', 'application/json').loginAs(student)
      response.assertStatus(200)
      return response.body()
    }

    assert.deepEqual(await progress(), {
      totalContents: 2,
      completedCount: 1,
      progressPercentage: 50,
    })
    await trash(course.id, [], [cB.id], owner.id)
    assert.deepEqual(await progress(), {
      totalContents: 1,
      completedCount: 1,
      progressPercentage: 100,
    })
  })
})

/** Backdates every trashed row of `batch` (dialect format: SQLite compares text). */
async function age(batch: string, daysAgo: number) {
  const stamp = DateTime.now()
    .minus({ days: daysAgo })
    .toFormat(db.connection().dialect.dateTimeFormat)
  for (const table of ['course_modules', 'course_contents']) {
    await db.from(table).where('deleted_batch', batch).update({ deleted_at: stamp })
  }
}

type TrashPageProps = {
  course: { id: number; title: string }
  rows: { kind: string; id: number; title: string }[]
  retentionDays: number
  moveTargets: { parentId: number | null; label: string }[]
  permissions: { canPurge: boolean }
}

const openTrash = (client: ApiClient, url: string, user: User) =>
  client.get(url).withInertia().loginAs(user)

test.group('trash | page', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the owner gets the trash roots, retention, live move targets and canPurge', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const first = await trash(f.course.id, [], [f.c4.id], f.owner.id)
    await age(first.batch, 2)
    await trash(f.course.id, [f.s1.id], [], f.owner.id)

    const response = await openTrash(client, route('courses.trash', { id: f.course.id }), f.owner)
    response.assertStatus(200)
    response.assertInertiaComponent('courses/trash')
    const props = response.inertiaProps as TrashPageProps
    assert.deepEqual(props.course, { id: f.course.id, title: f.course.title })
    assert.deepEqual(
      props.rows.map((r) => `${r.kind}:${r.title}`),
      ['section:S1', 'content:c4']
    )
    assert.equal(props.retentionDays, 30)
    assert.deepEqual(
      props.moveTargets.map((t) => t.parentId),
      [f.s2.id]
    )
    assert.deepEqual(props.permissions, { canPurge: true })
  })

  test('collaborators and admins open it; only admins may purge', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const url = route('courses.trash', { id: f.course.id })
    const editor = await createUser({ roles: ['teacher'] })
    const manager = await createUser({ roles: ['teacher'] })
    const admin = await createUser({ roles: ['admin'] })
    await grantPermission(f.course, editor, 'edit')
    await grantPermission(f.course, manager, 'manage')

    for (const [user, canPurge] of [
      [editor, false],
      [manager, false],
      [admin, true],
    ] as const) {
      const response = await openTrash(client, url, user)
      response.assertStatus(200)
      assert.equal((response.inertiaProps as TrashPageProps).permissions.canPurge, canPurge)
    }
  })

  test('outsiders get 403 and anonymous users go to login', async ({ client, route }) => {
    const f = await fixture()
    const url = route('courses.trash', { id: f.course.id })
    const outsider = await createUser({ roles: ['teacher'] })
    for (const user of [outsider, f.student]) {
      const response = await openTrash(client, url, user)
      response.assertStatus(403)
    }
    const anonymous = await client.get(url).redirects(0)
    anonymous.assertStatus(302)
    anonymous.assertHeader('location', '/login')
  })

  test('opening the page purges expired rows of the course and audits the user', async ({
    client,
    route,
    assert,
  }) => {
    const f = await fixture()
    const old = await trash(f.course.id, [], [f.c4.id], f.owner.id)
    await age(old.batch, 31)

    const response = await openTrash(client, route('courses.trash', { id: f.course.id }), f.owner)
    response.assertStatus(200)
    assert.lengthOf((response.inertiaProps as TrashPageProps).rows, 0)
    assert.isNull(await db.from('course_contents').where('id', f.c4.id).first())
    const rows = await audits('course.trash.purge').where('resource_id', String(f.course.id))
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].metadata?.trigger, 'page')
    assert.equal(rows[0].userId, f.owner.id)
  })

  test('a failing lazy purge does not break the page', async ({ client, route }) => {
    const f = await fixture()
    const original = TrashPurgeService.purgeExpired
    TrashPurgeService.purgeExpired = async () => {
      throw new Error('boom')
    }
    try {
      const url = route('courses.trash', { id: f.course.id })
      const response = await openTrash(client, url, f.owner)
      response.assertStatus(200)
    } finally {
      TrashPurgeService.purgeExpired = original
    }
  })

  test('emptyTrash: owner only, admins through before', async ({ assert }) => {
    const f = await fixture()
    const editor = await createUser({ roles: ['teacher'] })
    const admin = await createUser({ roles: ['admin'] })
    const policy = new CoursePolicy()
    assert.isTrue(policy.emptyTrash(f.owner, f.course))
    assert.isFalse(policy.emptyTrash(editor, f.course))
    assert.isTrue(await policy.before(admin, 'emptyTrash'))
  })
})
