import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import User from '#models/user'
import Course from '#models/course'
import CourseEnrollment from '#models/course_enrollment'
import {
  createUser as createUserWithRoles,
  grantPermission,
} from '#tests/functional/helpers/factories'

/**
 * Unique suffix so fixtures never collide with seeded rows
 * (e.g. student@edonis.test) or with each other. `users.email` and
 * `courses.code` are both unique; `courses.code` is limited to 20 chars.
 */
function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function uniqueCourseCode() {
  return `T${Date.now() % 1_000_000_000}${Math.floor(Math.random() * 1_000_000)}`
}

async function createUser(prefix: string) {
  return User.create({
    email: `${prefix}-${uniqueSuffix()}@test.com`,
    password: 'password',
    fullName: `Test ${prefix}`,
  })
}

/**
 * Creates an instructor, a published course owned by that instructor,
 * and a student actively enrolled in it.
 */
async function createEnrolledCourse() {
  const instructor = await createUser('instructor')
  const student = await createUser('student')

  const course = await Course.create({
    code: uniqueCourseCode(),
    title: 'Introduction to Computer Science',
    instructorId: instructor.id,
    status: 'published',
    visibility: 'public',
  })

  await CourseEnrollment.create({
    userId: student.id,
    courseId: course.id,
    status: 'active',
    enrolledAt: DateTime.now(),
  })

  return { instructor, student, course }
}

test.group('Grades - access control', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('unauthenticated user is redirected to login', async ({ client, route }) => {
    // Do not follow the redirect: GET /login would render the full Inertia
    // HTML layout, which requires a built Vite manifest.
    const response = await client.get(route('grades.index')).redirects(0)

    response.assertStatus(302)
    response.assertHeader('location', '/login')
  })

  test('enrolled student can open the course gradebook', async ({ client, route, assert }) => {
    const { student, course } = await createEnrolledCourse()

    const response = await client
      .get(route('grades.course', { id: course.id }))
      .withInertia()
      .loginAs(student)

    response.assertStatus(200)
    assert.isFalse(response.inertiaProps.isInstructor)
  })

  test('non-enrolled student is forbidden', async ({ client, route }) => {
    const { course } = await createEnrolledCourse()
    const outsider = await createUser('unenrolled')

    const response = await client
      .get(route('grades.course', { id: course.id }))
      .withInertia()
      .loginAs(outsider)

    response.assertStatus(403)
    response.assertInertiaComponent('errors/forbidden')
  })

  test('instructor sees the instructor view', async ({ client, route, assert }) => {
    const { instructor, course } = await createEnrolledCourse()

    const response = await client
      .get(route('grades.course', { id: course.id }))
      .withInertia()
      .loginAs(instructor)

    response.assertStatus(200)
    assert.isTrue(response.inertiaProps.isInstructor)
  })

  test('admin who neither owns nor is enrolled sees the instructor view (AS2)', async ({
    client,
    route,
    assert,
  }) => {
    const { course } = await createEnrolledCourse()
    const admin = await createUserWithRoles({ roles: ['admin'] })

    const response = await client
      .get(route('grades.course', { id: course.id }))
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    assert.isTrue(response.inertiaProps.isInstructor)
  })

  test('edit co-instructor sees the instructor view (AS2)', async ({ client, route, assert }) => {
    const { course } = await createEnrolledCourse()
    const coInstructor = await createUserWithRoles({ roles: ['teacher'] })
    await grantPermission(course, coInstructor, 'edit')

    const response = await client
      .get(route('grades.course', { id: course.id }))
      .withInertia()
      .loginAs(coInstructor)

    response.assertStatus(200)
    assert.isTrue(response.inertiaProps.isInstructor)
  })

  test('view-only collaborator who is not enrolled is forbidden', async ({ client, route }) => {
    const { course } = await createEnrolledCourse()
    const viewer = await createUserWithRoles({ roles: ['teacher'] })
    await grantPermission(course, viewer, 'view')

    const response = await client
      .get(route('grades.course', { id: course.id }))
      .withInertia()
      .loginAs(viewer)

    response.assertStatus(403)
    response.assertInertiaComponent('errors/forbidden')
  })

  test('non-enrolled JSON caller gets a JSON 403, not the Inertia page', async ({
    client,
    route,
    assert,
  }) => {
    const { course } = await createEnrolledCourse()
    const outsider = await createUser('unenrolled-json')

    const response = await client
      .get(route('grades.course', { id: course.id }))
      .header('accept', 'application/json')
      .loginAs(outsider)

    response.assertStatus(403)
    assert.match(response.header('content-type') ?? '', /application\/json/)
    assert.isUndefined(response.body().component)
    assert.isArray(response.body().errors)
  })
})
