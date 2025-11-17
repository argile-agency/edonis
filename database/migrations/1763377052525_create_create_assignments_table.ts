import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'assignments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('course_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('courses')
        .onDelete('CASCADE')
      table
        .integer('module_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('course_modules')
        .onDelete('SET NULL')
      table.string('title', 255).notNullable()
      table.text('description').nullable()
      table.text('instructions').nullable()

      // Assignment settings
      table
        .enum('assignment_type', ['essay', 'file_upload', 'online_text', 'offline'])
        .defaultTo('file_upload')
      table.integer('max_points').unsigned().notNullable().defaultTo(100)
      table.integer('max_file_size').unsigned().nullable() // in MB
      table.string('allowed_file_types', 500).nullable() // comma-separated: pdf,doc,docx
      table.integer('max_files').unsigned().defaultTo(1)

      // Timing
      table.timestamp('available_from').nullable()
      table.timestamp('due_date').nullable()
      table.timestamp('cut_off_date').nullable() // Hard deadline

      // Grading
      table
        .integer('grade_category_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('grade_categories')
        .onDelete('SET NULL')
      table.boolean('use_rubric').defaultTo(false)
      table.json('rubric_data').nullable() // Store rubric criteria as JSON
      table
        .enum('grading_type', ['points', 'percentage', 'letter', 'pass_fail'])
        .defaultTo('points')
      table.decimal('passing_grade', 5, 2).nullable()

      // Submission settings
      table.boolean('allow_late_submissions').defaultTo(true)
      table.decimal('late_penalty_percent', 5, 2).nullable() // Percentage deduction per day
      table.integer('max_attempts').unsigned().defaultTo(1)
      table.boolean('require_submission_statement').defaultTo(false)

      // Visibility
      table.boolean('is_published').defaultTo(false)
      table.integer('position').unsigned().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
