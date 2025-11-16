import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'menu_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Relation au menu parent (WordPress-style)
      table.integer('menu_id').unsigned().notNullable()

      table.string('label').notNullable() // Ex: "Accueil", "Cours", "À propos"
      table.string('url').notNullable() // Ex: "/", "/courses", "/about"
      table.string('icon').nullable() // Lucide icon name
      table.integer('order').defaultTo(0) // Sort order
      table.integer('parent_id').unsigned().nullable() // For nested menus

      // Target and CSS
      table.string('css_classes').nullable() // Custom CSS classes
      table.string('target').defaultTo('_self') // _self, _blank, etc.

      // Visibility rules
      table
        .enum('visibility', ['public', 'authenticated', 'guest', 'admin', 'instructor', 'student'])
        .defaultTo('public')
      table.boolean('is_active').defaultTo(true)

      table.timestamp('created_at')
      table.timestamp('updated_at')

      // Foreign keys
      table.foreign('menu_id').references('id').inTable('menus').onDelete('CASCADE')
      table.foreign('parent_id').references('id').inTable('menu_items').onDelete('CASCADE')

      // Index for performance
      table.index(['menu_id', 'order'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
