import type { HttpContext } from '@adonisjs/core/http'
import AppSetting from '#models/app_setting'
import { SETTINGS_TABS, type SettingsTab } from '#validators/app_setting'

/**
 * Admin platform settings (/admin/settings).
 *
 * Single-instance in v1 (D-14): app_settings is an is_active singleton without
 * tenant_id. getOrCreateActive() creates the row on a fresh database and every
 * save updates that row.
 */

const SOCIAL_KEYS = ['facebook', 'twitter', 'linkedin', 'github'] as const

type SocialLinks = Record<(typeof SOCIAL_KEYS)[number], string | null>

/** Always the four keys; stored '' or missing keys become null. */
function normalizeSocialLinks(value: Record<string, string | null> | null | undefined) {
  const links = {} as SocialLinks
  for (const key of SOCIAL_KEYS) links[key] = value?.[key] || null
  return links
}

/** Explicit contract mapping: never serialize() (headerHtml, isActive… stay server-side). */
function toPageSettings(row: AppSetting) {
  return {
    appName: row.appName,
    appLogoUrl: row.appLogoUrl || null,
    appFaviconUrl: row.appFaviconUrl || null,
    primaryColor: row.primaryColor,
    heroTitle: row.heroTitle || null,
    heroSubtitle: row.heroSubtitle || null,
    heroImageUrl: row.heroImageUrl || null,
    announcementText: row.announcementText || null,
    allowRegistration: Boolean(row.allowRegistration),
    contactEmail: row.contactEmail || null,
    supportUrl: row.supportUrl || null,
    socialLinks: normalizeSocialLinks(row.socialLinks),
  }
}

export default class AppSettingsController {
  /**
   * GET /admin/settings
   */
  async show({ inertia, request, bouncer }: HttpContext) {
    await bouncer.with('PlatformSettingsPolicy').authorize('manage')
    const settings = await AppSetting.getOrCreateActive()
    const tab = request.qs().tab
    const activeTab: SettingsTab = SETTINGS_TABS.includes(tab) ? tab : 'appearance'
    return inertia.render('admin/settings', { settings: toPageSettings(settings), activeTab })
  }

  /**
   * PUT /admin/settings/:tab
   */
  async update(ctx: HttpContext) {
    await ctx.bouncer.with('PlatformSettingsPolicy').authorize('manage')
    return ctx.response.notImplemented()
  }
}
