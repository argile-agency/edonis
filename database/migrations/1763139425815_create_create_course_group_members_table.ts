import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'course_group_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Relations
      table.integer('group_id').unsigned().notNullable()
      table.foreign('group_id').references('id').inTable('course_groups').onDelete('CASCADE')

      table.integer('user_id').unsigned().notNullable()
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')

      // Role in group (optional)
      table.string('role_in_group', 50).nullable()
      // Values: 'leader', 'member', 'moderator'

      table.timestamp('joined_at').notNullable().defaultTo(this.now())

      table.integer('added_by').unsigned().nullable()
      table.foreign('added_by').references('id').inTable('users').onDelete('SET NULL')

      // One user per group
      table.unique(['group_id', 'user_id'])
    })

    // Indexes for performance
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['group_id'], 'idx_group_members')
      table.index(['user_id'], 'idx_user_groups')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
