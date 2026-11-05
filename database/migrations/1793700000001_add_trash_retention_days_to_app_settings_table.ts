import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'app_settings'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('trash_retention_days').unsigned().notNullable().defaultTo(30)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('trash_retention_days')
    })
  }
}
