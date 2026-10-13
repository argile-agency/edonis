import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import CourseEnrollment from '#models/course_enrollment'
import CourseEnrollmentRequest from '#models/course_enrollment_request'
import CourseGroupMember from '#models/course_group_member'
import {
  assertNotCsrfRejected,
  createCourse,
  createEnrollmentMethod,
  createGroup,
  createUser,
  enrollUser,
  grantPermission,
} from '#tests/functional/helpers/factories'

/**
 * Enrolment endpoints: policy routing (A1), input validation (V9-V12) and
 * course scoping of method / group ids (A9).
 *
 * Every write carries a CSRF token, and every 302 assertion proves the
 * request reached the controller (field-specific validation key, exact flash
 * text, or `assertNotCsrfRejected`).
 */
async function enrollmentCount(courseId: number, userId?: number): Promise<number> {
  const query = CourseEnrollment.query().where('course_id', courseId)
  if (userId !== undefined) {
    query.where('user_id', userId)
  }
  const rows = await query
  return rows.length
}

test.group('Enrollments - access and validation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('A1: an enrolled student can unenrol themself', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const student = await createUser({ roles: ['student'] })
    const enrollment = await enrollUser(course, student)

    const url = route('enrollments.unenroll', { enrollmentId: enrollment.id })
    const request = client.delete(url).withCsrfToken()
    const response = await request.loginAs(student).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isNull(await CourseEnrollment.find(enrollment.id))
  })

  test('another student cannot unenrol someone else', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const student = await createUser({ roles: ['student'] })
    const other = await createUser({ roles: ['student'] })
    const enrollment = await enrollUser(course, student)

    const url = route('enrollments.unenroll', { enrollmentId: enrollment.id })
    const request = client.delete(url).withCsrfToken()
    const response = await request.withInertia().loginAs(other).redirects(0)

    response.assertStatus(403)
    response.assertInertiaComponent('errors/forbidden')
    assert.isNotNull(await CourseEnrollment.find(enrollment.id))
  })

  test('a teacher with manage on the course can unenrol a student', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const manager = await createUser({ roles: ['teacher'] })
    await grantPermission(course, manager, 'manage')
    const student = await createUser({ roles: ['student'] })
    const enrollment = await enrollUser(course, student)

    const url = route('enrollments.unenroll', { enrollmentId: enrollment.id })
    const request = client.delete(url).withCsrfToken()
    const response = await request.loginAs(manager).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isNull(await CourseEnrollment.find(enrollment.id))
  })

  test('the owner can manually enrol users', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const s1 = await createUser({ roles: ['student'] })
    const s2 = await createUser({ roles: ['student'] })

    const url = route('enrollments.enroll-manual', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ userIds: [s1.id, s2.id] })
      .loginAs(owner)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(await enrollmentCount(course.id), 2)
    assert.equal(await enrollmentCount(course.id, s1.id), 1)
    assert.equal(await enrollmentCount(course.id, s2.id), 1)
  })

  test('a teacher with no rights on the course cannot manually enrol', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const outsider = await createUser({ roles: ['teacher'] })
    const student = await createUser({ roles: ['student'] })

    const url = route('enrollments.enroll-manual', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .withInertia()
      .json({ userIds: [student.id] })
      .loginAs(outsider)
      .redirects(0)

    response.assertStatus(403)
    response.assertInertiaComponent('errors/forbidden')
    assert.equal(await enrollmentCount(course.id), 0)
  })

  test('V12: manual enrolment without userIds is a validation error', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)

    const url = route('enrollments.enroll-manual', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request.json({}).loginAs(owner).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isDefined(response.flashMessage('inputErrorsBag.userIds'))
    assert.equal(await enrollmentCount(course.id), 0)
  })

  test('V9: key enrolment without a key is a validation error', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const method = await createEnrollmentMethod(course, {
      methodType: 'key',
      enrollmentKey: 'secret',
    })
    const student = await createUser({ roles: ['student'] })

    const url = route('enrollments.enroll-key', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ enrollmentMethodId: method.id })
      .loginAs(student)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isDefined(response.flashMessage('inputErrorsBag.enrollmentKey'))
    assert.equal(await enrollmentCount(course.id, student.id), 0)
  })

  test('V10: self enrolment without a method id is a validation error', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    await createEnrollmentMethod(course, { methodType: 'self' })
    const student = await createUser({ roles: ['student'] })

    const url = route('enrollments.enroll-self', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request.json({}).loginAs(student).redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isDefined(response.flashMessage('inputErrorsBag.enrollmentMethodId'))
    assert.equal(await enrollmentCount(course.id, student.id), 0)
  })

  test('V11: an oversized request message is a validation error', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const method = await createEnrollmentMethod(course, {
      methodType: 'approval',
      requiresApproval: true,
    })
    const student = await createUser({ roles: ['student'] })

    const url = route('enrollments.request', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ enrollmentMethodId: method.id, requestMessage: 'x'.repeat(5000) })
      .loginAs(student)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isDefined(response.flashMessage('inputErrorsBag.requestMessage'))
    const requests = await CourseEnrollmentRequest.query()
      .where('course_id', course.id)
      .where('user_id', student.id)
    assert.lengthOf(requests, 0)
  })

  test("A9: another course's method id cannot be used to self-enrol", async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const courseA = await createCourse(owner)
    const courseB = await createCourse(owner)
    await createEnrollmentMethod(courseA, { methodType: 'self' })
    const methodB = await createEnrollmentMethod(courseB, { methodType: 'self' })
    const student = await createUser({ roles: ['student'] })

    const url = route('enrollments.enroll-self', { id: courseA.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ enrollmentMethodId: methodB.id })
      .loginAs(student)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('error'), "Méthode d'inscription invalide.")
    assert.equal(await enrollmentCount(courseA.id, student.id), 0)
    assert.equal(await enrollmentCount(courseB.id, student.id), 0)
  })

  test("A9: another course's group id cannot be used in manual enrolment", async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const courseA = await createCourse(owner)
    const courseB = await createCourse(owner)
    const groupB = await createGroup(courseB)
    const student = await createUser({ roles: ['student'] })

    const url = route('enrollments.enroll-manual', { id: courseA.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ userIds: [student.id], groupId: groupB.id })
      .loginAs(owner)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('error'), 'Groupe invalide pour ce cours.')
    const members = await CourseGroupMember.query().where('group_id', groupB.id)
    assert.lengthOf(members, 0)
    assert.equal(await enrollmentCount(courseA.id), 0)
  })
})

