import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AppSetting extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  // Branding
  @column()
  declare appName: string

  @column()
  declare appLogoUrl: string | null

  @column()
  declare appFaviconUrl: string | null

  // Colors
  @column()
  declare primaryColor: string

  @column()
  declare secondaryColor: string | null

  @column()
  declare accentColor: string | null

  // Header/Footer
  @column()
  declare headerHtml: string | null

  @column()
  declare footerHtml: string | null

  // Homepage settings
  @column()
  declare welcomeMessage: string | null

  @column()
  declare heroTitle: string | null

  @column()
  declare heroSubtitle: string | null

  @column()
  declare heroImageUrl: string | null

  // Features
  @column()
  declare showPublicCourses: boolean

  @column()
  declare allowRegistration: boolean

  @column()
  declare showStats: boolean

  // Contact/Social
  @column()
  declare contactEmail: string | null

  @column()
  declare supportUrl: string | null

  @column({
    prepare: (value: Record<string, string> | null) => JSON.stringify(value),
    consume: (value: string | Record<string, string> | null) => {
      if (!value) return null
      // Si c'est déjà un objet (PostgreSQL JSON), le retourner tel quel
      if (typeof value === 'object') return value
      // Sinon, parser la chaîne JSON
      return JSON.parse(value)
    },
  })
  declare socialLinks: Record<string, string> | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /**
   * Récupère les paramètres actifs de l'application
   */
  static async getActiveSettings() {
    return await this.query().where('is_active', true).first()
  }
}
