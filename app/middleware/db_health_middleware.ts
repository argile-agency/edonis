import app from '@adonisjs/core/services/app'
import { HttpContext } from '@adonisjs/core/http'
import { NextFn } from '@adonisjs/core/types/http'
import logger from '@adonisjs/core/services/logger'

/**
 * Middleware that checks database connectivity and shares the result
 * with Edge views. In debug mode, Edge templates can render an error
 * banner with full details when the DB is unreachable.
 */
export default class DbHealthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    let dbError: { name: string; message: string; stack: string } | null = null

    try {
      const dbModule = await import('@adonisjs/lucid/services/db')
      await dbModule.default.rawQuery('SELECT 1')
    } catch (error) {
      const err = error as Error
      logger.warn('DbHealthMiddleware: database unreachable: %s', err.message)
      dbError = {
        name: err.name ?? 'Error',
        message: err.message ?? '',
        stack: err.stack ?? '',
      }
    }

    ctx.view.share({
      dbError,
      isDebug: !app.inProduction,
    })

    return next()
  }
}
