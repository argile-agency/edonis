import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'course_groupings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Course relationship
      table.integer('course_id').unsigned().notNullable()
      table.foreign('course_id').references('id').inTable('courses').onDelete('CASCADE')

      // Basic information
      table.string('name', 255).notNullable()
      table.text('description').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Index for performance
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['course_id'], 'idx_course_groupings')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
