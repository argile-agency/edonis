import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_roles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.integer('user_id').unsigned().notNullable()
      table.integer('role_id').unsigned().notNullable()

      // Optionnel : pour les rôles contextuels au niveau cours (null = rôle global)
      table.integer('course_id').unsigned().nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Clés étrangères
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')
      table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE')

      // Un utilisateur ne peut avoir qu'un seul rôle par contexte (global ou par cours)
      table.unique(['user_id', 'role_id', 'course_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
