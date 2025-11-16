import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'cohort_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Relations
      table.integer('cohort_id').unsigned().notNullable()
      table.foreign('cohort_id').references('id').inTable('cohorts').onDelete('CASCADE')

      table.integer('user_id').unsigned().notNullable()
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')

      table.timestamp('added_at').notNullable().defaultTo(this.now())

      table.integer('added_by').unsigned().nullable()
      table.foreign('added_by').references('id').inTable('users').onDelete('SET NULL')

      // One user per cohort
      table.unique(['cohort_id', 'user_id'])
    })

    // Indexes for performance
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['cohort_id'], 'idx_cohort_members')
      table.index(['user_id'], 'idx_user_cohorts')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
