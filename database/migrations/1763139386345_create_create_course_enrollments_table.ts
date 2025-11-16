import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'course_enrollments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Relations
      table.integer('course_id').unsigned().notNullable()
      table.foreign('course_id').references('id').inTable('courses').onDelete('CASCADE')

      table.integer('user_id').unsigned().notNullable()
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')

      table.integer('enrollment_method_id').unsigned().nullable()
      table
        .foreign('enrollment_method_id')
        .references('id')
        .inTable('course_enrollment_methods')
        .onDelete('SET NULL')

      // Course-specific role
      table.string('course_role', 50).notNullable().defaultTo('student')
      // Values: 'instructor', 'teaching_assistant', 'non_editing_teacher', 'student', 'observer', 'guest'

      // Enrollment status
      table.string('status', 50).notNullable().defaultTo('active')
      // Values: 'active', 'pending', 'suspended', 'completed', 'expired'

      // Access period
      table.timestamp('time_start').nullable() // Course access start
      table.timestamp('time_end').nullable() // Course access end

      // Progress tracking
      table.decimal('progress_percentage', 5, 2).defaultTo(0.0) // 0.00 to 100.00
      table.timestamp('last_access_at').nullable()
      table.timestamp('completed_at').nullable()

      // Audit trail
      table.timestamp('enrolled_at').notNullable().defaultTo(this.now())
      table.integer('enrolled_by').unsigned().nullable() // NULL if self-enrolled
      table.foreign('enrolled_by').references('id').inTable('users').onDelete('SET NULL')

      table.integer('modified_by').unsigned().nullable()
      table.foreign('modified_by').references('id').inTable('users').onDelete('SET NULL')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // One enrollment per user per course
      table.unique(['course_id', 'user_id'])
    })

    // Indexes for performance
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['course_id', 'status'], 'idx_course_status')
      table.index(['user_id', 'status'], 'idx_user_status')
      table.index(['course_id', 'course_role'], 'idx_course_role')
      table.index(['last_access_at'], 'idx_last_access')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
