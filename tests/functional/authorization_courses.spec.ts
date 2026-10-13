import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Course from '#models/course'
import CoursePermission from '#models/course_permission'
import {
  assertNotCsrfRejected,
  createCourse,
  createUser,
  grantPermission,
} from '#tests/functional/helpers/factories'

/**
 * HTTP-level authorization matrix for the courses routes, now routed through
 * CoursePolicy.
 *
 * Every request either uses `.withInertia()` (so error pages come back as
 * Inertia JSON) or `.redirects(0)`, so no full-HTML render (and no Vite
 * manifest) is ever needed. Successful writes skip `.withInertia()` because
 * Inertia turns a 302 into a 303 on PUT/PATCH/DELETE.
 */

type ListedCourse = { id: number }

function listedIds(courses: { data: ListedCourse[] }, createdIds: number[]): number[] {
  return courses.data
    .map((course) => course.id)
    .filter((id) => createdIds.includes(id))
    .sort((a, b) => a - b)
}

test.group('Courses - authorization (HTTP)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('teacher without rights gets the 403 page on edit', async ({ client, route }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const outsider = await createUser({ roles: ['teacher'] })

    const response = await client
      .get(route('courses.edit', { id: course.id }))
      .withInertia()
      .loginAs(outsider)

    response.assertStatus(403)
    response.assertInertiaComponent('errors/forbidden')
  })

  test('teacher with an edit permission can open edit', async ({ client, route }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const editor = await createUser({ roles: ['teacher'] })
    await grantPermission(course, editor, 'edit')

    const response = await client
      .get(route('courses.edit', { id: course.id }))
      .withInertia()
      .loginAs(editor)

    response.assertStatus(200)
    response.assertInertiaComponent('courses/edit')
  })

  test('admin who does not own the course can open edit', async ({ client, route }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const admin = await createUser({ roles: ['admin'] })

    const response = await client
      .get(route('courses.edit', { id: course.id }))
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('courses/edit')
  })

  test('owner can publish; a view-permission teacher cannot', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const viewer = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner, { status: 'draft' })
    await grantPermission(course, viewer, 'view')

    const url = route('courses.publish', { id: course.id })

    const deniedRequest = client.post(url).withCsrfToken()
    const denied = await deniedRequest.withInertia().loginAs(viewer).redirects(0)

    denied.assertStatus(403)
    denied.assertInertiaComponent('errors/forbidden')
    const afterDenied = await Course.findOrFail(course.id)
    assert.equal(afterDenied.status, 'draft')

    const allowedRequest = client.post(url).withCsrfToken()
    const allowed = await allowedRequest.loginAs(owner).redirects(0)

    allowed.assertStatus(302)
    assertNotCsrfRejected(assert, allowed)
    assert.equal(allowed.flashMessage('success'), 'Course published successfully')
    const afterAllowed = await Course.findOrFail(course.id)
    assert.equal(afterAllowed.status, 'published')
  })

  test('only the owner can delete; a manage-permission teacher cannot', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const manager = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    await grantPermission(course, manager, 'manage')

    const url = route('courses.destroy', { id: course.id })

    const deniedRequest = client.delete(url).withCsrfToken()
    const denied = await deniedRequest.withInertia().loginAs(manager).redirects(0)

    denied.assertStatus(403)
    denied.assertInertiaComponent('errors/forbidden')
    assert.isNotNull(await Course.find(course.id))

    const allowedRequest = client.delete(url).withCsrfToken()
    const allowed = await allowedRequest.loginAs(owner).redirects(0)

    allowed.assertStatus(302)
    assertNotCsrfRejected(assert, allowed)
    assert.equal(allowed.flashMessage('success'), 'Course deleted successfully')
    assert.isNull(await Course.find(course.id))
  })

  test('unrelated student gets the 403 page on a private course', async ({ client, route }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner, { visibility: 'private' })
    const student = await createUser({ roles: ['student'] })

    const response = await client
      .get(route('courses.show', { id: course.id }))
      .withInertia()
      .loginAs(student)

    response.assertStatus(403)
    response.assertInertiaComponent('errors/forbidden')
  })

  test('unrelated student can view a public course', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner, { visibility: 'public' })
    const student = await createUser({ roles: ['student'] })

    const response = await client
      .get(route('courses.show', { id: course.id }))
      .withInertia()
      .loginAs(student)

    response.assertStatus(200)
    response.assertInertiaComponent('courses/show')
    assert.deepEqual(response.inertiaProps.permissions, { canEdit: false, canManage: false })
  })

  test('A4: a course manager cannot remove a permission row of another course', async ({
    client,
    route,
    assert,
  }) => {
    const ownerA = await createUser({ roles: ['teacher'] })
    const ownerB = await createUser({ roles: ['teacher'] })
    const teacher = await createUser({ roles: ['teacher'] })
    const helperA = await createUser({ roles: ['teacher'] })
    const helperB = await createUser({ roles: ['teacher'] })

    const courseA = await createCourse(ownerA)
    const courseB = await createCourse(ownerB)
    await grantPermission(courseA, teacher, 'manage')
    const ownRow = await grantPermission(courseA, helperA, 'view')
    const foreignRow = await grantPermission(courseB, helperB, 'edit')

    // Cross-course id: the scoped lookup must miss and 404, leaving the row intact.
    const crossUrl = route('courses.permissions.remove', {
      courseId: courseA.id,
      permissionId: foreignRow.id,
    })
    const crossRequest = client.delete(crossUrl).withCsrfToken()
    const crossCourse = await crossRequest.withInertia().loginAs(teacher).redirects(0)

    crossCourse.assertStatus(404)
    crossCourse.assertInertiaComponent('errors/not_found')
    assert.isNotNull(await CoursePermission.find(foreignRow.id))

    // Positive control: the same request shape on a row of course A succeeds,
    // so the 404 above is the course scope, not a harness rejection.
    const sameUrl = route('courses.permissions.remove', {
      courseId: courseA.id,
      permissionId: ownRow.id,
    })
    const sameRequest = client.delete(sameUrl).withCsrfToken()
    const sameCourse = await sameRequest.loginAs(teacher).redirects(0)

    sameCourse.assertStatus(302)
    assertNotCsrfRejected(assert, sameCourse)
    assert.equal(sameCourse.flashMessage('success'), 'Permission removed successfully')
    assert.isNull(await CoursePermission.find(ownRow.id))
    assert.isNotNull(await CoursePermission.find(foreignRow.id))
  })

  test('listing: students see published public courses only', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const student = await createUser({ roles: ['student'] })
    const published = await createCourse(owner, { status: 'published', visibility: 'public' })
    const draft = await createCourse(owner, { status: 'draft', visibility: 'public' })
    const privateCourse = await createCourse(owner, {
      status: 'published',
      visibility: 'private',
    })
    const createdIds = [published.id, draft.id, privateCourse.id]

    const response = await client.get(route('courses.index')).withInertia().loginAs(student)

    response.assertStatus(200)
    assert.deepEqual(listedIds(response.inertiaProps.courses, createdIds), [published.id])
  })

  test('listing: a teacher sees their own draft course', async ({ client, route, assert }) => {
    const teacher = await createUser({ roles: ['teacher'] })
    const other = await createUser({ roles: ['teacher'] })
    const ownDraft = await createCourse(teacher, { status: 'draft', visibility: 'private' })
    const otherDraft = await createCourse(other, { status: 'draft', visibility: 'private' })
    const createdIds = [ownDraft.id, otherDraft.id]

    const response = await client.get(route('courses.index')).withInertia().loginAs(teacher)

    response.assertStatus(200)
    assert.deepEqual(listedIds(response.inertiaProps.courses, createdIds), [ownDraft.id])
  })

  test('listing: a status filter applies to the whole grouped visibility scope', async ({
    client,
    route,
    assert,
  }) => {
    const teacher = await createUser({ roles: ['teacher'] })
    const other = await createUser({ roles: ['teacher'] })
    const ownDraft = await createCourse(teacher, { status: 'draft' })
    const ownPublished = await createCourse(teacher, { status: 'published' })
    const sharedPublished = await createCourse(other, { status: 'published' })
    await grantPermission(sharedPublished, teacher, 'edit')
    const createdIds = [ownDraft.id, ownPublished.id, sharedPublished.id]

    const response = await client
      .get(route('courses.index'))
      .qs({ status: 'draft' })
      .withInertia()
      .loginAs(teacher)

    response.assertStatus(200)
    const ids = listedIds(response.inertiaProps.courses, createdIds)
    // An ungrouped OR would leak the teacher's own published course here.
    assert.deepEqual(ids, [ownDraft.id])
    assert.notInclude(ids, ownPublished.id)
    assert.notInclude(ids, sharedPublished.id)
  })
})
