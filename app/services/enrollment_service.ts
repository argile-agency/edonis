import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import Course from '#models/course'
import CourseEnrollment, { type CourseRole } from '#models/course_enrollment'
import CourseEnrollmentMethod from '#models/course_enrollment_method'
import CourseGroup from '#models/course_group'
import CourseGroupMember from '#models/course_group_member'
import AuditService from '#services/audit_service'
import CapacityReachedException from '#exceptions/capacity_reached_exception'
import AlreadyEnrolledException from '#exceptions/already_enrolled_exception'
import { isUniqueViolation } from '../helpers/db_errors.js'

export interface EnrollOptions {
  courseId: number
  userId: number
  methodId?: number | null
  courseRole: CourseRole
  enrolledBy: number | null
  timeStart?: DateTime
  timeEnd?: DateTime | null
  groupId?: number | null
  addedBy?: number | null
}

export interface RecountDiff {
  table: string
  id: number
  column: string
  stored: number
  actual: number
}

/**
 * Owns every enrolment counter mutation:
 * `courses.enrolled_count`, `course_enrollment_methods.current_enrollments`
 * and `course_groups.current_members`.
 *
 * Counters move only through single conditional `UPDATE ... SET x = x + 1`
 * statements inside `db.transaction()`. The capacity check and the increment
 * are the same statement, so two concurrent enrolments cannot both take the
 * last seat, on every supported engine (no row locks are needed, which matters
 * because SQLite has none). The `unique(course_id, user_id)` constraint is the
 * duplicate guard.
 */
export default class EnrollmentService {
  /**
   * Takes one seat on the method when it has capacity. Returns the raw
   * affected-row count: 1 when a seat was taken, 0 when the method is full
   * (or does not exist).
   */
  static async tryIncrementMethod(client: QueryClientContract, methodId: number): Promise<number> {
    const [affected] = await CourseEnrollmentMethod.query({ client })
      .where('id', methodId)
      .where((query) => {
        query.whereNull('max_enrollments').orWhereRaw('current_enrollments < max_enrollments')
      })
      .increment('current_enrollments', 1)

    return affected
  }

  /**
   * Takes one place in the group when it has room. Same contract as
   * `tryIncrementMethod`.
   */
  static async tryIncrementGroup(client: QueryClientContract, groupId: number): Promise<number> {
    const [affected] = await CourseGroup.query({ client })
      .where('id', groupId)
      .where((query) => {
        query.whereNull('max_members').orWhereRaw('current_members < max_members')
      })
      .increment('current_members', 1)

    return affected
  }

