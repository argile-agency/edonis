import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'
import logger from '@adonisjs/core/services/logger'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Always render status pages so that errors show a user-friendly page
   * instead of the default AdonisJS debug output.
   */
  protected renderStatusPages = true

  /**
   * Status pages rendered via Inertia for standard errors.
   * Database connection errors bypass this entirely (see handle()).
   */
  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (error, { inertia }) => inertia.render('errors/not_found', { error }),
    '500..599': (error, { inertia }) =>
      inertia.render('errors/server_error', {
        error,
        debug: this.debug,
      }),
  }

  /**
   * Intercepts errors before the default handler.
   * Database connection errors (and any error that causes Inertia to fail)
   * are rendered via a standalone Edge template with zero DB/Inertia dependency.
   */
  async handle(error: unknown, ctx: HttpContext) {
    if (this.isDatabaseConnectionError(error)) {
      logger.error('Database connection error detected: %s', (error as Error).message)
      return this.renderEdgeErrorPage(ctx, error)
    }

    try {
      return await super.handle(error, ctx)
    } catch (renderError) {
      logger.error(
        'Exception handler: Inertia render failed, falling back to Edge. Original: %s. Render: %s',
        (error as Error).message,
        (renderError as Error).message
      )
      return this.renderEdgeErrorPage(ctx, error)
    }
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }

  /**
   * Detects whether an error is caused by the database being unreachable.
   */
  private isDatabaseConnectionError(error: unknown): boolean {
    if (error instanceof AggregateError) {
      return true
    }

    const message = (error as Error)?.message?.toLowerCase() ?? ''
    const code = (error as any)?.code ?? ''

    const patterns = [
      'econnrefused',
      'enotfound',
      'etimedout',
      'econnreset',
      'connection terminated',
      'connection refused',
      'the database system is starting up',
      'too many connections',
      'could not connect',
      'no pg_hba.conf entry',
    ]

    return patterns.some((p) => message.includes(p) || code.toLowerCase().includes(p))
  }

  /**
   * Renders the Edge error template directly — no Inertia, no DB.
   * In debug mode, shows full error details (stack, request, env).
   * In production, shows a clean generic error page.
   */
  private async renderEdgeErrorPage(ctx: HttpContext, error: unknown) {
    const statusCode = (error as any)?.status ?? 500
    const errorName = (error as Error)?.name ?? 'Error'
    const errorMessage = (error as Error)?.message ?? 'Unknown error'
    const errorStack = (error as Error)?.stack ?? ''

    const frames = this.parseStackFrames(errorStack)

    const hint = this.getErrorHint(error)

    let routeName = ''
    try {
      routeName = ctx.route?.name ?? ctx.route?.pattern ?? ''
    } catch {
      // Route may not be available
    }

    const data = {
      debug: this.debug,
      statusCode,
      errorName,
      errorMessage,
      errorStack,
      frames,
      hint,
      requestMethod: ctx.request.method(),
      requestUrl: ctx.request.url(true),
      routeName,
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
      adonisVersion: '6',
      nodeVersion: process.version,
    }

    try {
      const html = await ctx.view.render('errors/server_error', data)
      ctx.response.status(statusCode)
      ctx.response.header('content-type', 'text/html; charset=utf-8')
      ctx.response.send(html)
    } catch (edgeError) {
      // Last resort: if even Edge fails, send minimal inline HTML
      logger.error('Edge render also failed: %s', (edgeError as Error).message)
      ctx.response.status(statusCode)
      ctx.response.header('content-type', 'text/html; charset=utf-8')
      ctx.response.send(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Erreur ${statusCode}</title></head>` +
          `<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">` +
          `<div style="text-align:center"><h1 style="font-size:4rem;color:#2a8a7a;margin:0">${statusCode}</h1>` +
          `<p>Service temporairement indisponible</p>` +
          `<button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1rem;border-radius:0.5rem;border:none;background:#2a8a7a;color:#fff;cursor:pointer">Réessayer</button>` +
          `</div></body></html>`
      )
    }
  }

  /**
   * Parses a JS stack trace string into structured frame objects.
   */
  private parseStackFrames(stack: string): Array<{
    index: number
    file: string
    line: string
    method: string
    isApp: boolean
  }> {
    if (!stack) return []

    const lines = stack.split('\n').filter((line) => line.trim().startsWith('at '))

    return lines.map((line, i) => {
      const trimmed = line.trim().replace(/^at\s+/, '')

      // Pattern: "MethodName (file:line:col)" or "file:line:col"
      const withParens = trimmed.match(/^(.+?)\s+\((.+?)(?::(\d+))?(?::\d+)?\)$/)
      const withoutParens = trimmed.match(/^(.+?)(?::(\d+))?(?::\d+)?$/)

      let method = ''
      let file = ''
      let lineNum = ''

      if (withParens) {
        method = withParens[1]
        file = withParens[2]
        lineNum = withParens[3] ?? ''
      } else if (withoutParens) {
        file = withoutParens[1]
        lineNum = withoutParens[2] ?? ''
      }

      const isApp =
        file.includes('/app/') ||
        file.includes('/config/') ||
        file.includes('/start/') ||
        file.includes('/inertia/')

      return { index: i + 1, file, line: lineNum, method, isApp }
    })
  }

  /**
   * Returns a human-readable hint for common errors.
   */
  private getErrorHint(error: unknown): string {
    const message = (error as Error)?.message?.toLowerCase() ?? ''
    const code = (error as any)?.code ?? ''

    if (error instanceof AggregateError) {
      return 'Plusieurs connexions à la base de données ont échoué simultanément. Vérifiez que PostgreSQL est démarré et accessible.'
    }
    if (message.includes('econnrefused') || code === 'ECONNREFUSED') {
      return 'La connexion à la base de données a été refusée. Vérifiez que PostgreSQL est démarré sur le bon hôte et port.'
    }
    if (message.includes('enotfound')) {
      return "L'hôte de la base de données est introuvable. Vérifiez la variable DB_HOST dans votre fichier .env."
    }
    if (message.includes('etimedout')) {
      return 'La connexion à la base de données a expiré. Vérifiez le réseau et les paramètres de connexion.'
    }
    if (message.includes('password authentication failed')) {
      return "L'authentification a échoué. Vérifiez DB_USER et DB_PASSWORD dans votre fichier .env."
    }
    if (message.includes('database') && message.includes('does not exist')) {
      return "La base de données spécifiée n'existe pas. Vérifiez DB_DATABASE dans votre fichier .env ou créez la base."
    }

    return ''
  }
}
