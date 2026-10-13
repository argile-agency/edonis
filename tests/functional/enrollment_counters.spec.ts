import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import AuditLog from '#models/audit_log'
import Course from '#models/course'
import CourseEnrollment from '#models/course_enrollment'
import CourseEnrollmentMethod from '#models/course_enrollment_method'
import CourseGroup from '#models/course_group'
import CourseGroupMember from '#models/course_group_member'
import EnrollmentService from '#services/enrollment_service'
import CapacityReachedException from '#exceptions/capacity_reached_exception'
import AlreadyEnrolledException from '#exceptions/already_enrolled_exception'
import { isUniqueViolation } from '../../app/helpers/db_errors.js'
import {
  createCourse,
  createEnrollmentMethod,
  createGroup,
  createUser,
  enrollUser,
} from '#tests/functional/helpers/factories'

/**
 * Enrolment counter invariants (DEBT-06).
 *
 * Concurrency cannot be demonstrated here: the suite runs on one connection,
 * serially, inside a global transaction. The race safety comes from the
 * single conditional `UPDATE ... WHERE max IS NULL OR current < max` plus the
 * affected-row check. This suite proves the invariants that construction
 * relies on, including the raw affected-row value on each CI engine.
 */

async function countRows(table: string, column: string, id: number): Promise<number> {
  const row = await db.from(table).where(column, id).count('* as total').first()
  return Number(row?.total ?? 0)
}

async function enrolledCount(courseId: number): Promise<number> {
  return Number((await Course.findOrFail(courseId)).enrolledCount)
}

async function currentEnrollments(methodId: number): Promise<number> {
  return Number((await CourseEnrollmentMethod.findOrFail(methodId)).currentEnrollments)
}

async function currentMembers(groupId: number): Promise<number> {
  return Number((await CourseGroup.findOrFail(groupId)).currentMembers)
}

async function captureError(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn()
  } catch (error) {
    return error
  }
  return null
}

async function setAutoAssignGroup(method: CourseEnrollmentMethod, group: CourseGroup) {
  method.autoAssignGroupId = group.id
  await method.save()
}

function enrollVia(course: Course, method: CourseEnrollmentMethod, userId: number) {
  return EnrollmentService.enroll({
    courseId: course.id,
    userId,
    methodId: method.id,
    courseRole: 'student',
    enrolledBy: null,
    groupId: method.autoAssignGroupId,
    addedBy: null,
  })
}

