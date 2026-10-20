import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import {
  createCourse,
  createEnrollmentMethod,
  createUser,
  enrollUser,
  grantPermission,
  uniqueSuffix,
} from '#tests/functional/helpers/factories'

/**
 * CR-02: the enrolment page must never ship the plaintext enrolment key to
 * learners, while managers keep seeing it on the methods management page.
 */

const LEARNER_METHOD_FIELDS = [
  'id',
  'methodType',
  'name',
  'isEnabled',
  'maxEnrollments',
  'currentEnrollments',
  'enrollmentStartDate',
  'enrollmentEndDate',
  'approvalMessage',
  'welcomeMessage',
  'requiresKey',
  'isAvailable',
]

type Props = { enrollmentMethods: Record<string, unknown>[] }

async function keyCourseFixture() {
  const owner = await createUser({ roles: ['teacher'] })
  const course = await createCourse(owner)
  const sentinel = `KEY-SENTINEL-${uniqueSuffix()}`
  const method = await createEnrollmentMethod(course, {
    methodType: 'key',
    name: 'Key method',
    enrollmentKey: sentinel,
  })
  return { owner, course, sentinel, method }
}

test.group('Enrollments - show page (CR-02)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('learner props never contain the enrolment key', async ({ client, route, assert }) => {
    const { course, sentinel } = await keyCourseFixture()
    const student = await createUser({ roles: ['student'] })

    const response = await client
      .get(route('enrollments.show', { id: course.id }))
      .withInertia()
      .loginAs(student)

    response.assertStatus(200)
    response.assertInertiaComponent('enrollments/show')
    const serialized = JSON.stringify(response.inertiaProps)
    assert.notInclude(serialized, sentinel)
    assert.notInclude(serialized, 'enrollmentKey')
  })

  test('key method still renders its form for learners', async ({ client, route, assert }) => {
    const { course, method } = await keyCourseFixture()
    const student = await createUser({ roles: ['student'] })

    const response = await client
      .get(route('enrollments.show', { id: course.id }))
      .withInertia()
      .loginAs(student)

    response.assertStatus(200)
    const props = response.inertiaProps as Props
    const keyMethod = props.enrollmentMethods.find((m) => m.id === method.id)
    assert.exists(keyMethod)
    assert.equal(keyMethod!.methodType, 'key')
    assert.isTrue(keyMethod!.requiresKey)
    assert.isTrue(keyMethod!.isEnabled)
    assert.isTrue(keyMethod!.isAvailable)
    assert.sameMembers(Object.keys(keyMethod!), LEARNER_METHOD_FIELDS)
  })

  test('manager still sees the key on the methods page', async ({ client, route, assert }) => {
    const { owner, course, sentinel, method } = await keyCourseFixture()

    const response = await client
      .get(route('courses.enrollment-methods.index', { id: course.id }))
      .withInertia()
      .loginAs(owner)

    response.assertStatus(200)
    const props = response.inertiaProps as Props
    const keyMethod = props.enrollmentMethods.find((m) => m.id === method.id)
    assert.equal(keyMethod?.enrollmentKey, sentinel)
  })
})

test.group('Enrollments - show page authorization', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function closedPrivateCourse() {
    const owner = await createUser({ roles: ['teacher'] })
    return createCourse(owner, { visibility: 'private', allowEnrollment: false })
  }

  test('closed private course gives the 403 page', async ({ client, route }) => {
    const course = await closedPrivateCourse()
    const student = await createUser({ roles: ['student'] })

    const response = await client
      .get(route('enrollments.show', { id: course.id }))
      .withInertia()
      .loginAs(student)

    response.assertStatus(403)
    response.assertInertiaComponent('errors/forbidden')
  })

  test('private course open for enrolment stays reachable by link', async ({ client, route }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner, { visibility: 'private', allowEnrollment: true })
    await createEnrollmentMethod(course, { methodType: 'key', enrollmentKey: 'k' })
    const student = await createUser({ roles: ['student'] })

    const response = await client
      .get(route('enrollments.show', { id: course.id }))
      .withInertia()
      .loginAs(student)

    response.assertStatus(200)
    response.assertInertiaComponent('enrollments/show')
  })

  test('public course closed for enrolment stays viewable', async ({ client, route }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner, { visibility: 'public', allowEnrollment: false })
    const student = await createUser({ roles: ['student'] })

    const response = await client
      .get(route('enrollments.show', { id: course.id }))
      .withInertia()
      .loginAs(student)

    response.assertStatus(200)
    response.assertInertiaComponent('enrollments/show')
  })

  test('public draft course gives the 403 page to an unrelated student', async ({
    client,
    route,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner, { status: 'draft' })
    const student = await createUser({ roles: ['student'] })

    const response = await client
      .get(route('enrollments.show', { id: course.id }))
      .withInertia()
      .loginAs(student)

    response.assertStatus(403)
    response.assertInertiaComponent('errors/forbidden')
  })

  test('enrolled student still opens a public archived course', async ({ client, route }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner, { status: 'archived' })
    const student = await createUser({ roles: ['student'] })
    await enrollUser(course, student)

    const response = await client
      .get(route('enrollments.show', { id: course.id }))
      .withInertia()
      .loginAs(student)

    response.assertStatus(200)
    response.assertInertiaComponent('enrollments/show')
  })

  test('view permission holder and admin can open a closed private course', async ({
    client,
    route,
  }) => {
    const course = await closedPrivateCourse()
    const viewer = await createUser({ roles: ['teacher'] })
    await grantPermission(course, viewer, 'view')
    const admin = await createUser({ roles: ['admin'] })

    for (const user of [viewer, admin]) {
      const response = await client
        .get(route('enrollments.show', { id: course.id }))
        .withInertia()
        .loginAs(user)

      response.assertStatus(200)
      response.assertInertiaComponent('enrollments/show')
    }
  })
})
