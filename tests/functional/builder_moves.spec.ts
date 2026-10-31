import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import type Course from '#models/course'
import type User from '#models/user'
import AuditLog from '#models/audit_log'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import { createCourse, createUser, grantPermission } from '#tests/functional/helpers/factories'

/**
 * Intent-based move endpoints of the course builder (phase 05, plan 01).
 * `position` is the 0-based index among the destination siblings, with the
 * moved item excluded; `updatedAt` is the conflict token (compared to the second).
 */

const PARENT_ERROR = 'Module parent invalide.'
const DEPTH_ERROR = 'Profondeur maximale : 2 niveaux.'
const CONFLICT_ERROR = 'Cet élément a été modifié par un autre enseignant.'

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

async function postMove(client: ApiClient, url: string, user: User, body: Record<string, unknown>) {
  const req = client.post(url).withCsrfToken()
  return req.header('accept', 'application/json').json(body).loginAs(user)
}

/** `[id, order]` pairs of a section's contents, in display order. */
async function contentOrders(moduleId: number): Promise<[number, number][]> {
  const rows = await CourseContent.query()
    .where('module_id', moduleId)
    .orderBy('order', 'asc')
    .orderBy('id', 'asc')
  return rows.map((r) => [r.id, r.order])
}

async function auditRows(action: string, id: number) {
  return AuditLog.query().where('action', action).where('resource_id', String(id))
}

