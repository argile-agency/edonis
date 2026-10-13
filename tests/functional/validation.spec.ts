import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Course from '#models/course'
import CourseCategory from '#models/course_category'
import CourseEnrollment from '#models/course_enrollment'
import CourseEnrollmentMethod from '#models/course_enrollment_method'
import CourseGroup from '#models/course_group'
import CourseGrouping from '#models/course_grouping'
import {
  assertNotCsrfRejected,
  createCourse,
  createEnrollmentMethod,
  createGroup,
  createUser,
  uniqueSuffix,
} from '#tests/functional/helpers/factories'

/**
 * Input validation of the courses controller (DEBT-05: V1-V7, V14), the
 * course-scoping of referenced group / grouping ids (A9), and the contracts
 * between the course forms and their validators.
 *
 * Every write carries a CSRF token, and every 302 assertion proves the request
 * reached the controller: a field-specific `inputErrorsBag.<field>` key, the
 * exact A9 flash, or `assertNotCsrfRejected` plus the persisted values.
 */

async function createCategory(): Promise<CourseCategory> {
  const slug = `cat-${uniqueSuffix()}`
  return CourseCategory.create({
    name: `Category ${slug}`,
    slug,
    parentId: null,
    path: `/${slug}`,
    depth: 0,
    sortOrder: 0,
    isVisible: true,
  })
}

async function methodCount(courseId: number): Promise<number> {
  const rows = await CourseEnrollmentMethod.query().where('course_id', courseId)
  return rows.length
}

async function groupCount(courseId: number): Promise<number> {
  const rows = await CourseGroup.query().where('course_id', courseId)
  return rows.length
}

async function groupingCount(courseId: number): Promise<number> {
  const rows = await CourseGrouping.query().where('course_id', courseId)
  return rows.length
}

async function enrollmentCount(courseId: number): Promise<number> {
  const rows = await CourseEnrollment.query().where('course_id', courseId)
  return rows.length
}

type ListedCourse = { id: number }

function listedIds(courses: { data: ListedCourse[] }, createdIds: number[]): number[] {
  return courses.data
    .map((course) => course.id)
    .filter((id) => createdIds.includes(id))
    .sort((a, b) => a - b)
}

