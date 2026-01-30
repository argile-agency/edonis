import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import logger from '@adonisjs/core/services/logger'

/**
 * Silent auth middleware can be used as a global middleware to silent check
 * if the user is logged-in or not.
 *
 * The request continues as usual, even when the user is not logged-in.
 * If the database is unreachable, the check is skipped and the user
 * is treated as unauthenticated so pages can still render.
 */
export default class SilentAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    try {
      await ctx.auth.check()
    } catch (error) {
      logger.warn(
        'SilentAuthMiddleware: auth check failed, treating as guest: %s',
        (error as Error).message
      )
    }

    return next()
  }
}
