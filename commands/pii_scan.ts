import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import PiiScanService from '#services/pii_scan_service'

/**
 * node ace pii:scan [--fix] [--null-undecryptable]
 *
 * Classifies every non-empty encrypted PII cell on `users` as ok /
 * legacy-plaintext / undecryptable. Report-only unless a flag is passed.
 * Prints user ids, column names and counts only, never a cell value.
 */
export default class PiiScan extends BaseCommand {
  static commandName = 'pii:scan'
  static description = 'Scan users PII columns for plaintext or undecryptable values'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Re-encrypt legacy plaintext values' })
  declare fix: boolean

  @flags.boolean({ description: 'DATA LOSS: set undecryptable values to NULL' })
  declare nullUndecryptable: boolean

  async run() {
    const fix = this.fix === true
    const nullUndecryptable = this.nullUndecryptable === true

    if (nullUndecryptable) {
      this.logger.log(
        this.colors.red(
          'WARNING: --null-undecryptable permanently sets undecryptable PII values to NULL.'
        )
      )
    }

    const result = await PiiScanService.scan({ fix, nullUndecryptable })

    this.logger.info(
      `ok=${result.counts.ok} legacy-plaintext=${result.counts['legacy-plaintext']} ` +
        `undecryptable=${result.counts.undecryptable} empty=${result.counts.empty}`
    )

    for (const row of result.rows) {
      if (row.classification !== 'ok') {
        this.logger.log(`user_id=${row.userId} column=${row.column} ${row.classification}`)
      }
    }

    if (result.changed > 0) {
      this.logger.success(`audited ${result.changed} change(s) as cli.pii.*`)
    }

    if (result.counts['legacy-plaintext'] > 0 && !fix) {
      this.logger.warning('legacy plaintext found: re-run with --fix to re-encrypt it')
    }

    const remainingUndecryptable = nullUndecryptable ? 0 : result.counts.undecryptable
    if (remainingUndecryptable > 0) {
      this.logger.error(`${remainingUndecryptable} undecryptable value(s) remain`)
      this.exitCode = 1
    }
  }
}
