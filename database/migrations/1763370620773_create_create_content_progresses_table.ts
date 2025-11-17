import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'content_progresses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Relationships
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('content_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('course_contents')
        .onDelete('CASCADE')

      // Progress tracking
      table.enum('status', ['not_started', 'in_progress', 'completed']).defaultTo('not_started')
      table.integer('time_spent').unsigned().defaultTo(0).comment('Time spent in seconds')

      // Timestamps
      table.timestamp('first_accessed_at').nullable()
      table.timestamp('last_accessed_at').nullable()
      table.timestamp('completed_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Unique constraint: one progress record per user per content
      table.unique(['user_id', 'content_id'])

      // Indexes for performance
      table.index(['user_id', 'status'])
      table.index(['content_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
