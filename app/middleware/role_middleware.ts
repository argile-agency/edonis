import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Middleware pour vérifier que l'utilisateur a un rôle spécifique
 *
 * Utilisation :
 * Route.get('/admin/users', [UsersController, 'index']).use(middleware.role(['admin', 'manager']))
 */
export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { roles: string[]; courseId?: number }) {
    const { auth, response } = ctx
    const { roles } = options

    // Vérifier que l'utilisateur est authentifié
    if (!auth.user) {
      return response.unauthorized({ message: 'Vous devez être connecté' })
    }

    // Charger les rôles de l'utilisateur
    await auth.user.load('roles')

    // Vérifier si l'utilisateur a l'un des rôles requis
    const hasRole = auth.user.roles.some((userRole) => {
      return roles.includes(userRole.slug)
    })

    if (!hasRole) {
      return response.forbidden({
        message: "Vous n'avez pas les permissions nécessaires pour accéder à cette ressource",
      })
    }

    const output = await next()
    return output
  }
}
