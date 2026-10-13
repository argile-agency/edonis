import vine from '@vinejs/vine'

/**
 * Query strings are not touched by the bodyparser's `convertEmptyStringsToNull`
 * (it only applies to request bodies), and the listing pages send empty filters
 * as `?search=&role=&status=`. Each field therefore maps `''` to `null` before
 * validation so an empty filter means "no filter" instead of a validation error.
 */
const emptyToNull = (value: unknown) => (value === '' ? null : value)

/**
 * Admin user listing filters (GET /admin/users).
 * `limit` is bounded to prevent unbounded page sizes.
 */
export const userIndexQueryValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).parse(emptyToNull).optional().nullable(),
    limit: vine.number().min(1).max(100).parse(emptyToNull).optional().nullable(),
    search: vine.string().trim().maxLength(255).parse(emptyToNull).optional().nullable(),
    role: vine.string().trim().maxLength(50).parse(emptyToNull).optional().nullable(),
    status: vine.enum(['active', 'inactive']).parse(emptyToNull).optional().nullable(),
  })
)

/**
 * Admin audit-log listing filters (GET /admin/audit-logs).
 * Dates are strictly `YYYY-MM-DD` and `userId` must be numeric, so malformed
 * filters are rejected by validation instead of reaching the database.
 */
export const auditLogIndexQueryValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).parse(emptyToNull).optional().nullable(),
    action: vine.string().trim().maxLength(100).parse(emptyToNull).optional().nullable(),
    userId: vine.number().positive().parse(emptyToNull).optional().nullable(),
    resourceType: vine.string().trim().maxLength(100).parse(emptyToNull).optional().nullable(),
    dateFrom: vine
      .date({ formats: ['YYYY-MM-DD'] })
      .parse(emptyToNull)
      .optional()
      .nullable(),
    dateTo: vine
      .date({ formats: ['YYYY-MM-DD'] })
      .parse(emptyToNull)
      .optional()
      .nullable(),
  })
)
