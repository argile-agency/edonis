import type { HttpContext } from '@adonisjs/core/http'

export default class HomeController {
  /**
   * Afficher la page d'accueil
   * GET /
   */
  async index({ auth, inertia }: HttpContext) {
    // Récupérer l'utilisateur connecté s'il existe
    const user = auth.user

    if (user) {
      await user.load('roles' as any)
    }

    return inertia.render('home', {
      auth: {
        user: user ? user.serialize() : null,
      },
    })
  }
}
