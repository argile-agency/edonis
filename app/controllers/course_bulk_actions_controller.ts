import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import type { VineValidator } from '@vinejs/vine'
import type { Infer } from '@vinejs/vine/types'
import { DateTime } from 'luxon'
import Course from '#models/course'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import AuditService from '#services/audit_service'
import { CONFLICT_ERROR, sameSecond } from '#services/course_structure_service'
import {
  bulkAvailabilityValidator,
  bulkPublishValidator,
  bulkShiftValidator,
} from '#validators/course_bulk'
import { loadBuilderStructure } from '../helpers/builder_props.js'
import { shiftDate, shiftDays } from '../helpers/date_shift.js'

// OQ-1 (05-09): assignments rows are not builder rows; flip only after the user decides
const SHIFT_ASSIGNMENTS_TABLE = false

type Kind = 'section' | 'content'
type Item = { kind: Kind; id: number; updatedAt: string | null }
type Ids = { sectionIds: number[]; contentIds: number[] }
type Structure = Awaited<ReturnType<typeof loadBuilderStructure>>

/** The selected rows, scoped to the course and token-checked, under the course lock. */
type Scope = {
  courseId: number
  items: Item[]
  sections: Map<number, CourseModule>
  contents: Map<number, CourseContent>
  structure: Structure
}

type Outcome = {
  auditAction: string
  extraMetadata?: Record<string, unknown>
  /** Rows this action saved or created. */
  affected: Ids
  deleted?: Ids
  /** Renumbered sibling lists: section lists by parent (null = roots), content lists by section. */
  touchedParents?: (number | null)[]
  touchedSections?: number[]
}

/** A refusal thrown inside the transaction so it rolls back; turned into JSON outside it. */
class BulkRefusal extends Error {
  constructor(
    public status: 409 | 422,
    public body: Record<string, unknown>
  ) {
    super(String(body.code ?? 'E_BULK_REFUSED'))
  }
}

const AVAILABILITY_ORDER_ERROR = 'La date de fin doit être postérieure à la date de début.'

const emptyIds = (): Ids => ({ sectionIds: [], contentIds: [] })

function push(ids: Ids, kind: Kind, id: number) {
  ;(kind === 'section' ? ids.sectionIds : ids.contentIds).push(id)
}

function sorted(ids: Ids): Ids {
  const sort = (list: number[]) => [...new Set(list)].sort((a, b) => a - b)
  return { sectionIds: sort(ids.sectionIds), contentIds: sort(ids.contentIds) }
}

function idsOf(items: Item[]): Ids {
  const ids = emptyIds()
  for (const item of items) push(ids, item.kind, item.id)
  return sorted(ids)
}

const sameInstant = (a: DateTime | null, b: DateTime | null) =>
  (a?.toMillis() ?? null) === (b?.toMillis() ?? null)

/** Selected rows in payload order. */
function rowsOf(scope: Scope) {
  return scope.items.map((item) =>
    item.kind === 'section'
      ? { kind: 'section' as const, row: scope.sections.get(item.id)! }
      : { kind: 'content' as const, row: scope.contents.get(item.id)! }
  )
}

async function loadScope(
  trx: TransactionClientContract,
  courseId: number,
  items: Item[]
): Promise<Scope> {
  const sectionIds = items.filter((i) => i.kind === 'section').map((i) => i.id)
  const contentIds = items.filter((i) => i.kind === 'content').map((i) => i.id)
  const sections = sectionIds.length
    ? await CourseModule.query({ client: trx })
        .where('course_id', courseId)
        .whereIn('id', sectionIds)
    : []
  const contents = contentIds.length
    ? await CourseContent.query({ client: trx })
        .whereIn('id', contentIds)
        .whereIn('module_id', trx.from('course_modules').select('id').where('course_id', courseId))
    : []
  const sectionMap = new Map(sections.map((s) => [s.id, s]))
  const contentMap = new Map(contents.map((c) => [c.id, c]))
  const rowOf = (item: Item) =>
    item.kind === 'section' ? sectionMap.get(item.id) : contentMap.get(item.id)

  const missing = items.filter((item) => !rowOf(item)).map(({ kind, id }) => ({ kind, id }))
  if (missing.length > 0) {
    throw new BulkRefusal(422, {
      code: 'E_INVALID_ITEMS',
      message: 'Certains éléments ne font pas partie de ce cours.',
      ids: missing,
    })
  }

  const stale = items.flatMap((item) => {
    const row = rowOf(item)!
    if (sameSecond(row.updatedAt, item.updatedAt)) return []
    return [{ kind: item.kind, id: item.id, updatedAt: row.updatedAt?.toISO() ?? null }]
  })
  if (stale.length > 0) {
    throw new BulkRefusal(409, { code: 'E_CONFLICT', message: CONFLICT_ERROR, items: stale })
  }

  return {
    courseId,
    items,
    sections: sectionMap,
    contents: contentMap,
    structure: await loadBuilderStructure(courseId, trx),
  }
}

/** `affected` plus every row of the sibling lists the action renumbered (they need their new order). */
function withRenumbered(outcome: Outcome, structure: Structure): Ids {
  const ids: Ids = {
    sectionIds: [...outcome.affected.sectionIds],
    contentIds: [...outcome.affected.contentIds],
  }
  const parents = new Set(outcome.touchedParents ?? [])
  const lists = new Set(outcome.touchedSections ?? [])
  for (const s of structure.sections) if (parents.has(s.parentId)) ids.sectionIds.push(s.id)
  for (const c of structure.contents) if (lists.has(c.moduleId)) ids.contentIds.push(c.id)
  return sorted(ids)
}

