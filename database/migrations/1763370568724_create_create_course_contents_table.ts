import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'course_contents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Module relationship
      table
        .integer('module_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('course_modules')
        .onDelete('CASCADE')

      // Content type: 'page', 'file', 'video', 'link', 'assignment', 'quiz'
      table
        .enum('content_type', ['page', 'file', 'video', 'link', 'assignment', 'quiz'])
        .notNullable()

      // Basic info
      table.string('title', 255).notNullable()
      table.text('description').nullable()

      // Content storage (flexible for different types)
      table.text('content').nullable().comment('HTML content for pages')
      table.string('file_url', 500).nullable().comment('URL for files/videos')
      table.string('file_name', 255).nullable()
      table.integer('file_size').unsigned().nullable().comment('File size in bytes')
      table.string('file_type', 100).nullable().comment('MIME type')
      table.string('external_url', 500).nullable().comment('External links')
      table.json('metadata').nullable().comment('Additional type-specific data')

      // Ordering
      table.integer('order').unsigned().defaultTo(0)

      // Visibility & scheduling
      table.boolean('is_published').defaultTo(true)
      table.timestamp('available_from').nullable()
      table.timestamp('available_until').nullable()

      // Completion settings
      table.boolean('completion_required').defaultTo(false).comment('Required to complete course')
      table
        .enum('completion_type', ['manual', 'view', 'submit', 'grade'])
        .defaultTo('manual')
        .comment('How completion is tracked')
      table
        .integer('min_time_required')
        .unsigned()
        .nullable()
        .comment('Minimum time in seconds before can mark complete')

      // Grading (for assignments/quizzes)
      table.decimal('max_points', 10, 2).nullable()
      table.timestamp('due_date').nullable()
      table.boolean('allow_late_submissions').defaultTo(false)
      table.integer('late_penalty_percent').unsigned().nullable()

      // Metadata
      table.integer('estimated_time').unsigned().nullable().comment('Estimated time in minutes')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Indexes for performance
      table.index(['module_id', 'order'])
      table.index(['content_type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
