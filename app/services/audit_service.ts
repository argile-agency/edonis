import type { HttpContext } from '@adonisjs/core/http'
import AuditLog from '#models/audit_log'

interface AuditOptions {
  userId?: number | null
  action: string
  resourceType: string
  resourceId?: string | number | null
  oldValues?: Record<string, any> | null
  newValues?: Record<string, any> | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, any> | null
}

export default class AuditService {
  /**
   * Log an audit event.
   */
  static async log(options: AuditOptions): Promise<AuditLog> {
    return AuditLog.create({
      userId: options.userId ?? null,
      action: options.action,
      resourceType: options.resourceType,
      resourceId:
        options.resourceId !== undefined && options.resourceId !== null
          ? String(options.resourceId)
          : null,
      oldValues: options.oldValues ?? null,
      newValues: options.newValues ?? null,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      metadata: options.metadata ?? null,
    })
  }

  /**
   * Log an audit event using HttpContext to auto-extract user, IP, and user-agent.
   */
  static async logFromContext(
    ctx: HttpContext,
    options: Omit<AuditOptions, 'userId' | 'ipAddress' | 'userAgent'>
  ): Promise<AuditLog> {
    return this.log({
      ...options,
      userId: ctx.auth?.user?.id ?? null,
      ipAddress: ctx.request.ip(),
      userAgent: ctx.request.header('user-agent') ?? null,
    })
  }
}
