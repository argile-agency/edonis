import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('two_factor_secret', 512).nullable()
      table.boolean('two_factor_enabled').defaultTo(false)
      table.text('two_factor_recovery_codes').nullable()
      table.timestamp('two_factor_confirmed_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('two_factor_secret')
      table.dropColumn('two_factor_enabled')
      table.dropColumn('two_factor_recovery_codes')
      table.dropColumn('two_factor_confirmed_at')
    })
  }
}
