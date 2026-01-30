import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'social_accounts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('provider', 50).notNullable()
      table.string('provider_id', 255).notNullable()
      table.string('email', 255).nullable()
      table.string('name', 255).nullable()
      table.string('avatar_url', 500).nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['provider', 'provider_id'])
      table.index(['user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
