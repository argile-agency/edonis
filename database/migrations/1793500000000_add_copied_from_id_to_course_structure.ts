import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * D-12: `copied_from_id` records which row a duplicate was copied from.
 */
export default class extends BaseSchema {
  // On SQLite knex adds a foreign key by rebuilding the table (copy, drop, rename) with
  // PRAGMA foreign_keys off, but SQLite ignores that pragma inside a transaction: dropping
  // the original course_modules would cascade-delete contents, sub-sections and progress.
  static disableTransactions = true

  async up() {
    this.schema.alterTable('course_modules', (t) => {
      t.integer('copied_from_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('course_modules')
        .onDelete('SET NULL')
      t.index(['copied_from_id'])
    })
    this.schema.alterTable('course_contents', (t) => {
      t.integer('copied_from_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('course_contents')
        .onDelete('SET NULL')
      t.index(['copied_from_id'])
    })
  }

  async down() {
    // Foreign key first: MySQL refuses to drop an index a foreign key relies on
    this.schema.alterTable('course_contents', (t) => {
      t.dropForeign(['copied_from_id'])
      t.dropIndex(['copied_from_id'])
      t.dropColumn('copied_from_id')
    })
    this.schema.alterTable('course_modules', (t) => {
      t.dropForeign(['copied_from_id'])
      t.dropIndex(['copied_from_id'])
      t.dropColumn('copied_from_id')
    })
  }
}
