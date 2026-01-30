import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audit_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')

      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('action', 100).notNullable()
      table.string('resource_type', 100).notNullable()
      table.string('resource_id', 100).nullable()
      table.jsonb('old_values').nullable()
      table.jsonb('new_values').nullable()
      table.string('ip_address', 45).nullable()
      table.text('user_agent').nullable()
      table.jsonb('metadata').nullable()

      table.timestamp('created_at').notNullable().defaultTo(this.now())

      table.index(['user_id'], 'idx_audit_logs_user_id')
      table.index(['resource_type', 'resource_id'], 'idx_audit_logs_resource')
      table.index(['action'], 'idx_audit_logs_action')
      table.index(['created_at'], 'idx_audit_logs_created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
