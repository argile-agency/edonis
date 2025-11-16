import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'course_permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.integer('course_id').unsigned().notNullable()
      table.foreign('course_id').references('id').inTable('courses').onDelete('CASCADE')

      table.integer('user_id').unsigned().notNullable()
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')

      // Permission level: 'view', 'edit', 'manage' (manage = can add other instructors)
      table.enum('permission_level', ['view', 'edit', 'manage']).defaultTo('edit')

      // For co-instructors, TAs, etc.
      table.string('role_in_course').nullable() // e.g., 'Co-Instructor', 'Teaching Assistant'

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Ensure a user can only have one permission level per course
      table.unique(['course_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
