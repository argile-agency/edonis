import type { HttpContext } from '@adonisjs/core/http'
import type { VineValidator } from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import AppSetting from '#models/app_setting'
import AuditService from '#services/audit_service'
import { SETTINGS_TABS, appSettingValidators, type SettingsTab } from '#validators/app_setting'

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

/**
 * Comparable form for the manual diff (Lucid dirty tracking is unreliable on JSON columns):
 * '' / undefined → null, 0/1 → boolean, socialLinks → the four-key object.
 */
function normalize(key: string, value: unknown) {
  if (key === 'socialLinks') return normalizeSocialLinks(value as Record<string, string | null>)
  if (key === 'allowRegistration') return Boolean(value)
  return value === '' || value === undefined ? null : value
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
    const { bouncer, params, request, response, session } = ctx
    await bouncer.with('PlatformSettingsPolicy').authorize('manage')
    const tab = params.tab as SettingsTab
    // Widened: TS cannot call validateUsing on a union of four validators
    const validator: VineValidator<any, { appHost: string }> = appSettingValidators[tab]
    const data: Record<string, unknown> = await request.validateUsing(validator, {
      meta: { appHost: request.host() ?? '' },
    })

    const outcome = await db.transaction(async (trx) => {
      const row = await AppSetting.getOrCreateActive(trx)
      const oldValues: Record<string, unknown> = {}
      const newValues: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue
        const before = normalize(key, row[key as keyof AppSetting])
        const after = normalize(key, value)
        if (JSON.stringify(before) === JSON.stringify(after)) continue
        oldValues[key] = before
        newValues[key] = after
      }

      const changedKeys = Object.keys(newValues)
      if (changedKeys.length === 0) return 'unchanged'

      const links = newValues.socialLinks as SocialLinks | undefined
      row.merge({
        ...newValues,
        ...(links && { socialLinks: Object.values(links).some(Boolean) ? links : null }),
      })
      row.useTransaction(trx)
      await row.save()
      // In the transaction: committed ⇔ audited (D-13)
      await AuditService.logFromContext(
        ctx,
        {
          action: 'admin.settings.update',
          resourceType: 'AppSetting',
          resourceId: row.id,
          oldValues,
          newValues,
          metadata: { tab, changedKeys },
        },
        trx
      )
      return 'saved'
    })

    session.flash(
      'success',
      outcome === 'saved' ? 'Réglages enregistrés.' : 'Aucune modification à enregistrer.'
    )
    return response.redirect().toPath(`/admin/settings?tab=${tab}`)
  }
}
