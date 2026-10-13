import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type Course from '#models/course'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import {
  assertNotCsrfRejected,
  createCourse,
  createUser,
  enrollUser,
} from '#tests/functional/helpers/factories'

/**
 * HTTP-level authorization and id-scoping for the course contents routes
 * (builder, learn player, module/content reorder, module parents).
 *
 * Pages use `.withInertia()` so error pages come back as Inertia JSON.
 * Successful writes skip `.withInertia()` because Inertia turns a 302 into a
 * 303 on PUT/PATCH/DELETE; they use `.redirects(0)` instead.
 */

const PARENT_ERROR = 'Module parent invalide.'

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

test.group('Course contents - authorization and scoping', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('builder: a teacher without rights gets the 403 page; the owner gets the builder', async ({
    client,
    route,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const outsider = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const url = route('courses.builder', { id: course.id })

    const denied = await client.get(url).withInertia().loginAs(outsider)
    denied.assertStatus(403)
    denied.assertInertiaComponent('errors/forbidden')

    const allowed = await client.get(url).withInertia().loginAs(owner)
    allowed.assertStatus(200)
    allowed.assertInertiaComponent('courses/builder')
  })

  test('A2: reorderModules only touches modules of the authorized course', async ({
    client,
    route,
    assert,
  }) => {
    const ownerA = await createUser({ roles: ['teacher'] })
    const ownerB = await createUser({ roles: ['teacher'] })
    const courseA = await createCourse(ownerA)
    const courseB = await createCourse(ownerB)
    const moduleA = await createModule(courseA, { order: 1 })
    const moduleB = await createModule(courseB, { order: 3 })

    const url = route('courses.modules.reorder', { id: courseA.id })
    const req = client.post(url).withCsrfToken()
    const response = await req
      .json({
        modules: [
          { id: moduleB.id, order: 99 },
          { id: moduleA.id, order: 7 },
        ],
      })
      .loginAs(ownerA)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    // Positive control: the in-course module was reordered by the same request.
    const ownAfter = await CourseModule.findOrFail(moduleA.id)
    const foreignAfter = await CourseModule.findOrFail(moduleB.id)
    assert.equal(ownAfter.order, 7)
    assert.equal(foreignAfter.order, 3)
  })

  test('A3: reorderContents only touches contents of the authorized module', async ({
    client,
    route,
    assert,
  }) => {
    const ownerA = await createUser({ roles: ['teacher'] })
    const ownerB = await createUser({ roles: ['teacher'] })
    const courseA = await createCourse(ownerA)
    const courseB = await createCourse(ownerB)
    const moduleA = await createModule(courseA)
    const moduleB = await createModule(courseB)
    const contentA = await createContent(moduleA, { order: 1 })
    const foreignContent = await createContent(moduleB, { order: 3 })

    const url = route('modules.contents.reorder', { moduleId: moduleA.id })
    const req = client.post(url).withCsrfToken()
    const response = await req
      .json({
        contents: [
          { id: foreignContent.id, order: 99 },
          { id: contentA.id, order: 7 },
        ],
      })
      .loginAs(ownerA)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    // Positive control: the in-module content was reordered by the same request.
    const ownAfter = await CourseContent.findOrFail(contentA.id)
    const foreignAfter = await CourseContent.findOrFail(foreignContent.id)
    assert.equal(ownAfter.order, 7)
    assert.equal(foreignAfter.order, 3)
  })

  test('A5: learn cannot serve published content of another course', async ({ client, route }) => {
    const ownerA = await createUser({ roles: ['teacher'] })
    const ownerB = await createUser({ roles: ['teacher'] })
    const courseA = await createCourse(ownerA)
    const courseB = await createCourse(ownerB)
    const moduleB = await createModule(courseB)
    const foreignContent = await createContent(moduleB)
    const student = await createUser({ roles: ['student'] })
    await enrollUser(courseA, student)

    const response = await client
      .get(route('courses.learn', { id: courseA.id }))
      .qs({ content: foreignContent.id })
      .withInertia()
      .loginAs(student)

    response.assertStatus(404)
    response.assertInertiaComponent('errors/not_found')
  })

  test('A8: updateModule refuses a parent from another course, itself, or a descendant', async ({
    client,
    route,
    assert,
  }) => {
    const ownerA = await createUser({ roles: ['teacher'] })
    const ownerB = await createUser({ roles: ['teacher'] })
    const courseA = await createCourse(ownerA)
    const courseB = await createCourse(ownerB)
    const moduleA = await createModule(courseA)
    const childOfA = await createModule(courseA, { parentId: moduleA.id })
    const moduleB = await createModule(courseB)

    const url = route('modules.update', { moduleId: moduleA.id })

    for (const parentId of [moduleB.id, moduleA.id, childOfA.id]) {
      const req = client.put(url).withCsrfToken()
      const response = await req.json({ parentId }).loginAs(ownerA).redirects(0)

      response.assertStatus(302)
      assertNotCsrfRejected(assert, response)
      assert.equal(response.flashMessage('error'), PARENT_ERROR)
      const after = await CourseModule.findOrFail(moduleA.id)
      assert.isNull(after.parentId)
    }

    // Positive control: a sibling module of the same course is accepted.
    const sibling = await createModule(courseA)
    const okReq = client.put(url).withCsrfToken()
    const ok = await okReq.json({ parentId: sibling.id }).loginAs(ownerA).redirects(0)

    ok.assertStatus(302)
    assertNotCsrfRejected(assert, ok)
    assert.isUndefined(ok.flashMessage('error'))
    const moved = await CourseModule.findOrFail(moduleA.id)
    assert.equal(moved.parentId, sibling.id)
  })

  test('A8: createModule refuses a parent from another course', async ({
    client,
    route,
    assert,
  }) => {
    const ownerA = await createUser({ roles: ['teacher'] })
    const ownerB = await createUser({ roles: ['teacher'] })
    const courseA = await createCourse(ownerA)
    const courseB = await createCourse(ownerB)
    const moduleB = await createModule(courseB)

    const url = route('courses.modules.create', { id: courseA.id })
    const req = client.post(url).withCsrfToken()
    const response = await req
      .json({ courseId: courseA.id, parentId: moduleB.id, title: 'Injected' })
      .loginAs(ownerA)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('error'), PARENT_ERROR)
    const created = await CourseModule.query().where('course_id', courseA.id)
    assert.lengthOf(created, 0)
  })

  test('learn: a non-enrolled student is redirected to the course page', async ({
    client,
    route,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const student = await createUser({ roles: ['student'] })

    const response = await client
      .get(route('courses.learn', { id: course.id }))
      .loginAs(student)
      .redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', route('courses.show', { id: course.id }))
  })

  test('V17: learn rejects a non-numeric content id with a validation redirect', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const student = await createUser({ roles: ['student'] })
    await enrollUser(course, student)

    const response = await client
      .get(route('courses.learn', { id: course.id }))
      .qs({ content: 'abc' })
      .loginAs(student)
      .redirects(0)

    response.assertStatus(302)
    assert.isDefined(response.flashMessage('inputErrorsBag.content'))
  })
})
