import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import AuditLog from '#models/audit_log'
import { auditLogIndexQueryValidator } from '#validators/listing'

export default class AuditLogsController {
  /**
   * Display paginated audit logs with filters.
   * GET /admin/audit-logs
   */
  async index({ inertia, request }: HttpContext) {
    const q = await request.validateUsing(auditLogIndexQueryValidator)
    const page = q.page ?? 1
    const limit = 30
    const action = q.action ?? ''
    const userId = q.userId ? String(q.userId) : ''
    const resourceType = q.resourceType ?? ''
    const dateFrom = q.dateFrom ? (DateTime.fromJSDate(q.dateFrom).toSQLDate() ?? '') : ''
    const dateTo = q.dateTo ? (DateTime.fromJSDate(q.dateTo).toSQLDate() ?? '') : ''

    const query = AuditLog.query().preload('user').orderBy('created_at', 'desc')

    if (action) {
      query.where('action', 'like', `%${action}%`)
    }

    if (q.userId) {
      query.where('user_id', q.userId)
    }

    if (resourceType) {
      query.where('resource_type', resourceType)
    }

    if (dateFrom) {
      query.where('created_at', '>=', dateFrom)
    }

    if (dateTo) {
      query.where('created_at', '<=', `${dateTo} 23:59:59`)
    }

    const logs = await query.paginate(page, limit)

    // Get distinct action names and resource types for filter dropdowns
    const actions = await AuditLog.query().distinct('action').orderBy('action').exec()
    const resourceTypes = await AuditLog.query()
      .distinct('resource_type')
      .orderBy('resource_type')
      .exec()

    return inertia.render('admin/audit-logs', {
      logs: logs.serialize(),
      filters: { action, userId, resourceType, dateFrom, dateTo },
      actionOptions: actions.map((a) => a.action),
      resourceTypeOptions: resourceTypes.map((r) => r.resourceType),
    })
  }
}
