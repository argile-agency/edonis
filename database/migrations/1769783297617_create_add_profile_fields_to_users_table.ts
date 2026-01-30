import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('first_name').nullable()
      table.string('last_name').nullable()
      table.string('city').nullable()
      table.string('country', 2).nullable() // ISO 3166-1 alpha-2
      table.string('email_visibility').defaultTo('private') // 'everyone' | 'participants' | 'private'
      table.string('mobile_phone', 20).nullable()
      table.text('address').nullable()
      table.string('identification_number').nullable()
      table.text('avatar_description').nullable() // Alt text for accessibility
      table.string('web_url').nullable()
      table.string('profile_visibility').defaultTo('public') // 'public' | 'participants' | 'private'
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('first_name')
      table.dropColumn('last_name')
      table.dropColumn('city')
      table.dropColumn('country')
      table.dropColumn('email_visibility')
      table.dropColumn('mobile_phone')
      table.dropColumn('address')
      table.dropColumn('identification_number')
      table.dropColumn('avatar_description')
      table.dropColumn('web_url')
      table.dropColumn('profile_visibility')
    })
  }
}
