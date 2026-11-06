import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import TrashPurgeService from '#services/trash_purge_service'

/**
 * node ace trash:purge [--dry-run]
 *
 * Physically deletes trashed sections and contents older than the retention
 * setting, for every course. Meant for a nightly cron; opening a course's trash
 * page purges that course anyway (D-12). Each purged course is audited as
 * `course.trash.purge`.
 */
export default class TrashPurge extends BaseCommand {
  static commandName = 'trash:purge'
  static description = 'Purge expired trash items (sections and contents)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Report what would be purged without deleting' })
  declare dryRun: boolean

  async run() {
    const dryRun = this.dryRun === true
    const reports = await TrashPurgeService.purgeExpired({ trigger: 'cli', dryRun })

    let failed = false
    for (const report of reports) {
      if (report.error) {
        failed = true
        this.logger.error(`course ${report.courseId}: ${report.error}`)
        continue
      }
      this.logger.info(
        `course ${report.courseId}: ${report.sectionIds.length} section(s), ${report.contentIds.length} content(s), ${report.fileIds.length} file(s)`
      )
    }

    if (failed) this.exitCode = 1
    const purged = reports.filter((report) => !report.error).length
    this.logger.success(
      dryRun
        ? `${purged} course(s) with expired items (dry run, nothing deleted)`
        : `${purged} course(s) purged`
    )
  }
}
