import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import EnrollmentService from '#services/enrollment_service'

/**
 * node ace enrollment:recount [--dry-run]
 *
 * Recomputes courses.enrolled_count, course_enrollment_methods.current_enrollments
 * and course_groups.current_members from COUNT(*) of their source rows.
 *
 * Run with --dry-run first. Without it, every rewritten counter is audited as
 * `cli.enrollment.recount` (table, id, column, stored, actual).
 */
export default class EnrollmentRecount extends BaseCommand {
  static commandName = 'enrollment:recount'
  static description = 'Recompute enrolment counters from source rows'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Report differences without writing' })
  declare dryRun: boolean

  async run() {
    const dryRun = this.dryRun === true
    const diffs = await EnrollmentService.recount({ dryRun })

    for (const diff of diffs) {
      this.logger.info(`${diff.table}#${diff.id} ${diff.column} ${diff.stored}→${diff.actual}`)
    }

    if (diffs.length === 0) {
      this.logger.success('All enrolment counters match their source rows')
      return
    }

    if (dryRun) {
      this.logger.info(`${diffs.length} counter(s) differ (dry run, nothing written)`)
      return
    }

    this.logger.success(`${diffs.length} counter(s) recomputed`)
    this.logger.info(`audited ${diffs.length} change(s) as cli.enrollment.recount`)
  }
}
