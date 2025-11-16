import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'menu_locations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Location slug (défini par le thème/app)
      table.string('location').notNullable().unique() // Ex: "header", "footer", "sidebar", "mobile"
      table.string('description').nullable() // Ex: "Menu principal du header"

      // Menu assigné à cette location
      table.integer('menu_id').unsigned().nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')

      // Foreign key
      table.foreign('menu_id').references('id').inTable('menus').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