/**
 * Builder bulk actions (D-11): one course, a batch of sections and contents,
 * all-or-nothing under the course-row lock, one ids-only audit row per commit.
 */
export default class CourseBulkActionsController {
  /** Publish or unpublish each selected item (no cascade to children). */
  async publish(ctx: HttpContext) {
    return this.run(ctx, bulkPublishValidator, async (_trx, scope, payload) => {
      const affected = emptyIds()
      for (const { kind, row } of rowsOf(scope)) {
        // SQLite and MySQL return 0/1
        if (Boolean(row.isPublished) === payload.isPublished) continue
        row.isPublished = payload.isPublished
        await row.save()
        push(affected, kind, row.id)
      }
      const auditAction = payload.isPublished ? 'course.bulk.publish' : 'course.bulk.unpublish'
      return { auditAction, affected }
    })
  }

  /** Set (or clear with null) the availability window of each selected item. */
  async availability(ctx: HttpContext) {
    return this.run(ctx, bulkAvailabilityValidator, async (_trx, scope, payload) => {
      const from = payload.availableFrom ? DateTime.fromJSDate(payload.availableFrom) : null
      const until = payload.availableUntil ? DateTime.fromJSDate(payload.availableUntil) : null
      if (from && until && from > until) {
        throw new BulkRefusal(422, {
          errors: [{ field: 'availableUntil', message: AVAILABILITY_ORDER_ERROR }],
        })
      }
      const affected = emptyIds()
      for (const { kind, row } of rowsOf(scope)) {
        if (sameInstant(row.availableFrom, from) && sameInstant(row.availableUntil, until)) continue
        row.availableFrom = from
        row.availableUntil = until
        await row.save()
        push(affected, kind, row.id)
      }
      return { auditAction: 'course.bulk.availability', affected }
    })
  }

  /** Move every non-null date of the selected items by the same number of calendar days. */
  async shiftDates(ctx: HttpContext) {
    return this.run(ctx, bulkShiftValidator, async (_trx, scope, payload) => {
      const days = shiftDays({
        days: payload.days,
        from: payload.from ? DateTime.fromJSDate(payload.from) : undefined,
        to: payload.to ? DateTime.fromJSDate(payload.to) : undefined,
      })
      if (days === null) {
        throw new BulkRefusal(422, {
          code: 'E_INVALID_SHIFT',
          message: 'Indiquez un nombre de jours ou une ancienne et une nouvelle date de début.',
        })
      }
      if (days === 0) {
        throw new BulkRefusal(422, {
          code: 'E_INVALID_SHIFT',
          message: 'Le décalage doit être d’au moins un jour.',
        })
      }
      if (SHIFT_ASSIGNMENTS_TABLE) throw new Error('OQ-1: shifting assignments is not implemented')

      const affected = emptyIds()
      for (const { kind, row } of rowsOf(scope)) {
        const dueDate = row instanceof CourseContent ? row.dueDate : null
        if (!row.availableFrom && !row.availableUntil && !dueDate) continue
        row.availableFrom = shiftDate(row.availableFrom, days)
        row.availableUntil = shiftDate(row.availableUntil, days)
        if (row instanceof CourseContent) row.dueDate = shiftDate(row.dueDate, days)
        await row.save()
        push(affected, kind, row.id)
      }
      return { auditAction: 'course.bulk.shift_dates', extraMetadata: { days }, affected }
    })
  }

  /**
   * Shared skeleton: policy, payload, then one transaction (course lock, scope,
   * tokens, action). Refusals roll back and answer JSON; a commit writes one
   * audit row and answers the fresh structure.
   */
  private async run<V extends VineValidator<any, any>>(
    ctx: HttpContext,
    validator: V,
    action: (trx: TransactionClientContract, scope: Scope, payload: Infer<V>) => Promise<Outcome>
  ) {
    const { params, request, response, bouncer } = ctx
    const course = await Course.findOrFail(params.id)
    await bouncer.with('CoursePolicy').authorize('edit', course)
    const payload = (await request.validateUsing(validator)) as Infer<V>

    const unique = new Map<string, Item>()
    for (const item of payload.items as Item[]) {
      if (!unique.has(`${item.kind}:${item.id}`)) unique.set(`${item.kind}:${item.id}`, item)
    }
    const items = [...unique.values()]

    let outcome: Outcome
    try {
      outcome = await db.transaction(async (trx) => {
        await Course.query({ client: trx }).where('id', course.id).forUpdate().first()
        const scope = await loadScope(trx, course.id, items)
        return action(trx, scope, payload)
      })
    } catch (error) {
      // Outside the callback: PostgreSQL aborts the transaction on errors
      if (error instanceof BulkRefusal) return response.status(error.status).json(error.body)
      throw error
    }

    await AuditService.logFromContext(ctx, {
      action: outcome.auditAction,
      resourceType: 'Course',
      resourceId: course.id,
      metadata: { ...idsOf(items), ...outcome.extraMetadata },
    })

    const structure = await loadBuilderStructure(course.id)
    return response.json({
      ...structure,
      affected: withRenumbered(outcome, structure),
      deleted: sorted(outcome.deleted ?? emptyIds()),
    })
  }
}
