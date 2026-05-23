import { BaseSchema } from '@adonisjs/lucid/schema'
import { jsonColumn, getClient } from '../../database/helpers/schema_helpers.js'

export default class extends BaseSchema {
  protected tableName = 'courses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Basic information
      table.string('code', 20).notNullable().unique() // e.g., CS101
      table.string('title', 255).notNullable()
      table.text('description').nullable()
      table.text('objectives').nullable() // Learning objectives

      // Instructor/Owner
      table.integer('instructor_id').unsigned().notNullable()
      table.foreign('instructor_id').references('id').inTable('users').onDelete('RESTRICT')

      // Course settings
      table.enum('status', ['draft', 'published', 'archived']).defaultTo('draft')
      table.enum('visibility', ['public', 'private', 'unlisted']).defaultTo('private')
      table.integer('max_students').unsigned().nullable() // null = unlimited
      table.boolean('allow_enrollment').defaultTo(true)
      table.boolean('is_featured').defaultTo(false)

      // Scheduling
      table.date('start_date').nullable()
      table.date('end_date').nullable()

      // Media
      table.string('thumbnail_url').nullable()
      table.string('cover_image_url').nullable()

      // Metadata
      table.string('category').nullable() // e.g., "Computer Science", "Mathematics"
      table.string('level').nullable() // e.g., "Beginner", "Intermediate", "Advanced"
      table.string('language', 10).defaultTo('fr') // ISO 639-1 code
      table.integer('estimated_hours').unsigned().nullable()
      jsonColumn(table, 'tags').nullable() // Array of tags for searchability

      // Statistics (denormalized for performance)
      table.integer('enrolled_count').unsigned().defaultTo(0)
      table.integer('completed_count').unsigned().defaultTo(0)
      table.decimal('average_rating', 3, 2).nullable() // 0.00 to 5.00

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('published_at').nullable()
      table.timestamp('archived_at').nullable()
    })

    // Create full-text search index (engine-specific)
    const client = getClient(this.schema)
    if (client === 'pg') {
      this.schema.raw(`
        CREATE INDEX idx_courses_search ON courses USING gin(to_tsvector('french', title || ' ' || COALESCE(description, '')))
      `)
    } else if (client === 'mysql2') {
      this.schema.raw('ALTER TABLE courses ADD FULLTEXT idx_courses_search (title, description)')
    }
    // SQLite: no full-text index needed, LIKE-based search works at small scale
  }

  async down() {
    const client = getClient(this.schema)
    if (client === 'pg') {
      this.schema.raw('DROP INDEX IF EXISTS idx_courses_search')
    } else if (client === 'mysql2') {
      this.schema.raw('ALTER TABLE courses DROP INDEX idx_courses_search')
    }
    this.schema.dropTable(this.tableName)
  }
}
