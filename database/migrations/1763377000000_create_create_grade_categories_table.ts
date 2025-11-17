import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'grade_categories'

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

      table.string('name', 255).notNullable() // e.g., "Assignments", "Quizzes", "Exams"
      table.text('description').nullable()
      table.decimal('weight', 5, 2).notNullable().defaultTo(0) // Percentage weight in final grade
      table.boolean('drop_lowest').defaultTo(false)
      table.integer('drop_lowest_count').unsigned().defaultTo(0)
      table.integer('position').unsigned().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
