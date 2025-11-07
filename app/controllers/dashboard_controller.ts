import type { HttpContext } from '@adonisjs/core/http'

export default class DashboardController {
  /**
   * Afficher le tableau de bord
   * GET /dashboard
   */
  async index({ auth, inertia }: HttpContext) {
    const user = auth.user!

    // Charger les rôles
    await user.load('roles' as any)

    return inertia.render('dashboard', {
      user: user.serialize(),
    })
  }
}
