import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import EncryptionService from '#services/encryption_service'
import AuditService from '#services/audit_service'

/**
 * Encrypted PII columns on `users` (see `app/models/user.ts`).
 */
export const PII_COLUMNS = ['phone', 'mobile_phone', 'address', 'identification_number'] as const

export type PiiColumn = (typeof PII_COLUMNS)[number]

export type PiiClassification = 'empty' | 'ok' | 'legacy-plaintext' | 'undecryptable'

export interface PiiScanRow {
  userId: number
  column: PiiColumn
  classification: PiiClassification
}

export interface PiiScanResult {
  rows: PiiScanRow[]
  counts: Record<PiiClassification, number>
  /** Number of cells actually written (re-encrypted or nulled) */
  changed: number
}

export interface PiiScanOptions {
  /** Re-encrypt legacy-plaintext cells. Default: false (report only). */
  fix?: boolean
  /** DATA LOSS: set undecryptable cells to NULL. Default: false. */
  nullUndecryptable?: boolean
}

type PiiAuditAction = 'cli.pii.reencrypt' | 'cli.pii.null_undecryptable'

/**
 * AdonisJS ciphertext is `<b64url>.<b64url>.<b64url>`. Checking the character
 * set as well as the part count keeps plaintext such as `12 rue St. Paul. Paris`
 * classified as legacy plaintext rather than undecryptable.
 */
const CIPHERTEXT_PART = /^[A-Za-z0-9_-]+$/

function isCiphertextShaped(value: string): boolean {
  const parts = value.split('.')
  return parts.length === 3 && parts.every((part) => CIPHERTEXT_PART.test(part))
}

/**
 * Classify a raw (as stored) PII cell value. Never returns or logs the value.
 *
 * Uses `encryption.decrypt` directly (not `EncryptionService.decrypt`) because
 * only the raw `null` return distinguishes an undecryptable cell (wrong or
 * rotated APP_KEY, truncated ciphertext) from a valid one.
 */
export function classifyPiiValue(raw: unknown): PiiClassification {
  if (raw === null || raw === undefined || raw === '') {
    return 'empty'
  }

  if (typeof raw !== 'string' || !isCiphertextShaped(raw)) {
    return 'legacy-plaintext'
  }

  return encryption.decrypt(raw) === null ? 'undecryptable' : 'ok'
}

/**
 * Scans the encrypted PII columns of `users` and optionally repairs them.
 *
 * Report-only by default. Mutations (`fix`, `nullUndecryptable`) are audited
 * as `cli.*` actions because the scan is only invoked from the `pii:scan` ace
 * command. No cell value is ever logged, returned or written to an audit row:
 * only the user id, column and classification.
 */
export default class PiiScanService {
  static async scan(opts: PiiScanOptions = {}): Promise<PiiScanResult> {
    const fix = opts.fix === true
    const nullUndecryptable = opts.nullUndecryptable === true

    // Raw reads: the User model's `consume` hooks would mask the stored values.
    const users = await db
      .from('users')
      .select('id', ...PII_COLUMNS)
      .orderBy('id')

    const rows: PiiScanRow[] = []
    const counts: Record<PiiClassification, number> = {
      'empty': 0,
      'ok': 0,
      'legacy-plaintext': 0,
      'undecryptable': 0,
    }
    const writes: Array<{
      userId: number
      column: PiiColumn
      classification: PiiClassification
      action: PiiAuditAction
      value: string | null
    }> = []

    for (const user of users) {
      for (const column of PII_COLUMNS) {
        const raw = user[column]
        const classification = classifyPiiValue(raw)
        counts[classification]++

        if (classification === 'empty') {
          continue
        }

        rows.push({ userId: user.id, column, classification })

        if (fix && classification === 'legacy-plaintext') {
          writes.push({
            userId: user.id,
            column,
            classification,
            action: 'cli.pii.reencrypt',
            value: EncryptionService.encrypt(String(raw)),
          })
        } else if (nullUndecryptable && classification === 'undecryptable') {
          writes.push({
            userId: user.id,
            column,
            classification,
            action: 'cli.pii.null_undecryptable',
            value: null,
          })
        }
      }
    }

    if (writes.length > 0) {
      await db.transaction(async (trx) => {
        for (const write of writes) {
          await trx
            .from('users')
            .where('id', write.userId)
            .update({ [write.column]: write.value })
        }
      })

      // Audit only after the transaction has committed, so an audit row always
      // means the change happened (and no second connection is needed while
      // the transaction holds the single SQLite connection).
      for (const write of writes) {
        await AuditService.log({
          userId: null,
          action: write.action,
          resourceType: 'User',
          resourceId: write.userId,
          metadata: { column: write.column, classification: write.classification },
        })
      }
    }

    return { rows, counts, changed: writes.length }
  }
}
