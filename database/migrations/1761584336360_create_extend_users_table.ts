import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('avatar_url').nullable()
      table.text('bio').nullable()
      table.string('phone', 20).nullable()
      table.string('student_id', 50).nullable().unique() // Matricule étudiant
      table.string('department').nullable()
      table.string('organization').nullable()
      table.string('locale', 10).defaultTo('fr') // Langue préférée
      table.string('timezone', 50).defaultTo('Europe/Paris')
      table.boolean('is_active').defaultTo(true)
      table.timestamp('last_login_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('avatar_url')
      table.dropColumn('bio')
      table.dropColumn('phone')
      table.dropColumn('student_id')
      table.dropColumn('department')
      table.dropColumn('organization')
      table.dropColumn('locale')
      table.dropColumn('timezone')
      table.dropColumn('is_active')
      table.dropColumn('last_login_at')
    })
  }
}
