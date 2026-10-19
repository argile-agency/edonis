import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pivot between course_contents and content_files.
 * A single deduplicated file may be referenced by many contents.
 */
export default class extends BaseSchema {
  protected tableName = 'content_content_files'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('course_content_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('course_contents')
        .onDelete('CASCADE')

      table
        .integer('content_file_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('content_files')
        .onDelete('CASCADE')

      table.primary(['course_content_id', 'content_file_id'])

      // Reverse lookup (file -> contents) used by download authorization
      table.index(['content_file_id'])

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
