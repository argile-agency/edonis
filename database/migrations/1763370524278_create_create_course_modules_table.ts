import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'course_modules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Course relationship
      table
        .integer('course_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('courses')
        .onDelete('CASCADE')

      // Hierarchical structure (for nested sections/subsections)
      table
        .integer('parent_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('course_modules')
        .onDelete('CASCADE')

      // Basic info
      table.string('title', 255).notNullable()
      table.text('description').nullable()

      // Ordering
      table.integer('order').unsigned().defaultTo(0)

      // Visibility & scheduling
      table.boolean('is_published').defaultTo(true)
      table.timestamp('available_from').nullable()
      table.timestamp('available_until').nullable()

      // Prerequisites
      table.boolean('require_previous_completion').defaultTo(false)

      // Metadata
      table.integer('estimated_time').unsigned().nullable().comment('Estimated time in minutes')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Indexes for performance
      table.index(['course_id', 'order'])
      table.index(['course_id', 'parent_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
