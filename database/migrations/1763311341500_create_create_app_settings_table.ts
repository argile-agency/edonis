import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'app_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Branding
      table.string('app_name').defaultTo('Edonis LMS')
      table.string('app_logo_url').nullable()
      table.string('app_favicon_url').nullable()

      // Colors (hex values)
      table.string('primary_color').defaultTo('#5046E5')
      table.string('secondary_color').nullable()
      table.string('accent_color').nullable()

      // Header/Footer
      table.text('header_html').nullable()
      table.text('footer_html').nullable()

      // Homepage settings
      table.text('welcome_message').nullable()
      table.text('hero_title').nullable()
      table.text('hero_subtitle').nullable()
      table.string('hero_image_url').nullable()

      // Features
      table.boolean('show_public_courses').defaultTo(true)
      table.boolean('allow_registration').defaultTo(true)
      table.boolean('show_stats').defaultTo(true)

      // Contact/Social
      table.string('contact_email').nullable()
      table.string('support_url').nullable()
      table.json('social_links').nullable() // {facebook: 'url', twitter: 'url', etc}

      // Ensure only one settings row
      table.boolean('is_active').defaultTo(true)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