test.group('Builder - content moves', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('same section: moving to position 0 renumbers densely (BUILD-01)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const c1 = await createContent(s, { order: 1 })
    const c2 = await createContent(s, { order: 5 })
    const c3 = await createContent(s, { order: 9 })

    const url = route('contents.move', { contentId: c3.id })
    const response = await postMove(client, url, owner, {
      moduleId: s.id,
      position: 0,
      updatedAt: token(c3),
    })

    response.assertStatus(200)
    assert.equal(response.body().item.id, c3.id)
    assert.isString(response.body().item.updatedAt)
    assert.deepEqual(await contentOrders(s.id), [
      [c3.id, 1],
      [c1.id, 2],
      [c2.id, 3],
    ])
  })

  test('same section: an out-of-range position is clamped to the end', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const c1 = await createContent(s, { order: 1 })
    const c2 = await createContent(s, { order: 2 })
    const c3 = await createContent(s, { order: 3 })

    const url = route('contents.move', { contentId: c1.id })
    const response = await postMove(client, url, owner, {
      moduleId: s.id,
      position: 99,
      updatedAt: token(c1),
    })

    response.assertStatus(200)
    assert.deepEqual(await contentOrders(s.id), [
      [c2.id, 1],
      [c3.id, 2],
      [c1.id, 3],
    ])
  })

  test('cross-section: both sections are renumbered and one audit row is written (BUILD-02)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s1 = await createModule(course, { order: 1 })
    const s2 = await createModule(course, { order: 2 })
    const a1 = await createContent(s1, { order: 1 })
    const a2 = await createContent(s1, { order: 2 })
    const a3 = await createContent(s1, { order: 3 })
    const b1 = await createContent(s2, { order: 1 })

    const url = route('contents.move', { contentId: a2.id })
    const response = await postMove(client, url, owner, {
      moduleId: s2.id,
      position: 0,
      updatedAt: token(a2),
    })

    response.assertStatus(200)
    assert.deepEqual(await contentOrders(s2.id), [
      [a2.id, 1],
      [b1.id, 2],
    ])
    assert.deepEqual(await contentOrders(s1.id), [
      [a1.id, 1],
      [a3.id, 2],
    ])
    const moved = await CourseContent.findOrFail(a2.id)
    assert.equal(moved.moduleId, s2.id)

    const audits = await auditRows('course.content.move', a2.id)
    assert.lengthOf(audits, 1)
    assert.deepEqual(audits[0].metadata, {
      courseId: course.id,
      fromModuleId: s1.id,
      toModuleId: s2.id,
      position: 0,
    })
  })

  test('empty destination section accepts a content (D-03)', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s1 = await createModule(course, { order: 1 })
    const empty = await createModule(course, { order: 2 })
    const a1 = await createContent(s1, { order: 1 })

    const url = route('contents.move', { contentId: a1.id })
    const response = await postMove(client, url, owner, {
      moduleId: empty.id,
      position: 0,
      updatedAt: token(a1),
    })

    response.assertStatus(200)
    assert.deepEqual(await contentOrders(empty.id), [[a1.id, 1]])
    assert.deepEqual(await contentOrders(s1.id), [])
  })

  test('foreign destination section is refused with 422 and nothing is written', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const other = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const foreignCourse = await createCourse(other)
    const s1 = await createModule(course)
    const foreign = await createModule(foreignCourse)
    const a1 = await createContent(s1, { order: 4 })

    const url = route('contents.move', { contentId: a1.id })
    const response = await postMove(client, url, owner, {
      moduleId: foreign.id,
      position: 0,
      updatedAt: token(a1),
    })

    response.assertStatus(422)
    assert.equal(response.body().code, 'E_INVALID_DESTINATION')
    assert.equal(response.body().message, PARENT_ERROR)
    const after = await CourseContent.findOrFail(a1.id)
    assert.equal(after.moduleId, s1.id)
    assert.equal(after.order, 4)
    assert.lengthOf(await auditRows('course.content.move', a1.id), 0)
  })

  test('a content cannot enter a legacy third-level section; a sub-section is fine', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const r = await createModule(course)
    const c = await createModule(course, { parentId: r.id })
    const g = await createModule(course, { parentId: c.id })
    const s1 = await createModule(course, { order: 2 })
    const a1 = await createContent(s1, { order: 1 })

    const url = route('contents.move', { contentId: a1.id })
    const refused = await postMove(client, url, owner, {
      moduleId: g.id,
      position: 0,
      updatedAt: token(a1),
    })

    refused.assertStatus(422)
    assert.equal(refused.body().code, 'E_DEPTH')
    assert.equal(refused.body().message, DEPTH_ERROR)
    const after = await CourseContent.findOrFail(a1.id)
    assert.equal(after.moduleId, s1.id)

    const accepted = await postMove(client, url, owner, {
      moduleId: c.id,
      position: 0,
      updatedAt: token(after),
    })
    accepted.assertStatus(200)
    assert.deepEqual(await contentOrders(c.id), [[a1.id, 1]])
  })

  test('stale token gives 409 with the fresh item; a retry with its token passes (D-09)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const a1 = await createContent(s, { order: 1 })
    const a2 = await createContent(s, { order: 2 })
    const staleToken = token(a1)

    // Another teacher saved a1 meanwhile
    await CourseContent.query()
      .where('id', a1.id)
      .update({ updated_at: DateTime.now().plus({ minutes: 1 }).toFormat('yyyy-MM-dd HH:mm:ss') })

    const url = route('contents.move', { contentId: a1.id })
    const conflict = await postMove(client, url, owner, {
      moduleId: s.id,
      position: 1,
      updatedAt: staleToken,
    })

    conflict.assertStatus(409)
    assert.equal(conflict.body().code, 'E_CONFLICT')
    assert.equal(conflict.body().message, CONFLICT_ERROR)
    assert.equal(conflict.body().item.id, a1.id)
    assert.deepEqual(await contentOrders(s.id), [
      [a1.id, 1],
      [a2.id, 2],
    ])
    assert.lengthOf(await auditRows('course.content.move', a1.id), 0)

    const retry = await postMove(client, url, owner, {
      moduleId: s.id,
      position: 1,
      updatedAt: conflict.body().item.updatedAt,
    })
    retry.assertStatus(200)
    assert.deepEqual(await contentOrders(s.id), [
      [a2.id, 1],
      [a1.id, 2],
    ])
  })

  test('a row without updated_at matches a null token', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const a1 = await createContent(s, { order: 1 })
    const a2 = await createContent(s, { order: 2 })
    await CourseContent.query().where('id', a1.id).update({ updated_at: null })

    const url = route('contents.move', { contentId: a1.id })
    const response = await postMove(client, url, owner, {
      moduleId: s.id,
      position: 1,
      updatedAt: null,
    })

    response.assertStatus(200)
    assert.deepEqual(await contentOrders(s.id), [
      [a2.id, 1],
      [a1.id, 2],
    ])
  })

  test('a negative position is a 422 JSON validation error', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const a1 = await createContent(s)

    const url = route('contents.move', { contentId: a1.id })
    const response = await postMove(client, url, owner, {
      moduleId: s.id,
      position: -1,
      updatedAt: token(a1),
    })

    response.assertStatus(422)
    assert.isArray(response.body().errors)
  })

  test('authorization: outsider 403, teacher with edit 200, admin 200', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const outsider = await createUser({ roles: ['teacher'] })
    const editor = await createUser({ roles: ['teacher'] })
    const admin = await createUser({ roles: ['admin'] })
    const course = await createCourse(owner)
    await grantPermission(course, editor, 'edit')
    const s = await createModule(course)
    const a1 = await createContent(s, { order: 1 })
    await createContent(s, { order: 2 })
    const url = route('contents.move', { contentId: a1.id })

    const denied = await postMove(client, url, outsider, {
      moduleId: s.id,
      position: 1,
      updatedAt: token(a1),
    })
    denied.assertStatus(403)
    const afterDenied = await CourseContent.findOrFail(a1.id)
    assert.equal(afterDenied.order, 1)

    const byEditor = await postMove(client, url, editor, {
      moduleId: s.id,
      position: 1,
      updatedAt: token(afterDenied),
    })
    byEditor.assertStatus(200)

    const byAdmin = await postMove(client, url, admin, {
      moduleId: s.id,
      position: 0,
      updatedAt: byEditor.body().item.updatedAt,
    })
    byAdmin.assertStatus(200)
  })
})
