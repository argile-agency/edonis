import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'course_enrollment_methods'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Course relationship
      table.integer('course_id').unsigned().notNullable()
      table.foreign('course_id').references('id').inTable('courses').onDelete('CASCADE')

      // Method type: 'manual', 'self', 'key', 'approval', 'bulk', 'cohort'
      table.string('method_type', 50).notNullable()

      // State
      table.boolean('is_enabled').defaultTo(true)
      table.integer('sort_order').defaultTo(0) // Priority order

      // Custom name for this instance
      table.string('name', 255).nullable() // Ex: "Inscription étudiants L1"

      // Enrollment limits
      table.integer('max_enrollments').unsigned().nullable() // NULL = unlimited
      table.integer('current_enrollments').defaultTo(0)

      // Default role assigned
      table.string('default_role', 50).defaultTo('student')
      // Values: 'instructor', 'teaching_assistant', 'non_editing_teacher', 'student', 'observer', 'guest'

      // Time window
      table.timestamp('enrollment_start_date').nullable()
      table.timestamp('enrollment_end_date').nullable()

      // Access duration (days, NULL = unlimited)
      table.integer('enrollment_duration_days').unsigned().nullable()

      // Configuration for method_type = 'key'
      table.string('enrollment_key', 100).nullable()
      table.boolean('key_case_sensitive').defaultTo(false)

      // Configuration for method_type = 'approval'
      table.boolean('requires_approval').defaultTo(false)
      table.text('approval_message').nullable()

      // Configuration for method_type = 'self'
      table.text('welcome_message').nullable()

      // Auto-assign to a group
      table.integer('auto_assign_group_id').unsigned().nullable()
      table
        .foreign('auto_assign_group_id')
        .references('id')
        .inTable('course_groups')
        .onDelete('SET NULL')

      // Notifications
      table.boolean('send_welcome_email').defaultTo(true)
      table.boolean('notify_instructor').defaultTo(false)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Indexes for performance
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['course_id', 'is_enabled'], 'idx_course_enabled')
      table.index(['course_id', 'sort_order'], 'idx_course_order')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
