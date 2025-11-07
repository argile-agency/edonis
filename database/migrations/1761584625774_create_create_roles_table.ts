import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'roles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name', 50).notNullable()
      table.string('slug', 50).notNullable().unique()
      table.text('description').nullable()
      table.jsonb('permissions').nullable() // Pour stocker les permissions spécifiques
      table.boolean('is_system').defaultTo(true) // Rôles système non modifiables

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
