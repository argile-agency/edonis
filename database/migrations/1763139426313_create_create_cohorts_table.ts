import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'cohorts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Basic information
      table.string('name', 255).notNullable().unique()
      table.string('slug', 255).notNullable().unique()
      table.text('description').nullable()

      // Type
      table.string('cohort_type', 50).defaultTo('manual')
      // Values: 'manual' (manual addition), 'automatic' (automatic rules)

      // Visibility
      table.boolean('is_visible').defaultTo(true)

      // Stats
      table.integer('member_count').defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
