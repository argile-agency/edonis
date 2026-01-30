import type { HttpContext } from '@adonisjs/core/http'
import AuditLog from '#models/audit_log'

export default class AuditLogsController {
  /**
   * Display paginated audit logs with filters.
   * GET /admin/audit-logs
   */
  async index({ inertia, request }: HttpContext) {
    const page = request.input('page', 1)
    const limit = 30
    const action = request.input('action', '')
    const userId = request.input('userId', '')
    const resourceType = request.input('resourceType', '')
    const dateFrom = request.input('dateFrom', '')
    const dateTo = request.input('dateTo', '')

    const query = AuditLog.query().preload('user').orderBy('created_at', 'desc')

    if (action) {
      query.where('action', 'like', `%${action}%`)
    }

    if (userId) {
      query.where('user_id', userId)
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
