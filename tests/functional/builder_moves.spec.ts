import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import type Course from '#models/course'
import type User from '#models/user'
import AuditLog from '#models/audit_log'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import ContentFile from '#models/content_file'
import db from '@adonisjs/lucid/services/db'
import {
  assertNotCsrfRejected,
  createCourse,
  createUser,
  grantPermission,
  uniqueSuffix,
} from '#tests/functional/helpers/factories'

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
  overrides: Partial<
    Pick<
      CourseModule,
      | 'parentId'
      | 'order'
      | 'isPublished'
      | 'title'
      | 'description'
      | 'availableFrom'
      | 'availableUntil'
    >
  > = {}
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
  overrides: Partial<
    Pick<
      CourseContent,
      'order' | 'isPublished' | 'title' | 'description' | 'availableFrom' | 'availableUntil'
    >
  > = {}
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

/** `[id, order]` pairs of the sections under `parentId` (null = roots), in display order. */
async function moduleOrders(
  courseId: number,
  parentId: number | null
): Promise<[number, number][]> {
  const query = CourseModule.query().where('course_id', courseId)
  if (parentId === null) {
    query.whereNull('parent_id')
  } else {
    query.where('parent_id', parentId)
  }
  const rows = await query.orderBy('order', 'asc').orderBy('id', 'asc')
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

test.group('Builder - section moves', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('reorder roots: moving to position 0 renumbers densely (BUILD-03)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const r1 = await createModule(course, { order: 1 })
    const r2 = await createModule(course, { order: 2 })
    const r3 = await createModule(course, { order: 3 })

    const url = route('modules.move', { moduleId: r3.id })
    const response = await postMove(client, url, owner, {
      parentId: null,
      position: 0,
      updatedAt: token(r3),
    })

    response.assertStatus(200)
    assert.equal(response.body().item.id, r3.id)
    assert.isString(response.body().item.updatedAt)
    assert.deepEqual(await moduleOrders(course.id, null), [
      [r3.id, 1],
      [r1.id, 2],
      [r2.id, 3],
    ])
  })

  test('re-parent: a leaf root goes under another root, both lists renumbered, one audit row (D-01)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const r1 = await createModule(course, { order: 1 })
    const leaf = await createModule(course, { order: 2 })
    const r2 = await createModule(course, { order: 3 })
    const c = await createModule(course, { parentId: r1.id, order: 4 })

    const url = route('modules.move', { moduleId: leaf.id })
    const response = await postMove(client, url, owner, {
      parentId: r1.id,
      position: 0,
      updatedAt: token(leaf),
    })

    response.assertStatus(200)
    const moved = await CourseModule.findOrFail(leaf.id)
    assert.equal(moved.parentId, r1.id)
    assert.deepEqual(await moduleOrders(course.id, r1.id), [
      [leaf.id, 1],
      [c.id, 2],
    ])
    assert.deepEqual(await moduleOrders(course.id, null), [
      [r1.id, 1],
      [r2.id, 2],
    ])

    const audits = await auditRows('course.module.move', leaf.id)
    assert.lengthOf(audits, 1)
    assert.deepEqual(audits[0].metadata, {
      courseId: course.id,
      fromParentId: null,
      toParentId: r1.id,
      position: 0,
    })
  })

  test('back to root: a sub-section lands at the clamped position among the roots', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const r1 = await createModule(course, { order: 1 })
    const r2 = await createModule(course, { order: 2 })
    const c = await createModule(course, { parentId: r1.id, order: 1 })

    const url = route('modules.move', { moduleId: c.id })
    const response = await postMove(client, url, owner, {
      parentId: null,
      position: 99,
      updatedAt: token(c),
    })

    response.assertStatus(200)
    assert.deepEqual(await moduleOrders(course.id, null), [
      [r1.id, 1],
      [r2.id, 2],
      [c.id, 3],
    ])
    assert.deepEqual(await moduleOrders(course.id, r1.id), [])
  })

  test('cycle: a section cannot go under itself or its child', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const r1 = await createModule(course, { order: 1 })
    const c1 = await createModule(course, { parentId: r1.id })
    const url = route('modules.move', { moduleId: r1.id })

    for (const parentId of [c1.id, r1.id]) {
      const response = await postMove(client, url, owner, {
        parentId,
        position: 0,
        updatedAt: token(r1),
      })
      response.assertStatus(422)
      assert.equal(response.body().code, 'E_INVALID_DESTINATION')
      assert.equal(response.body().message, PARENT_ERROR)
      const after = await CourseModule.findOrFail(r1.id)
      assert.isNull(after.parentId)
      assert.equal(after.order, 1)
    }
    assert.lengthOf(await auditRows('course.module.move', r1.id), 0)
  })

  test('depth: a section with sub-sections cannot become a sub-section; a leaf can', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const r1 = await createModule(course, { order: 1 })
    const r2 = await createModule(course, { order: 2 })
    const leaf = await createModule(course, { order: 3 })
    await createModule(course, { parentId: r1.id })

    const refused = await postMove(client, route('modules.move', { moduleId: r1.id }), owner, {
      parentId: r2.id,
      position: 0,
      updatedAt: token(r1),
    })
    refused.assertStatus(422)
    assert.equal(refused.body().code, 'E_DEPTH')
    assert.equal(refused.body().message, DEPTH_ERROR)
    const after = await CourseModule.findOrFail(r1.id)
    assert.isNull(after.parentId)
    assert.equal(after.order, 1)

    const accepted = await postMove(client, route('modules.move', { moduleId: leaf.id }), owner, {
      parentId: r2.id,
      position: 0,
      updatedAt: token(leaf),
    })
    accepted.assertStatus(200)
    const movedLeaf = await CourseModule.findOrFail(leaf.id)
    assert.equal(movedLeaf.parentId, r2.id)
  })

  test('legacy third level: can be brought back within the limit, not kept too deep', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const r = await createModule(course, { order: 1 })
    const c = await createModule(course, { parentId: r.id })
    const g = await createModule(course, { parentId: c.id })
    const r2 = await createModule(course, { order: 2 })
    const c2 = await createModule(course, { parentId: r2.id })
    const url = route('modules.move', { moduleId: g.id })

    const refused = await postMove(client, url, owner, {
      parentId: c2.id,
      position: 0,
      updatedAt: token(g),
    })
    refused.assertStatus(422)
    assert.equal(refused.body().message, DEPTH_ERROR)
    const stillDeep = await CourseModule.findOrFail(g.id)
    assert.equal(stillDeep.parentId, c.id)

    const accepted = await postMove(client, url, owner, {
      parentId: r2.id,
      position: 0,
      updatedAt: token(g),
    })
    accepted.assertStatus(200)
    assert.deepEqual(await moduleOrders(course.id, r2.id), [
      [g.id, 1],
      [c2.id, 2],
    ])
  })

  test('foreign parent is refused with 422 and nothing is written', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const other = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const foreignCourse = await createCourse(other)
    const r1 = await createModule(course, { order: 3 })
    const foreign = await createModule(foreignCourse)

    const response = await postMove(client, route('modules.move', { moduleId: r1.id }), owner, {
      parentId: foreign.id,
      position: 0,
      updatedAt: token(r1),
    })

    response.assertStatus(422)
    assert.equal(response.body().message, PARENT_ERROR)
    const after = await CourseModule.findOrFail(r1.id)
    assert.isNull(after.parentId)
    assert.equal(after.order, 3)
  })

  test('stale token gives 409 with the fresh item and writes nothing', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const r1 = await createModule(course, { order: 1 })
    const r2 = await createModule(course, { order: 2 })
    const staleToken = token(r1)
    await CourseModule.query()
      .where('id', r1.id)
      .update({ updated_at: DateTime.now().plus({ minutes: 1 }).toFormat('yyyy-MM-dd HH:mm:ss') })

    const response = await postMove(client, route('modules.move', { moduleId: r1.id }), owner, {
      parentId: null,
      position: 1,
      updatedAt: staleToken,
    })

    response.assertStatus(409)
    assert.equal(response.body().code, 'E_CONFLICT')
    assert.equal(response.body().message, CONFLICT_ERROR)
    assert.equal(response.body().item.id, r1.id)
    assert.deepEqual(await moduleOrders(course.id, null), [
      [r1.id, 1],
      [r2.id, 2],
    ])
  })

  test('authorization: outsider 403, admin 200', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const outsider = await createUser({ roles: ['teacher'] })
    const admin = await createUser({ roles: ['admin'] })
    const course = await createCourse(owner)
    const r1 = await createModule(course, { order: 1 })
    await createModule(course, { order: 2 })
    const url = route('modules.move', { moduleId: r1.id })

    const denied = await postMove(client, url, outsider, {
      parentId: null,
      position: 1,
      updatedAt: token(r1),
    })
    denied.assertStatus(403)
    const afterDenied = await CourseModule.findOrFail(r1.id)
    assert.equal(afterDenied.order, 1)

    const byAdmin = await postMove(client, url, admin, {
      parentId: null,
      position: 1,
      updatedAt: token(r1),
    })
    byAdmin.assertStatus(200)
  })

  test('PUT modules.update no longer re-parents a section (single move path)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const r1 = await createModule(course, { order: 1 })
    const r2 = await createModule(course, { order: 2 })

    const req = client.put(route('modules.update', { moduleId: r1.id })).withCsrfToken()
    const response = await req
      .json({ title: 'Renommé', parentId: r2.id })
      .loginAs(owner)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    const after = await CourseModule.findOrFail(r1.id)
    assert.equal(after.title, 'Renommé')
    assert.isNull(after.parentId)
  })
})

