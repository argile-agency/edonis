import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'course_enrollment_requests'

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
        .onDelete('CASCADE')

      // Request status
      table.string('status', 50).notNullable().defaultTo('pending')
      // Values: 'pending', 'approved', 'rejected', 'cancelled'

      // Student's request message
      table.text('request_message').nullable()

      // Processing
      table.integer('processed_by').unsigned().nullable()
      table.foreign('processed_by').references('id').inTable('users').onDelete('SET NULL')

      table.timestamp('processed_at').nullable()
      table.text('response_message').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // One pending request per user per course
      table.unique(['course_id', 'user_id', 'status'], 'unique_pending_request')
    })

    // Indexes for performance
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['course_id', 'status'], 'idx_course_pending')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
