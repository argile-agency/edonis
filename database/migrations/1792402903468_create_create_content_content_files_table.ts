import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pivot between course_contents and content_files.
 * A single deduplicated file may be referenced by many contents, each with
 * its own filename and MIME type.
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

      // Per-attachment metadata: the deduplicated blob is shared, but each
      // content keeps the name and type it was uploaded with.
      table.string('filename', 255).notNullable().comment('Original client filename')
      table.string('mime_type', 100).notNullable()

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
