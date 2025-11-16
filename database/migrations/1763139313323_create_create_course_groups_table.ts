import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'course_groups'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Course relationship
      table.integer('course_id').unsigned().notNullable()
      table.foreign('course_id').references('id').inTable('courses').onDelete('CASCADE')

      // Basic information
      table.string('name', 255).notNullable()
      table.text('description').nullable()

      // Grouping (parent grouping)
      table.integer('grouping_id').unsigned().nullable()
      table.foreign('grouping_id').references('id').inTable('course_groupings').onDelete('SET NULL')

      // Configuration
      table.integer('max_members').unsigned().nullable() // NULL = unlimited
      table.integer('current_members').defaultTo(0)

      // Visibility
      table.boolean('is_visible_to_students').defaultTo(true)

      // Messaging
      table.boolean('enable_group_messaging').defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Indexes for performance
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['course_id'], 'idx_course_groups')
      table.index(['grouping_id'], 'idx_grouping')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
