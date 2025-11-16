import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'courses'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Replace string 'category' with foreign key to course_categories
      table.integer('category_id').unsigned().nullable()
      table
        .foreign('category_id')
        .references('id')
        .inTable('course_categories')
        .onDelete('SET NULL')

      // Course approval workflow
      table.string('approval_status', 50).defaultTo('draft')
      // Values: 'draft', 'pending_approval', 'approved', 'rejected'

      table.integer('approved_by').unsigned().nullable()
      table.foreign('approved_by').references('id').inTable('users').onDelete('SET NULL')

      table.timestamp('approved_at').nullable()
      table.timestamp('submitted_for_approval_at').nullable()
      table.text('rejection_reason').nullable()
    })

    // Create indexes
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['category_id'], 'idx_courses_category')
      table.index(['approval_status'], 'idx_courses_approval_status')
    })

    // Migrate existing category string data to category_id
    // This will be done after seeding categories
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop indexes
      table.dropIndex(['category_id'], 'idx_courses_category')
      table.dropIndex(['approval_status'], 'idx_courses_approval_status')

      // Drop columns
      table.dropForeign(['category_id'])
      table.dropColumn('category_id')
      table.dropForeign(['approved_by'])
      table.dropColumn('approved_by')
      table.dropColumn('approval_status')
      table.dropColumn('approved_at')
      table.dropColumn('submitted_for_approval_at')
      table.dropColumn('rejection_reason')
    })
  }
}
