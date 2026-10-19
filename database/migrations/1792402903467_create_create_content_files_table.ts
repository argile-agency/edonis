import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Deduplicated file store for course content.
 *
 * Files are stored on disk outside the webroot (storage/content_files/) and
 * identified by their SHA-256 checksum. The UNIQUE constraint on `checksum`
 * is the source of truth for deduplication (it also guards against the
 * check-then-insert race between two concurrent uploads of the same file).
 */
export default class extends BaseSchema {
  protected tableName = 'content_files'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.string('filename', 255).notNullable().comment('Original client filename')
      table
        .string('storage_path', 500)
        .notNullable()
        .comment('Path relative to storage/content_files/')
      table.string('mime_type', 100).notNullable()
      table.bigInteger('size').unsigned().notNullable().comment('File size in bytes')
      // SHA-256 hex digest = 64 chars. The unique constraint also creates the index.
      table.string('checksum', 64).notNullable().unique()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
