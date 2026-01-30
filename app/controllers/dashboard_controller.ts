import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'

export default class DashboardController {
  /**
   * Afficher le tableau de bord
   * GET /dashboard
   */
  async index({ auth, inertia }: HttpContext) {
    const user = auth.user!

    try {
      // Charger les rôles
      await user.load('roles' as any)
    } catch (error) {
      logger.error('DashboardController: failed to load user roles: %s', (error as Error).message)
    }

    return inertia.render('dashboard', {
      user: user.serialize(),
    })
  }
}