test.group('Courses - input validation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('V1: an unknown methodType is a validation error, not a row', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)

    const url = route('courses.enrollment-methods.create', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ methodType: 'hacker', name: 'Nope' })
      .loginAs(owner)
      .redirects(0)

    response.assertStatus(302)
    assert.isDefined(response.flashMessage('inputErrorsBag.methodType'))
    assert.equal(await methodCount(course.id), 0)
  })

  test('V1: a valid self method is created with typed values', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const ownGroup = await createGroup(course)

    const url = route('courses.enrollment-methods.create', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({
        methodType: 'self',
        name: 'Auto-inscription',
        isEnabled: true,
        sortOrder: 2,
        maxEnrollments: '25',
        defaultRole: 'student',
        enrollmentStartDate: '2026-01-15',
        enrollmentEndDate: '',
        enrollmentKey: '',
        autoAssignGroupId: ownGroup.id,
        currentEnrollments: 999,
      })
      .loginAs(owner)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isUndefined(response.flashMessage('inputErrorsBag'))
    assert.equal(response.flashMessage('success'), 'Enrollment method created successfully')

    const methods = await CourseEnrollmentMethod.query().where('course_id', course.id)
    assert.lengthOf(methods, 1)
    const method = methods[0]
    assert.equal(method.methodType, 'self')
    assert.equal(method.name, 'Auto-inscription')
    assert.strictEqual(method.maxEnrollments, 25)
    assert.equal(method.sortOrder, 2)
    assert.equal(method.defaultRole, 'student')
    assert.equal(method.enrollmentStartDate?.toISODate(), '2026-01-15')
    assert.isNull(method.enrollmentEndDate)
    assert.isNull(method.enrollmentKey)
    assert.equal(method.autoAssignGroupId, ownGroup.id)
    // Not a validator field: the counter cannot be mass-assigned
    assert.equal(method.currentEnrollments, 0)
  })

  test("V1/A9: another course's group cannot be the auto-assign group", async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const courseA = await createCourse(owner)
    const courseB = await createCourse(owner)
    const groupB = await createGroup(courseB)

    const url = route('courses.enrollment-methods.create', { id: courseA.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ methodType: 'self', autoAssignGroupId: groupB.id })
      .loginAs(owner)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('error'), 'Groupe invalide pour ce cours.')
    assert.equal(await methodCount(courseA.id), 0)
    assert.equal(await methodCount(courseB.id), 0)
  })

  test('V2: an over-long enrollment key is rejected and the key is unchanged', async ({
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

    const url = route('courses.enrollment-methods.update', {
      id: course.id,
      methodId: method.id,
    })
    const request = client.put(url).withCsrfToken()
    const response = await request
      .json({ enrollmentKey: 'k'.repeat(101) })
      .loginAs(owner)
      .redirects(0)

    response.assertStatus(302)
    assert.isDefined(response.flashMessage('inputErrorsBag.enrollmentKey'))
    const after = await CourseEnrollmentMethod.findOrFail(method.id)
    assert.equal(after.enrollmentKey, 'secret')
  })

  test("V2/A9: an update cannot point the auto-assign group at another course's group", async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const courseA = await createCourse(owner)
    const courseB = await createCourse(owner)
    const groupB = await createGroup(courseB)
    const method = await createEnrollmentMethod(courseA, { name: 'Original' })

    const url = route('courses.enrollment-methods.update', {
      id: courseA.id,
      methodId: method.id,
    })
    const request = client.put(url).withCsrfToken()
    const response = await request
      .json({ name: 'Changed', autoAssignGroupId: groupB.id })
      .loginAs(owner)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('error'), 'Groupe invalide pour ce cours.')
    const after = await CourseEnrollmentMethod.findOrFail(method.id)
    assert.equal(after.name, 'Original')
    assert.isNull(after.autoAssignGroupId)
  })

  test('V3: a grouping without a name is a validation error, not a 500', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)

    const url = route('courses.groupings.create', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request.json({ description: 'No name' }).loginAs(owner).redirects(0)

    response.assertStatus(302)
    assert.isDefined(response.flashMessage('inputErrorsBag.name'))
    assert.equal(await groupingCount(course.id), 0)
  })

  test("V4/A9: a group cannot join another course's grouping", async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const courseA = await createCourse(owner)
    const courseB = await createCourse(owner)
    const groupingB = await CourseGrouping.create({ courseId: courseB.id, name: 'Grouping B' })

    const url = route('courses.groups.create', { id: courseA.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ name: 'Group A1', groupingId: groupingB.id })
      .loginAs(owner)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('error'), 'Regroupement invalide pour ce cours.')
    assert.equal(await groupCount(courseA.id), 0)
    assert.equal(await groupCount(courseB.id), 0)
  })

  test("V4: a group joins its own course's grouping with typed values", async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const grouping = await CourseGrouping.create({ courseId: course.id, name: 'Grouping' })

    const url = route('courses.groups.create', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ name: 'Group 1', groupingId: grouping.id, maxMembers: '12' })
      .loginAs(owner)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.equal(response.flashMessage('success'), 'Group created successfully')
    const groups = await CourseGroup.query().where('course_id', course.id)
    assert.lengthOf(groups, 1)
    assert.equal(groups[0].groupingId, grouping.id)
    assert.strictEqual(groups[0].maxMembers, 12)
  })

  test('V5: rejecting a course requires a reason', async ({ client, route, assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const admin = await createUser({ roles: ['admin'] })
    const course = await createCourse(owner, { status: 'draft' })
    course.approvalStatus = 'pending_approval'
    await course.save()

    const url = route('admin.courses.reject', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request.json({}).loginAs(admin).redirects(0)

    response.assertStatus(302)
    assert.isDefined(response.flashMessage('inputErrorsBag.reason'))
    const after = await Course.findOrFail(course.id)
    assert.equal(after.approvalStatus, 'pending_approval')
    assert.isNull(after.rejectionReason)
  })

  test('V6: a non-numeric participant id is a validation error, not a 500', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const admin = await createUser({ roles: ['admin'] })
    const course = await createCourse(owner)

    const url = route('admin.courses.participants.add', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ userId: 'abc', courseRole: 'student' })
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    assert.isDefined(response.flashMessage('inputErrorsBag.userId'))
    assert.equal(await enrollmentCount(course.id), 0)
  })

  test('V6: an unknown participant id is a validation error, not a 500', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const admin = await createUser({ roles: ['admin'] })
    const course = await createCourse(owner)

    const url = route('admin.courses.participants.add', { id: course.id })
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({ userId: 987654321, courseRole: 'student' })
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    assert.isDefined(response.flashMessage('inputErrorsBag.userId'))
    assert.equal(await enrollmentCount(course.id), 0)
  })

  test('V7: admin settings persist tags (array) and categoryId', async ({
    client,
    route,
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const admin = await createUser({ roles: ['admin'] })
    const course = await createCourse(owner)
    const category = await createCategory()

    const url = route('admin.courses.settings.update', { id: course.id })
    const request = client.put(url).withCsrfToken()
    const response = await request
      .json({ title: 'Updated title', tags: ['a', 'b'], categoryId: category.id })
      .loginAs(admin)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isUndefined(response.flashMessage('inputErrorsBag'))
    assert.equal(response.flashMessage('success'), 'Course settings updated successfully')
    const after = await Course.findOrFail(course.id)
    assert.equal(after.title, 'Updated title')
    assert.deepEqual(after.tags, ['a', 'b'])
    assert.equal(after.categoryId, category.id)
  })

  test('create contract: a teacher creates a course with a categoryId', async ({
    client,
    route,
    assert,
  }) => {
    const teacher = await createUser({ roles: ['teacher'] })
    const category = await createCategory()
    const code = `V${Date.now() % 1_000_000_000}`

    const url = route('courses.store')
    const request = client.post(url).withCsrfToken()
    const response = await request
      .json({
        code,
        title: 'Course with a category',
        categoryId: category.id,
        tags: ['x', 'y'],
      })
      .loginAs(teacher)
      .redirects(0)

    response.assertStatus(302)
    assertNotCsrfRejected(assert, response)
    assert.isUndefined(response.flashMessage('inputErrorsBag'))
    const created = await Course.findByOrFail('code', code)
    assert.equal(created.categoryId, category.id)
    assert.deepEqual(created.tags, ['x', 'y'])
    assert.equal(created.instructorId, teacher.id)
  })

  test('V14: a malformed category filter is a validation error, not a 500', async ({
    client,
    route,
    assert,
  }) => {
    const user = await createUser({ roles: ['teacher'] })

    const response = await client
      .get(route('courses.index'))
      .qs({ category: 'abc' })
      .withInertia()
      .loginAs(user)
      .redirects(0)

    response.assertStatus(302)
    assert.isDefined(response.flashMessage('inputErrorsBag.category'))
  })

  test('V14: a numeric category filter lists only that category', async ({
    client,
    route,
    assert,
  }) => {
    const teacher = await createUser({ roles: ['teacher'] })
    const category = await createCategory()
    const inCategory = await createCourse(teacher)
    inCategory.categoryId = category.id
    await inCategory.save()
    const outside = await createCourse(teacher)
    const createdIds = [inCategory.id, outside.id]

    const response = await client
      .get(route('courses.index'))
      .qs({ category: String(category.id) })
      .withInertia()
      .loginAs(teacher)

    response.assertStatus(200)
    assert.deepEqual(listedIds(response.inertiaProps.courses, createdIds), [inCategory.id])
  })

  test('V14: the default empty filters of the listing page are accepted', async ({
    client,
    route,
    assert,
  }) => {
    const teacher = await createUser({ roles: ['teacher'] })
    const course = await createCourse(teacher)

    const response = await client
      .get(route('courses.index'))
      .qs({ search: '', status: '', category: '' })
      .withInertia()
      .loginAs(teacher)
      .redirects(0)

    response.assertStatus(200)
    assert.include(listedIds(response.inertiaProps.courses, [course.id]), course.id)
  })
})
