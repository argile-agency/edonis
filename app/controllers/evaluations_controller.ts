import type { HttpContext } from '@adonisjs/core/http'

export default class EvaluationsController {
  /**
   * Affiche la liste des évaluations à corriger pour un instructeur
   */
  async index({ inertia }: HttpContext) {
    // TODO: Récupérer les devoirs/activités à évaluer pour l'instructeur
    // Pour l'instant, page vide avec placeholder

    return inertia.render('evaluations/index', {
      pendingEvaluations: [],
      stats: {
        total: 0,
        pending: 0,
        graded: 0,
      },
    })
  }
}
