import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bulk_enrollment_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      // Relations
      table.integer('course_id').unsigned().notNullable()
      table.foreign('course_id').references('id').inTable('courses').onDelete('CASCADE')

      table.integer('enrollment_method_id').unsigned().nullable()
      table
        .foreign('enrollment_method_id')
        .references('id')
        .inTable('course_enrollment_methods')
        .onDelete('SET NULL')

      // User who initiated the import
      table.integer('imported_by').unsigned().notNullable()
      table.foreign('imported_by').references('id').inTable('users').onDelete('CASCADE')

      // File information
      table.string('filename', 255).notNullable()
      table.string('file_path', 500).nullable() // Storage path for audit

      // Results
      table.integer('total_rows').notNullable()
      table.integer('successful_enrollments').defaultTo(0)
      table.integer('failed_enrollments').defaultTo(0)
      table.integer('skipped_rows').defaultTo(0)

      // Error details (JSON)
      table.jsonb('error_details').nullable()
      // Ex: [{"row": 5, "email": "test@test.com", "error": "User not found"}]

      // Import options (JSON)
      table.jsonb('import_options').nullable()
      // Ex: {"auto_create_users": true, "auto_assign_groups": true, "default_role": "student"}

      // Status
      table.string('status', 50).notNullable().defaultTo('pending')
      // Values: 'pending', 'processing', 'completed', 'failed'

      table.timestamp('started_at').notNullable().defaultTo(this.now())
      table.timestamp('completed_at').nullable()
    })

    // Indexes for performance
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['course_id'], 'idx_course_imports')
      table.index(['status'], 'idx_status')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
