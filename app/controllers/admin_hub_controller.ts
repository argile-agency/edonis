import type { HttpContext } from '@adonisjs/core/http'

export default class AdminHubController {
  /**
   * GET /admin
   */
  async index({ inertia, bouncer }: HttpContext) {
    // same admin-only rule as /admin/settings (5.1 D-12)
    await bouncer.with('PlatformSettingsPolicy').authorize('manage')
    return inertia.render('admin/index')
  }
}
