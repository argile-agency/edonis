import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { jsonColumnConfig } from '../helpers/json_column.js'

// SQLite and MySQL/MariaDB return 0/1 for boolean columns; PostgreSQL returns booleans.
const booleanColumn = { consume: (value: unknown) => Boolean(value) }

/**
 * Single-instance in v1 (D-14): app_settings is an is_active singleton without
 * tenant_id; multi-tenant settings are deferred.
 */
export default class AppSetting extends BaseModel {
  /**
   * Values of a fresh install (no demo data). Explicit because DB column
   * defaults are not read back by `create`.
   */
  static readonly DEFAULTS = {
    appName: 'Edonis LMS',
    primaryColor: '#5046E5',
    heroTitle: 'Apprenez à votre rythme',
    heroSubtitle:
      'Découvrez nos cours en ligne et développez vos compétences avec une plateforme moderne et intuitive.',
    allowRegistration: true,
    showPublicCourses: true,
    showStats: true,
    isActive: true,
  }

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

  @column()
  declare announcementText: string | null

  // Features
  @column(booleanColumn)
  declare showPublicCourses: boolean

  @column(booleanColumn)
  declare allowRegistration: boolean

  @column(booleanColumn)
  declare showStats: boolean

  // Contact/Social
  @column()
  declare contactEmail: string | null

  @column()
  declare supportUrl: string | null

  @column(jsonColumnConfig)
  declare socialLinks: Record<string, string | null> | null

  @column(booleanColumn)
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

  /**
   * Returns the active settings row, creating it with DEFAULTS on a fresh
   * database. Not race-safe (no unique constraint on is_active): accepted, see T-05.1-06.
   */
  static async getOrCreateActive(client?: QueryClientContract) {
    return await this.firstOrCreate(
      { isActive: true },
      { ...this.DEFAULTS },
      client ? { client } : undefined
    )
  }
}
