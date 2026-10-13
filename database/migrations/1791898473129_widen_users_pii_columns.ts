import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Widen `users.phone` and `users.mobile_phone` so they can hold AdonisJS
 * ciphertext (a 10-digit phone number encrypts to ~110 characters).
 *
 * Both columns were `varchar(20)`: PostgreSQL and strict MySQL/MariaDB reject
 * an encrypted phone number, and non-strict MySQL silently truncates it.
 * `string(512)` matches the existing `two_factor_secret` convention (TEXT
 * cannot carry defaults or plain indexes on MySQL).
 *
 * The rollback is GUARDED: narrowing back to `varchar(20)` would truncate (or,
 * on strict engines, fail midway on) every stored ciphertext, destroying PII
 * irrecoverably. `down()` therefore measures the longest stored value first and
 * refuses to run if any value is longer than 20 characters.
 *
 * SQLite: the ALTER is skipped in both directions. SQLite does not enforce
 * varchar length, so there is nothing to widen, and knex implements `.alter()`
 * there as a table rebuild (`DROP TABLE users` + rename). Lucid runs each
 * migration inside a transaction, where knex cannot switch `foreign_keys` off,
 * so that drop cascades and deletes every child row referencing `users`
 * (verified: a `social_accounts` row was wiped). The guard still runs on
 * SQLite so the rollback contract is identical on every engine.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  private isSqlite() {
    return ['sqlite3', 'better-sqlite3', 'libsql'].includes(this.db.dialect.name)
  }

  async up() {
    if (this.isSqlite()) {
      return
    }

    this.schema.alterTable(this.tableName, (table) => {
      table.string('phone', 512).nullable().alter()
      table.string('mobile_phone', 512).nullable().alter()
    })
  }

  async down() {
    this.defer(async (db) => {
      const row = await db
        .from(this.tableName)
        .select(
          db.raw('MAX(LENGTH(phone)) as max_phone'),
          db.raw('MAX(LENGTH(mobile_phone)) as max_mobile_phone')
        )
        .first()

      // Postgres returns aggregates as strings; an empty table yields null.
      const maxPhone = Number(row?.max_phone ?? 0)
      const maxMobilePhone = Number(row?.max_mobile_phone ?? 0)

      if (maxPhone > 20 || maxMobilePhone > 20) {
        throw new Error(
          'Refusing to roll back widen_users_pii_columns: users.phone / users.mobile_phone ' +
            `hold values longer than 20 characters (max phone=${maxPhone}, ` +
            `max mobile_phone=${maxMobilePhone}). These are encrypted values; narrowing the ` +
            'columns to varchar(20) would truncate the ciphertext and destroy the data.'
        )
      }
    })

    if (this.isSqlite()) {
      return
    }

    this.schema.alterTable(this.tableName, (table) => {
      table.string('phone', 20).nullable().alter()
      table.string('mobile_phone', 20).nullable().alter()
    })
  }
}
