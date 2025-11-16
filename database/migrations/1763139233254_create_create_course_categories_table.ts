import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'course_categories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Basic information
      table.string('name', 255).notNullable()
      table.string('slug', 255).notNullable().unique()
      table.text('description').nullable()

      // Hierarchy
      table.integer('parent_id').unsigned().nullable()
      table.foreign('parent_id').references('id').inTable('course_categories').onDelete('CASCADE')
      table.integer('sort_order').defaultTo(0)
      table.integer('depth').defaultTo(0) // Calculated automatically
      table.string('path', 500).nullable() // Ex: "/sciences/informatique/programmation"

      // Visibility
      table.boolean('is_visible').defaultTo(true)

      // Metadata for UI
      table.string('icon', 50).nullable() // Lucide icon name
      table.string('color', 20).nullable() // Hex color code

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Indexes for performance
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['parent_id', 'sort_order'], 'idx_parent_order')
      table.index(['path'], 'idx_path')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
