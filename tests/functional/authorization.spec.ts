import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { Bouncer } from '@adonisjs/bouncer'
import { policies } from '#policies/main'
import * as abilities from '#abilities/main'
import Course from '#models/course'
import User from '#models/user'
import CourseEnrollment from '#models/course_enrollment'
import { scopeVisibleCourses } from '#policies/course_policy'
import {
  createCourse,
  createUser,
  enrollUser,
  grantPermission,
} from '#tests/functional/helpers/factories'

/**
 * Policy decision matrix. Exercises the policies directly (no HTTP) so every
 * rule is locked before controllers migrate onto them.
 */
function bouncerFor(user: User) {
  return new Bouncer(user, abilities, policies)
}

function coursePolicy(user: User) {
  return bouncerFor(user).with('CoursePolicy')
}

test.group('CoursePolicy / EnrollmentPolicy - decision matrix', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('edit: owner and edit-permission holders, plus admin', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const editor = await createUser({ roles: ['teacher'] })
    const viewer = await createUser({ roles: ['teacher'] })
    const unrelated = await createUser({ roles: ['teacher'] })
    const admin = await createUser({ roles: ['admin'] })
    await grantPermission(course, editor, 'edit')
    await grantPermission(course, viewer, 'view')

    assert.isTrue(await coursePolicy(owner).allows('edit', course))
    assert.isTrue(await coursePolicy(editor).allows('edit', course))
    assert.isFalse(await coursePolicy(viewer).allows('edit', course))
    assert.isFalse(await coursePolicy(unrelated).allows('edit', course))
    assert.isTrue(await coursePolicy(admin).allows('edit', course))
  })

  test('manage: owner and manage-permission holders, plus admin', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const manager = await createUser({ roles: ['teacher'] })
    const editor = await createUser({ roles: ['teacher'] })
    const admin = await createUser({ roles: ['admin'] })
    await grantPermission(course, manager, 'manage')
    await grantPermission(course, editor, 'edit')

    assert.isTrue(await coursePolicy(owner).allows('manage', course))
    assert.isTrue(await coursePolicy(manager).allows('manage', course))
    assert.isFalse(await coursePolicy(editor).allows('manage', course))
    assert.isTrue(await coursePolicy(admin).allows('manage', course))
  })

  test('delete: owner only, plus admin', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const manager = await createUser({ roles: ['teacher'] })
    const admin = await createUser({ roles: ['admin'] })
    await grantPermission(course, manager, 'manage')

    assert.isTrue(await coursePolicy(owner).allows('delete', course))
    assert.isFalse(await coursePolicy(manager).allows('delete', course))
    assert.isTrue(await coursePolicy(admin).allows('delete', course))
  })

  test('view: public courses, view-permission holders, plus admin', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const privateCourse = await createCourse(owner, { visibility: 'private' })
    const publicCourse = await createCourse(owner, { visibility: 'public' })
    const unrelated = await createUser({ roles: ['student'] })
    const viewer = await createUser({ roles: ['teacher'] })
    const admin = await createUser({ roles: ['admin'] })
    await grantPermission(privateCourse, viewer, 'view')

    assert.isFalse(await coursePolicy(unrelated).allows('view', privateCourse))
    assert.isTrue(await coursePolicy(unrelated).allows('view', publicCourse))
    assert.isTrue(await coursePolicy(viewer).allows('view', privateCourse))
    assert.isTrue(await coursePolicy(admin).allows('view', privateCourse))
  })

  test('administer: admin only', async ({ assert }) => {
    const admin = await createUser({ roles: ['admin'] })
    const teacher = await createUser({ roles: ['teacher'] })

    assert.isTrue(await coursePolicy(admin).allows('administer'))
    assert.isFalse(await coursePolicy(teacher).allows('administer'))
  })

  test('learn: enrolled users and admin; a non-enrolled owner is denied', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const enrolled = await createUser({ roles: ['student'] })
    const outsider = await createUser({ roles: ['student'] })
    const admin = await createUser({ roles: ['admin'] })
    await enrollUser(course, enrolled)

    assert.isTrue(await coursePolicy(enrolled).allows('learn', course))
    assert.isFalse(await coursePolicy(outsider).allows('learn', course))
    assert.isTrue(await coursePolicy(admin).allows('learn', course))
    assert.isFalse(await coursePolicy(owner).allows('learn', course))
  })

  test('viewGradebook: owner and enrolled users; admin is NOT bypassed', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const enrolled = await createUser({ roles: ['student'] })
    const outsider = await createUser({ roles: ['student'] })
    const admin = await createUser({ roles: ['admin'] })
    await enrollUser(course, enrolled)

    assert.isTrue(await coursePolicy(owner).allows('viewGradebook', course))
    assert.isTrue(await coursePolicy(enrolled).allows('viewGradebook', course))
    assert.isFalse(await coursePolicy(outsider).allows('viewGradebook', course))
    // AS2 has not shipped: an admin who neither owns nor is enrolled is denied.
    assert.isFalse(await coursePolicy(admin).allows('viewGradebook', course))
  })

  test('viewGradebookAsInstructor: owner only; admin is NOT bypassed', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const enrolled = await createUser({ roles: ['student'] })
    const admin = await createUser({ roles: ['admin'] })
    await enrollUser(course, enrolled)

    assert.isTrue(await coursePolicy(owner).allows('viewGradebookAsInstructor', course))
    assert.isFalse(await coursePolicy(enrolled).allows('viewGradebookAsInstructor', course))
    assert.isFalse(await coursePolicy(admin).allows('viewGradebookAsInstructor', course))
  })

  test('enroll: follows Course.canEnroll()', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const published = await createCourse(owner, { status: 'published', allowEnrollment: true })
    const draft = await createCourse(owner, { status: 'draft', allowEnrollment: true })
    const student = await createUser({ roles: ['student'] })

    assert.isTrue(await coursePolicy(student).allows('enroll', published))
    assert.isFalse(await coursePolicy(student).allows('enroll', draft))
  })

  test('EnrollmentPolicy.unenroll: self, manage holders and admin', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const student = await createUser({ roles: ['student'] })
    const manager = await createUser({ roles: ['teacher'] })
    const unrelated = await createUser({ roles: ['student'] })
    const admin = await createUser({ roles: ['admin'] })
    await grantPermission(course, manager, 'manage')
    const created = await enrollUser(course, student)

    const enrollment = await CourseEnrollment.query()
      .where('id', created.id)
      .preload('course')
      .firstOrFail()

    const policy = (user: User) => bouncerFor(user).with('EnrollmentPolicy')
    assert.isTrue(await policy(student).allows('unenroll', enrollment))
    assert.isTrue(await policy(manager).allows('unenroll', enrollment))
    assert.isFalse(await policy(unrelated).allows('unenroll', enrollment))
    assert.isTrue(await policy(admin).allows('unenroll', enrollment))
  })

  test('scopeVisibleCourses: listing scope per role', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const teacher = await createUser({ roles: ['teacher'] })
    const student = await createUser({ roles: ['student'] })
    const admin = await createUser({ roles: ['admin'] })

    const publicCourse = await createCourse(owner, { status: 'published', visibility: 'public' })
    const teacherOwned = await createCourse(teacher, { status: 'draft', visibility: 'private' })
    const sharedPrivate = await createCourse(owner, { status: 'draft', visibility: 'private' })
    const unrelatedPrivate = await createCourse(owner, { status: 'draft', visibility: 'private' })
    await grantPermission(sharedPrivate, teacher, 'edit')

    const createdIds = [publicCourse.id, teacherOwned.id, sharedPrivate.id, unrelatedPrivate.id]

    const visibleIds = async (user: User) => {
      const query = Course.query()
      await scopeVisibleCourses(query, user)
      const rows = await query.whereIn('id', createdIds)
      return rows.map((course) => course.id).sort((a, b) => a - b)
    }

    assert.deepEqual(await visibleIds(student), [publicCourse.id])
    assert.deepEqual(
      await visibleIds(teacher),
      [teacherOwned.id, sharedPrivate.id].sort((a, b) => a - b)
    )
    assert.notInclude(await visibleIds(teacher), unrelatedPrivate.id)
    assert.deepEqual(
      await visibleIds(admin),
      [...createdIds].sort((a, b) => a - b)
    )
  })

  test('scopeVisibleCourses: the teacher OR branch is grouped', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const teacher = await createUser({ roles: ['teacher'] })

    const ownedDraft = await createCourse(teacher, { status: 'draft' })
    const ownedPublished = await createCourse(teacher, { status: 'published' })
    const sharedPublished = await createCourse(owner, { status: 'published' })
    await grantPermission(sharedPublished, teacher, 'edit')

    const query = Course.query()
    await scopeVisibleCourses(query, teacher)
    const rows = await query
      .where('status', 'draft')
      .whereIn('id', [ownedDraft.id, ownedPublished.id, sharedPublished.id])
    const ids = rows.map((course) => course.id)

    // An ungrouped `instructor_id = ? OR (permission AND status = 'draft')`
    // would wrongly return the teacher's own published course.
    assert.deepEqual(ids, [ownedDraft.id])
    assert.notInclude(ids, ownedPublished.id)
    assert.notInclude(ids, sharedPublished.id)
  })
})