test.group('EnrollmentService - counter invariants', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a full method refuses the next enrolment and no counter moves', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const method = await createEnrollmentMethod(course, { maxEnrollments: 1 })
    const first = await createUser({ roles: ['student'] })
    const second = await createUser({ roles: ['student'] })

    await enrollVia(course, method, first.id)
    const error = await captureError(() => enrollVia(course, method, second.id))

    assert.instanceOf(error, CapacityReachedException)
    assert.equal(await currentEnrollments(method.id), 1)
    assert.equal(await enrolledCount(course.id), 1)
    assert.equal(await countRows('course_enrollments', 'course_id', course.id), 1)
  })

  test('the conditional increment reports raw affected rows (0 when full, 1 otherwise)', async ({
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const full = await createEnrollmentMethod(course, { maxEnrollments: 1 })
    const open = await createEnrollmentMethod(course, { maxEnrollments: 2 })
    await db.from('course_enrollment_methods').where('id', full.id).update({
      current_enrollments: 1,
    })

    const onFull = await db.transaction((trx) => EnrollmentService.tryIncrementMethod(trx, full.id))
    const onOpen = await db.transaction((trx) => EnrollmentService.tryIncrementMethod(trx, open.id))

    assert.strictEqual(onFull, 0)
    assert.strictEqual(onOpen, 1)
    assert.equal(await currentEnrollments(full.id), 1)
    assert.equal(await currentEnrollments(open.id), 1)
  })

  test('enrolling the same user twice raises AlreadyEnrolled and leaves counters unchanged', async ({
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const method = await createEnrollmentMethod(course, { maxEnrollments: null })
    const student = await createUser({ roles: ['student'] })

    await enrollVia(course, method, student.id)
    const error = await captureError(() => enrollVia(course, method, student.id))

    assert.instanceOf(error, AlreadyEnrolledException)
    assert.notInstanceOf(error, CapacityReachedException)
    assert.equal(await enrolledCount(course.id), 1)
    assert.equal(await currentEnrollments(method.id), 1)
    assert.equal(await countRows('course_enrollments', 'course_id', course.id), 1)
  })

  test('auto-assign skips a full group but still enrols the user', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const groupRow = await createGroup(course, { maxMembers: 1 })
    const method = await createEnrollmentMethod(course, { maxEnrollments: null })
    await setAutoAssignGroup(method, groupRow)
    const first = await createUser({ roles: ['student'] })
    const second = await createUser({ roles: ['student'] })

    await enrollVia(course, method, first.id)
    await enrollVia(course, method, second.id)

    assert.equal(await currentMembers(groupRow.id), 1)
    assert.equal(await countRows('course_group_members', 'group_id', groupRow.id), 1)
    const members = await CourseGroupMember.query().where('group_id', groupRow.id)
    assert.deepEqual(
      members.map((member) => member.userId),
      [first.id]
    )
    assert.equal(await enrolledCount(course.id), 2)
    assert.equal(await currentEnrollments(method.id), 2)
  })

  test('re-enrolling after unenrol does not collide with the kept group membership', async ({
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const groupRow = await createGroup(course, { maxMembers: null })
    const method = await createEnrollmentMethod(course, { maxEnrollments: null })
    await setAutoAssignGroup(method, groupRow)
    const student = await createUser({ roles: ['student'] })

    const enrollment = await enrollVia(course, method, student.id)
    await EnrollmentService.unenroll(enrollment)
    const again = await enrollVia(course, method, student.id)

    assert.isNotNull(await CourseEnrollment.find(again.id))
    assert.equal(await enrolledCount(course.id), 1)
    assert.equal(await currentEnrollments(method.id), 1)
    assert.equal(await currentMembers(groupRow.id), 1)
    assert.equal(await countRows('course_group_members', 'group_id', groupRow.id), 1)
  })

  test('unenrol decrements both the course and the method counter', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const method = await createEnrollmentMethod(course, { maxEnrollments: null })
    const students = await Promise.all([
      createUser({ roles: ['student'] }),
      createUser({ roles: ['student'] }),
      createUser({ roles: ['student'] }),
    ])

    const enrollments: CourseEnrollment[] = []
    for (const student of students) {
      enrollments.push(await enrollVia(course, method, student.id))
    }

    await EnrollmentService.unenroll(enrollments[0])

    assert.equal(await enrolledCount(course.id), 2)
    assert.equal(await currentEnrollments(method.id), 2)
    assert.equal(await countRows('course_enrollments', 'course_id', course.id), 2)
    assert.equal(await countRows('course_enrollments', 'enrollment_method_id', method.id), 2)
  })

  test('unenrol never drives a counter negative', async ({ assert }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const student = await createUser({ roles: ['student'] })
    const dangling = await enrollUser(course, student)

    assert.equal(await enrolledCount(course.id), 0)

    await EnrollmentService.unenroll(dangling)

    assert.equal(await enrolledCount(course.id), 0)
    assert.isNull(await CourseEnrollment.find(dangling.id))
  })

  test('recount reports drift on a dry run and repairs it with audit rows otherwise', async ({
    assert,
  }) => {
    const owner = await createUser({ roles: ['teacher'] })
    const course = await createCourse(owner)
    const groupRow = await createGroup(course, { maxMembers: null })
    const method = await createEnrollmentMethod(course, { maxEnrollments: null })
    await setAutoAssignGroup(method, groupRow)
    const first = await createUser({ roles: ['student'] })
    const second = await createUser({ roles: ['student'] })
    await enrollVia(course, method, first.id)
    await enrollVia(course, method, second.id)

    await db.from('courses').where('id', course.id).update({ enrolled_count: 35 })
    await db
      .from('course_enrollment_methods')
      .where('id', method.id)
      .update({ current_enrollments: 9 })
    await db.from('course_groups').where('id', groupRow.id).update({ current_members: 7 })

    const ours = (diff: { table: string; id: number }) =>
      (diff.table === 'courses' && diff.id === course.id) ||
      (diff.table === 'course_enrollment_methods' && diff.id === method.id) ||
      (diff.table === 'course_groups' && diff.id === groupRow.id)

    const auditRowsFor = async () => {
      const rows = await AuditLog.query().where('action', 'cli.enrollment.recount')
      return rows.filter((row) =>
        ours({ table: row.resourceType, id: Number(row.resourceId) })
      )
    }

    // Dry run: report only
    const dryDiffs = (await EnrollmentService.recount({ dryRun: true })).filter(ours)
    assert.lengthOf(dryDiffs, 3)
    assert.deepInclude(dryDiffs, {
      table: 'courses',
      id: course.id,
      column: 'enrolled_count',
      stored: 35,
      actual: 2,
    })
    assert.deepInclude(dryDiffs, {
      table: 'course_enrollment_methods',
      id: method.id,
      column: 'current_enrollments',
      stored: 9,
      actual: 2,
    })
    assert.deepInclude(dryDiffs, {
      table: 'course_groups',
      id: groupRow.id,
      column: 'current_members',
      stored: 7,
      actual: 2,
    })
    assert.equal(await enrolledCount(course.id), 35)
    assert.equal(await currentEnrollments(method.id), 9)
    assert.equal(await currentMembers(groupRow.id), 7)
    assert.lengthOf(await auditRowsFor(), 0)

    // Real run: repair and audit
    const diffs = (await EnrollmentService.recount({ dryRun: false })).filter(ours)
    assert.lengthOf(diffs, 3)
    assert.equal(
      await enrolledCount(course.id),
      await countRows('course_enrollments', 'course_id', course.id)
    )
    assert.equal(
      await currentEnrollments(method.id),
      await countRows('course_enrollments', 'enrollment_method_id', method.id)
    )
    assert.equal(
      await currentMembers(groupRow.id),
      await countRows('course_group_members', 'group_id', groupRow.id)
    )

    const audits = await auditRowsFor()
    assert.lengthOf(audits, 3)
    for (const audit of audits) {
      assert.isNull(audit.userId)
    }
    const byTable = new Map(audits.map((audit) => [audit.resourceType, audit.metadata]))
    assert.deepEqual(byTable.get('courses'), { column: 'enrolled_count', stored: 35, actual: 2 })
    assert.deepEqual(byTable.get('course_enrollment_methods'), {
      column: 'current_enrollments',
      stored: 9,
      actual: 2,
    })
    assert.deepEqual(byTable.get('course_groups'), {
      column: 'current_members',
      stored: 7,
      actual: 2,
    })
  })

  test('isUniqueViolation recognises pg, mysql and sqlite codes', ({ assert }) => {
    assert.isTrue(isUniqueViolation({ code: '23505' }))
    assert.isTrue(isUniqueViolation({ code: 'ER_DUP_ENTRY' }))
    assert.isTrue(isUniqueViolation({ code: 'SQLITE_CONSTRAINT_UNIQUE' }))
    assert.isTrue(
      isUniqueViolation({ code: 'SQLITE_CONSTRAINT', message: 'UNIQUE constraint failed: x.y' })
    )
    assert.isFalse(isUniqueViolation({ code: '23503' }))
    assert.isFalse(isUniqueViolation(null))
  })
})