  /**
   * Enrols a user in one transaction:
   * 1. takes a seat on the method (throws `CapacityReachedException` when full)
   * 2. inserts the enrolment row
   * 3. increments the course counter
   * 4. when a group is given and has room, adds the membership; a full group
   *    (or an existing membership) is skipped and never fails the enrolment
   *
   * A duplicate enrolment is detected from the unique-constraint error. The
   * catch sits outside the transaction callback because PostgreSQL aborts the
   * transaction on a constraint violation; the managed transaction has rolled
   * back (including the method seat) by the time the catch runs.
   */
  static async enroll(opts: EnrollOptions): Promise<CourseEnrollment> {
    try {
      return await db.transaction(async (trx) => {
        if (opts.methodId) {
          const seat = await this.tryIncrementMethod(trx, opts.methodId)
          if (Number(seat) < 1) {
            throw new CapacityReachedException()
          }
        }

        const now = DateTime.now()

        const enrollment = await CourseEnrollment.create(
          {
            courseId: opts.courseId,
            userId: opts.userId,
            enrollmentMethodId: opts.methodId ?? null,
            courseRole: opts.courseRole,
            status: 'active',
            timeStart: opts.timeStart ?? now,
            timeEnd: opts.timeEnd ?? null,
            enrolledAt: now,
            enrolledBy: opts.enrolledBy,
          },
          { client: trx }
        )

        await Course.query({ client: trx })
          .where('id', opts.courseId)
          .increment('enrolled_count', 1)

        if (opts.groupId) {
          await this.addToGroupIfRoom(trx, opts.groupId, opts.userId, opts.addedBy ?? null, now)
        }

        return enrollment
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AlreadyEnrolledException()
      }
      throw error
    }
  }

  /**
   * Group step of `enroll`. Unenrolment keeps group memberships (see
   * `unenroll`), so a user who re-enrols may already be a member: skip both
   * the counter and the insert in that case instead of hitting
   * `unique(group_id, user_id)`, which would abort the whole enrolment.
   */
  private static async addToGroupIfRoom(
    client: QueryClientContract,
    groupId: number,
    userId: number,
    addedBy: number | null,
    joinedAt: DateTime
  ): Promise<void> {
    const existing = await CourseGroupMember.query({ client })
      .where('group_id', groupId)
      .where('user_id', userId)
      .first()

    if (existing) {
      return
    }

    const place = await this.tryIncrementGroup(client, groupId)
    if (Number(place) < 1) {
      return
    }

    await CourseGroupMember.create({ groupId, userId, joinedAt, addedBy }, { client })
  }

  /**
   * Deletes the enrolment and decrements the course and method counters in
   * one transaction. Decrements are guarded with `> 0`, so a drifted counter
   * never goes negative, and they only run when this call actually deleted
   * the row (a concurrent double unenrol decrements once).
   *
   * Group memberships and `course_groups.current_members` are deliberately
   * left untouched: removing memberships on unenrol is AS5 (plan 02-14,
   * behind a checkpoint).
   */
  static async unenroll(enrollment: CourseEnrollment): Promise<void> {
    await db.transaction(async (trx) => {
      const deleted = await CourseEnrollment.query({ client: trx })
        .where('id', enrollment.id)
        .delete()

      if (Number(deleted[0]) < 1) {
        return
      }

      await Course.query({ client: trx })
        .where('id', enrollment.courseId)
        .where('enrolled_count', '>', 0)
        .decrement('enrolled_count', 1)

      if (enrollment.enrollmentMethodId) {
        await CourseEnrollmentMethod.query({ client: trx })
          .where('id', enrollment.enrollmentMethodId)
          .where('current_enrollments', '>', 0)
          .decrement('current_enrollments', 1)
      }
    })
  }

  /**
   * Recomputes the three counters from `COUNT(*)` of their source rows.
   *
   * Invoked only by the `enrollment:recount` ace command, hence the `cli.*`
   * audit action and the null acting user.
   *
   * A dry run only reports. Otherwise the updates run in one transaction and,
   * once it has committed, every rewritten counter gets one
   * `cli.enrollment.recount` audit row (table, id, column, stored, actual).
   */
  static async recount(opts: { dryRun: boolean }): Promise<RecountDiff[]> {
    const diffs = [
      ...(await this.diffCounter('courses', 'enrolled_count', 'course_enrollments', 'course_id')),
      ...(await this.diffCounter(
        'course_enrollment_methods',
        'current_enrollments',
        'course_enrollments',
        'enrollment_method_id'
      )),
      ...(await this.diffCounter(
        'course_groups',
        'current_members',
        'course_group_members',
        'group_id'
      )),
    ]

    if (opts.dryRun || diffs.length === 0) {
      return diffs
    }

    await db.transaction(async (trx) => {
      for (const diff of diffs) {
        await trx
          .from(diff.table)
          .where('id', diff.id)
          .update({ [diff.column]: diff.actual })
      }
    })

    // After commit: an audit row always describes a committed change.
    for (const diff of diffs) {
      await AuditService.log({
        userId: null,
        action: 'cli.enrollment.recount',
        resourceType: diff.table,
        resourceId: diff.id,
        metadata: { column: diff.column, stored: diff.stored, actual: diff.actual },
      })
    }

    return diffs
  }

  /**
   * Compares `table.column` with the number of `sourceTable` rows pointing at
   * each row through `foreignKey`. Rows with no source rows count as 0.
   */
  private static async diffCounter(
    table: string,
    column: string,
    sourceTable: string,
    foreignKey: string
  ): Promise<RecountDiff[]> {
    const counts: Array<Record<string, unknown>> = await db
      .from(sourceTable)
      .select(foreignKey)
      .count('* as total')
      .whereNotNull(foreignKey)
      .groupBy(foreignKey)

    const actualById = new Map<number, number>(
      counts.map((row) => [Number(row[foreignKey]), Number(row.total)])
    )

    const rows: Array<Record<string, unknown>> = await db
      .from(table)
      .select('id', column)
      .orderBy('id', 'asc')

    return rows
      .map((row) => {
        const id = Number(row.id)
        return {
          table,
          id,
          column,
          stored: Number(row[column] ?? 0),
          actual: actualById.get(id) ?? 0,
        }
      })
      .filter((diff) => diff.stored !== diff.actual)
  }
}
