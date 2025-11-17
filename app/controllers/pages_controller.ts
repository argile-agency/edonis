import type { HttpContext } from '@adonisjs/core/http'

export default class PagesController {
  /**
   * Affiche la page À propos
   */
  async about({ inertia }: HttpContext) {
    return inertia.render('pages/about')
  }

  /**
   * Affiche la page Contact
   */
  async contact({ inertia }: HttpContext) {
    return inertia.render('pages/contact')
  }

  /**
   * Affiche la page Politique de confidentialité
   */
  async privacy({ inertia }: HttpContext) {
    return inertia.render('pages/privacy')
  }
}
