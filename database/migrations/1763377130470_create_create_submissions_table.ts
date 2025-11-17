import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'submissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('assignment_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('assignments')
        .onDelete('CASCADE')
      table
        .integer('student_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.integer('attempt_number').unsigned().defaultTo(1)

      // Submission content
      table.text('text_content').nullable() // For online text submissions
      table.json('file_attachments').nullable() // Array of file paths/URLs

      // Status and timing
      table.enum('status', ['draft', 'submitted', 'graded', 'returned']).defaultTo('draft')
      table.timestamp('submitted_at').nullable()
      table.boolean('is_late').defaultTo(false)

      // Grading
      table.decimal('grade', 5, 2).nullable()
      table.decimal('points_earned', 5, 2).nullable()
      table
        .integer('graded_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('graded_at').nullable()
      table.text('feedback').nullable()
      table.json('feedback_attachments').nullable()
      table.json('rubric_scores').nullable() // Scores for each rubric criterion

      // Metadata
      table.boolean('requires_grading').defaultTo(true)
      table.timestamp('last_modified_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Unique constraint for student + assignment + attempt
      table.unique(['assignment_id', 'student_id', 'attempt_number'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
