import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * D-01 (Phase 5.2): soft-delete columns on sections and contents. A trashed row keeps
 * its data; `deleted_batch` groups every row one delete operation trashed (D-07).
 */
export default class extends BaseSchema {
  // On SQLite dropping a column in down() rebuilds the table (copy, drop, rename) with
  // PRAGMA foreign_keys off, but SQLite ignores that pragma inside a transaction: dropping
  // the original course_modules would cascade-delete contents, sub-sections and progress.
  static disableTransactions = true

  async up() {
    this.schema.alterTable('course_modules', (t) => {
      t.timestamp('deleted_at').nullable()
      t.string('deleted_batch', 36).nullable()
      // No foreign key: users are hard-deleted, the trash list LEFT JOINs
      t.integer('deleted_by_id').unsigned().nullable()
      t.index(['course_id', 'deleted_at'])
      t.index(['deleted_batch'])
    })
    this.schema.alterTable('course_contents', (t) => {
      t.timestamp('deleted_at').nullable()
      t.string('deleted_batch', 36).nullable()
      // No foreign key: users are hard-deleted, the trash list LEFT JOINs
      t.integer('deleted_by_id').unsigned().nullable()
      t.index(['module_id', 'deleted_at'])
      t.index(['deleted_batch'])
    })
  }

  async down() {
    this.schema.alterTable('course_contents', (t) => {
      t.dropIndex(['module_id', 'deleted_at'])
      t.dropIndex(['deleted_batch'])
      t.dropColumn('deleted_at')
      t.dropColumn('deleted_batch')
      t.dropColumn('deleted_by_id')
    })
    this.schema.alterTable('course_modules', (t) => {
      t.dropIndex(['course_id', 'deleted_at'])
      t.dropIndex(['deleted_batch'])
      t.dropColumn('deleted_at')
      t.dropColumn('deleted_batch')
      t.dropColumn('deleted_by_id')
    })
  }
}