const DATE_ORDER_ERROR = 'La date de fin doit être postérieure à la date de début.'

async function putJson(client: ApiClient, url: string, user: User, body: Record<string, unknown>) {
  const req = client.put(url).withCsrfToken()
  return req.header('accept', 'application/json').json(body).loginAs(user)
}

async function moduleTitle(id: number) {
  const row = await CourseModule.findOrFail(id)
  return row.title
}

async function contentTitle(id: number) {
  const row = await CourseContent.findOrFail(id)
  return row.title
}

const NOT_EMPTY_ERROR = "Déplacez ou supprimez d'abord son contenu."

async function deleteJson(client: ApiClient, url: string, user: User) {
  const req = client.delete(url).withCsrfToken()
  return req.header('accept', 'application/json').loginAs(user)
}

async function postForm(client: ApiClient, url: string, user: User, body: Record<string, unknown>) {
  const req = client.post(url).withCsrfToken()
  return req.json(body).loginAs(user).redirects(0)
}

function day(iso: string): DateTime {
  return DateTime.fromISO(iso)
}

test.group('Builder - edits and deletes', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('rename a section through JSON returns the new token (BUILD-05)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)

    const url = route('modules.update', { moduleId: s.id })
    const response = await putJson(client, url, owner, {
      title: 'Nouveau titre',
      updatedAt: token(s),
    })

    response.assertStatus(200)
    assert.equal(response.body().item.id, s.id)
    assert.isString(response.body().item.updatedAt)
    const after = await CourseModule.findOrFail(s.id)
    assert.equal(after.title, 'Nouveau titre')
  })

  test('edit a content item through JSON (BUILD-08)', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const c = await createContent(s)

    const url = route('contents.update', { contentId: c.id })
    const response = await putJson(client, url, owner, {
      description: 'Texte',
      isPublished: false,
      availableFrom: '2026-11-01',
      availableUntil: '2026-11-30',
      updatedAt: token(c),
    })

    response.assertStatus(200)
    assert.equal(response.body().item.id, c.id)
    const after = await CourseContent.findOrFail(c.id)
    assert.equal(after.description, 'Texte')
    assert.isFalse(Boolean(after.isPublished)) // SQLite reads booleans back as 0/1
    assert.equal(after.availableFrom?.toISODate(), '2026-11-01')
    assert.equal(after.availableUntil?.toISODate(), '2026-11-30')
  })

  test('description and dates can be cleared on a content item and a section (WR-20)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const filled = {
      description: 'Texte',
      availableFrom: day('2026-11-01'),
      availableUntil: day('2026-11-30'),
    }
    const s = await createModule(course, filled)
    const c = await createContent(s, filled)
    const cleared = { description: null, availableFrom: null, availableUntil: null }

    const contentUrl = route('contents.update', { contentId: c.id })
    const contentRes = await putJson(client, contentUrl, owner, {
      ...cleared,
      updatedAt: token(c),
    })
    contentRes.assertStatus(200)
    const contentAfter = await CourseContent.findOrFail(c.id)
    assert.isNull(contentAfter.description)
    assert.isNull(contentAfter.availableFrom)
    assert.isNull(contentAfter.availableUntil)

    const moduleUrl = route('modules.update', { moduleId: s.id })
    const moduleRes = await putJson(client, moduleUrl, owner, { ...cleared, updatedAt: token(s) })
    moduleRes.assertStatus(200)
    const moduleAfter = await CourseModule.findOrFail(s.id)
    assert.isNull(moduleAfter.description)
    assert.isNull(moduleAfter.availableFrom)
    assert.isNull(moduleAfter.availableUntil)
  })

  test('fields not sent are left untouched', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const c = await createContent(s, {
      availableFrom: day('2026-11-01'),
      availableUntil: day('2026-11-30'),
    })

    const url = route('contents.update', { contentId: c.id })
    const response = await putJson(client, url, owner, { title: 'Seul le titre' })

    response.assertStatus(200)
    const after = await CourseContent.findOrFail(c.id)
    assert.equal(after.title, 'Seul le titre')
    assert.equal(after.availableFrom?.toISODate(), '2026-11-01')
    assert.equal(after.availableUntil?.toISODate(), '2026-11-30')
  })

  test('a start date sent alone keeps the stored end date, and is checked against it (CR-01)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const c = await createContent(s, { availableUntil: day('2026-11-30') })
    const url = route('contents.update', { contentId: c.id })

    const late = await putJson(client, url, owner, { availableFrom: '2026-12-05' })
    late.assertStatus(422)
    assert.equal(late.body().errors[0].field, 'availableUntil')

    const ok = await putJson(client, url, owner, { availableFrom: '2026-11-03' })
    ok.assertStatus(200)
    const after = await CourseContent.findOrFail(c.id)
    assert.equal(after.availableFrom?.toISODate(), '2026-11-03')
    assert.equal(after.availableUntil?.toISODate(), '2026-11-30')
  })

  test('an end date before the start date is refused with 422, also on a partial update', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const c = await createContent(s, { title: 'Avant' })

    const url = route('contents.update', { contentId: c.id })
    const inverted = await putJson(client, url, owner, {
      title: 'Après',
      availableFrom: '2026-12-01',
      availableUntil: '2026-11-01',
    })
    inverted.assertStatus(422)
    assert.equal(inverted.body().errors[0].field, 'availableUntil')
    assert.equal(inverted.body().errors[0].message, DATE_ORDER_ERROR)
    const unchanged = await CourseContent.findOrFail(c.id)
    assert.equal(unchanged.title, 'Avant')
    assert.isNull(unchanged.availableFrom)

    const m = await createModule(course, { availableFrom: day('2026-12-01') })
    const moduleUrl = route('modules.update', { moduleId: m.id })
    const partial = await putJson(client, moduleUrl, owner, { availableUntil: '2026-11-01' })
    partial.assertStatus(422)
    assert.equal(partial.body().errors[0].field, 'availableUntil')
    const moduleAfter = await CourseModule.findOrFail(m.id)
    assert.isNull(moduleAfter.availableUntil)
  })

  test('stale token gives 409 with the fresh item; a retry with its token passes (D-09)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course, { title: 'Titre stocké' })
    const staleToken = token(s)

    // Another teacher saved the section meanwhile
    await CourseModule.query()
      .where('id', s.id)
      .update({ updated_at: DateTime.now().plus({ minutes: 1 }).toFormat('yyyy-MM-dd HH:mm:ss') })

    const url = route('modules.update', { moduleId: s.id })
    const conflict = await putJson(client, url, owner, {
      title: 'Mon titre',
      updatedAt: staleToken,
    })

    conflict.assertStatus(409)
    assert.equal(conflict.body().code, 'E_CONFLICT')
    assert.equal(conflict.body().message, CONFLICT_ERROR)
    assert.equal(conflict.body().item.title, 'Titre stocké')
    assert.equal(await moduleTitle(s.id), 'Titre stocké')

    const retry = await putJson(client, url, owner, {
      title: 'Mon titre',
      updatedAt: conflict.body().item.updatedAt,
    })
    retry.assertStatus(200)
    assert.equal(await moduleTitle(s.id), 'Mon titre')
  })

  test('a stale token on a content item also gives 409', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const c = await createContent(s, { title: 'Titre stocké' })
    const staleToken = token(c)
    await CourseContent.query()
      .where('id', c.id)
      .update({ updated_at: DateTime.now().plus({ minutes: 1 }).toFormat('yyyy-MM-dd HH:mm:ss') })

    const url = route('contents.update', { contentId: c.id })
    const conflict = await putJson(client, url, owner, {
      title: 'Mon titre',
      updatedAt: staleToken,
    })

    conflict.assertStatus(409)
    assert.equal(conflict.body().item.title, 'Titre stocké')
    assert.equal(await contentTitle(c.id), 'Titre stocké')
  })

  test('an HTML caller without a token keeps the flash and redirect', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const c = await createContent(s)

    const req = client.put(route('contents.update', { contentId: c.id })).withCsrfToken()
    const response = await req.json({ title: 'Renommé' }).loginAs(owner).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isDefined(response.flashMessage('success'))
    assert.equal(await contentTitle(c.id), 'Renommé')
  })

  test('authorization: an outsider gets 403 JSON on both update routes', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const outsider = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course, { title: 'Avant' })
    const c = await createContent(s, { title: 'Avant' })

    const moduleUrl = route('modules.update', { moduleId: s.id })
    const m = await putJson(client, moduleUrl, outsider, { title: 'Pirate', updatedAt: token(s) })
    m.assertStatus(403)
    const contentUrl = route('contents.update', { contentId: c.id })
    const ct = await putJson(client, contentUrl, outsider, { title: 'Pirate', updatedAt: token(c) })
    ct.assertStatus(403)

    assert.equal(await moduleTitle(s.id), 'Avant')
    assert.equal(await contentTitle(c.id), 'Avant')
  })
  test('an empty section is deleted through JSON with one ids-only audit row (BUILD-06)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)

    const response = await deleteJson(client, route('modules.delete', { moduleId: s.id }), owner)

    response.assertStatus(200)
    assert.deepEqual(response.body(), { item: { id: s.id } })
    assert.isNull(await CourseModule.find(s.id))
    const audits = await auditRows('course.module.delete', s.id)
    assert.lengthOf(audits, 1)
    assert.deepEqual(audits[0].metadata, { courseId: course.id, parentId: null })
  })

  test('a section with contents or sub-sections is refused with 409 and kept', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const withContent = await createModule(course, { order: 1 })
    const c = await createContent(withContent)
    const withChild = await createModule(course, { order: 2 })
    const child = await createModule(course, { parentId: withChild.id })

    for (const s of [withContent, withChild]) {
      const response = await deleteJson(client, route('modules.delete', { moduleId: s.id }), owner)
      response.assertStatus(409)
      assert.deepEqual(response.body(), { code: 'E_NOT_EMPTY', message: NOT_EMPTY_ERROR })
      assert.lengthOf(await auditRows('course.module.delete', s.id), 0)
    }

    assert.isNotNull(await CourseModule.find(withContent.id))
    assert.isNotNull(await CourseContent.find(c.id))
    assert.isNotNull(await CourseModule.find(withChild.id))
    assert.isNotNull(await CourseModule.find(child.id))
  })

  test('HTML callers: a non-empty section gets the flash error, an empty one is deleted', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const full = await createModule(course, { order: 1 })
    await createContent(full)
    const empty = await createModule(course, { order: 2 })

    const refusedReq = client.delete(route('modules.delete', { moduleId: full.id })).withCsrfToken()
    const refused = await refusedReq.loginAs(owner).redirects(0)
    refused.assertStatus(302)
    assertNotCsrfRejected(assert, refused)
    assert.equal(refused.flashMessage('error'), NOT_EMPTY_ERROR)
    assert.isNotNull(await CourseModule.find(full.id))
    assert.lengthOf(await auditRows('course.module.delete', full.id), 0)

    const okReq = client.delete(route('modules.delete', { moduleId: empty.id })).withCsrfToken()
    const ok = await okReq.loginAs(owner).redirects(0)
    ok.assertStatus(302)
    assert.isDefined(ok.flashMessage('success'))
    assert.isNull(await CourseModule.find(empty.id))
    assert.lengthOf(await auditRows('course.module.delete', empty.id), 1)
  })

  test('a content item is deleted through JSON; its file row is kept (BUILD-09)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const plain = await createContent(s, { order: 1 })
    const withFile = await createContent(s, { order: 2 })
    const file = await ContentFile.create({
      storagePath: `ab/${uniqueSuffix()}.txt`,
      size: 4,
      checksum: uniqueSuffix(),
    })
    await withFile.related('files').attach({
      [file.id]: { filename: 'notes.txt', mime_type: 'text/plain' },
    })

    const first = await deleteJson(client, route('contents.delete', { contentId: plain.id }), owner)
    first.assertStatus(200)
    assert.deepEqual(first.body(), { item: { id: plain.id } })
    assert.isNull(await CourseContent.find(plain.id))
    const audits = await auditRows('course.content.delete', plain.id)
    assert.lengthOf(audits, 1)
    assert.deepEqual(audits[0].metadata, { courseId: course.id, moduleId: s.id })

    const url = route('contents.delete', { contentId: withFile.id })
    const second = await deleteJson(client, url, owner)
    second.assertStatus(200)
    assert.isNull(await CourseContent.find(withFile.id))
    const pivot = await db.from('content_content_files').where('course_content_id', withFile.id)
    assert.lengthOf(pivot, 0)
    // The content_files row (and its blob) may be shared, so it stays
    assert.isNotNull(await ContentFile.find(file.id))
  })

  test('HTML content delete keeps the redirect and writes one audit row', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course)
    const c = await createContent(s)

    const req = client.delete(route('contents.delete', { contentId: c.id })).withCsrfToken()
    const response = await req.loginAs(owner).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isDefined(response.flashMessage('success'))
    assert.lengthOf(await auditRows('course.content.delete', c.id), 1)
  })

  test('authorization: an outsider gets 403 JSON on both delete routes', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const outsider = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s = await createModule(course, { order: 1 })
    const other = await createModule(course, { order: 2 })
    const c = await createContent(other)

    const m = await deleteJson(client, route('modules.delete', { moduleId: s.id }), outsider)
    m.assertStatus(403)
    const ct = await deleteJson(client, route('contents.delete', { contentId: c.id }), outsider)
    ct.assertStatus(403)

    assert.isNotNull(await CourseModule.find(s.id))
    assert.isNotNull(await CourseContent.find(c.id))
    assert.lengthOf(await auditRows('course.module.delete', s.id), 0)
    assert.lengthOf(await auditRows('course.content.delete', c.id), 0)
  })

  test('a section cannot be created under a sub-section (BUILD-04)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const root = await createModule(course)
    const sub = await createModule(course, { parentId: root.id })
    const url = route('courses.modules.create', { id: course.id })

    const tooDeep = await postForm(client, url, owner, {
      courseId: course.id,
      parentId: sub.id,
      title: 'Trop profond',
    })
    tooDeep.assertStatus(302)
    assertNotCsrfRejected(assert, tooDeep)
    assert.equal(tooDeep.flashMessage('error'), DEPTH_ERROR)
    assert.lengthOf(await CourseModule.query().where('title', 'Trop profond'), 0)

    const underRoot = await postForm(client, url, owner, {
      courseId: course.id,
      parentId: root.id,
      title: 'Sous-section',
    })
    underRoot.assertStatus(302)
    assert.isDefined(underRoot.flashMessage('success'))
    const created = await CourseModule.query().where('title', 'Sous-section').firstOrFail()
    assert.equal(created.parentId, root.id)
    assert.equal(created.order, 2)

    const atRoot = await postForm(client, url, owner, { courseId: course.id, title: 'Racine' })
    atRoot.assertStatus(302)
    const rootRow = await CourseModule.query().where('title', 'Racine').firstOrFail()
    assert.isNull(rootRow.parentId)
    assert.equal(rootRow.order, 2)
  })

  test('a section under a parent of another course is refused', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const foreign = await createModule(await createCourse(owner))

    const url = route('courses.modules.create', { id: course.id })
    const response = await postForm(client, url, owner, {
      courseId: course.id,
      parentId: foreign.id,
      title: 'Étrangère',
    })
    response.assertStatus(302)
    assert.equal(response.flashMessage('error'), PARENT_ERROR)
    assert.lengthOf(await CourseModule.query().where('title', 'Étrangère'), 0)
  })

  test('a content item cannot be created in a legacy third-level section (BUILD-07)', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const root = await createModule(course)
    const sub = await createModule(course, { parentId: root.id })
    const legacy = await createModule(course, { parentId: sub.id })

    const legacyUrl = route('modules.contents.create', { moduleId: legacy.id })
    const refused = await postForm(client, legacyUrl, owner, {
      moduleId: legacy.id,
      contentType: 'page',
      title: 'Invisible',
    })
    refused.assertStatus(302)
    assertNotCsrfRejected(assert, refused)
    assert.equal(refused.flashMessage('error'), DEPTH_ERROR)
    assert.lengthOf(await CourseContent.query().where('module_id', legacy.id), 0)

    const subUrl = route('modules.contents.create', { moduleId: sub.id })
    const created = await postForm(client, subUrl, owner, {
      moduleId: sub.id,
      contentType: 'video',
      title: 'Vidéo',
    })
    created.assertStatus(302)
    assert.isDefined(created.flashMessage('success'))
    const row = await CourseContent.query().where('module_id', sub.id).firstOrFail()
    assert.equal(row.contentType, 'video')
    assert.equal(row.order, 1)
  })
})

test.group('Builder - page props', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('builder renders flat sections and contents', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const root = await createModule(course)
    const child = await createModule(course, { parentId: root.id })
    const legacy = await createModule(course, { parentId: child.id })
    await createContent(legacy)
    await createContent(root)

    const response = await client
      .get(route('courses.builder', { id: course.id }))
      .withInertia()
      .loginAs(owner)
    response.assertStatus(200)
    const props = response.inertiaProps

    assert.sameMembers(
      props.sections.map((s: { id: number }) => s.id),
      [root.id, child.id, legacy.id]
    )
    assert.lengthOf(props.contents, 2)
    assert.isTrue(props.contents.every((c: object) => !('content' in c)))
    assert.deepEqual(Object.keys(props.course).sort(), ['code', 'id', 'title'])
  })
})