/**
 * AS4 (behaviour change): self and key enrolment are refused server-side when
 * `course.canEnroll()` is false. Admins bypass the check via the policy.
 */
const ENROLMENT_CLOSED = 'Les inscriptions à ce cours ne sont pas ouvertes.'

test.group('Enrollments - AS4 canEnroll', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('self enrolment into a draft course is refused', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner, { status: 'draft' })
    const method = await createEnrollmentMethod(course, { methodType: 'self' })
    const student = await createUser({ roles: ['student'] })

    const url = route('enrollments.enroll-self', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ enrollmentMethodId: method.id })
      .loginAs(student)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('error'), ENROLMENT_CLOSED)
    assert.equal(await enrollmentCount(course.id, student.id), 0)
  })

  test('key enrolment into a course with enrolment disabled is refused', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner, { status: 'published', allowEnrollment: false })
    const method = await createEnrollmentMethod(course, {
      methodType: 'key',
      enrollmentKey: 'secret',
    })
    const student = await createUser({ roles: ['student'] })

    const url = route('enrollments.enroll-key', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ enrollmentMethodId: method.id, enrollmentKey: 'secret' })
      .loginAs(student)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('error'), ENROLMENT_CLOSED)
    assert.equal(await enrollmentCount(course.id, student.id), 0)
  })

  test('self enrolment before the course start date is refused', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner, { status: 'published' })
    course.startDate = DateTime.now().plus({ days: 7 })
    await course.save()
    const method = await createEnrollmentMethod(course, { methodType: 'self' })
    const student = await createUser({ roles: ['student'] })

    const url = route('enrollments.enroll-self', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ enrollmentMethodId: method.id })
      .loginAs(student)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('error'), ENROLMENT_CLOSED)
    assert.equal(await enrollmentCount(course.id, student.id), 0)
  })

  test('self enrolment into an open course still works', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner, { status: 'published', allowEnrollment: true })
    const method = await createEnrollmentMethod(course, { methodType: 'self' })
    const student = await createUser({ roles: ['student'] })

    const url = route('enrollments.enroll-self', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ enrollmentMethodId: method.id })
      .loginAs(student)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    response.assertHeader('location', route('courses.show', { id: course.id }))
    assert.isUndefined(response.flashMessage('error'))
    assert.equal(await enrollmentCount(course.id, student.id), 1)
  })

  test('an admin can still self-enrol into a draft course', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner, { status: 'draft' })
    const method = await createEnrollmentMethod(course, { methodType: 'self' })
    const admin = await createUser({ roles: ['admin'] })

    const url = route('enrollments.enroll-self', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ enrollmentMethodId: method.id })
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    response.assertHeader('location', route('courses.show', { id: course.id }))
    assert.isUndefined(response.flashMessage('error'))
    assert.equal(await enrollmentCount(course.id, admin.id), 1)
  })
})
