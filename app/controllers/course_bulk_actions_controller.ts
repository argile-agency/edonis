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
import TrashService from '#services/trash_service'
import CourseStructureService, {
  CONFLICT_ERROR,
  DEPTH_ERROR,
  MAX_SECTION_DEPTH,
  PARENT_ERROR,
  sameSecond,
} from '#services/course_structure_service'
import {
  bulkAvailabilityValidator,
  bulkDeleteValidator,
  bulkDuplicateValidator,
  bulkMoveValidator,
  bulkPublishValidator,
  bulkShiftValidator,
  deleteImpactValidator,
} from '#validators/course_bulk'
import { loadBuilderStructure } from '../helpers/builder_props.js'
import {
  BulkRefusal,
  emptyIds,
  idsOf,
  PIVOT_CHUNK,
  push,
  sorted,
  withRenumbered,
  type Ids,
  type Item,
  type Outcome,
  type Structure,
} from '../helpers/builder_ids.js'
import { inclusiveEnd, shiftDate, shiftDays } from '../helpers/date_shift.js'
import { depthOf, subtreeHeight } from '../helpers/category_tree.js'
import { buildRows, rowKey } from '../../inertia/lib/builder_tree.js'

// OQ-1 (05-09): assignments rows are not builder rows; flip only after the user decides
const SHIFT_ASSIGNMENTS_TABLE = false
// OQ-2 (05-09): flip to keep the original's publication state
const COPIES_START_AS_DRAFT = true

/** The selected rows, scoped to the course and token-checked, under the course lock. */
type Scope = {
  courseId: number
  items: Item[]
  sections: Map<number, CourseModule>
  contents: Map<number, CourseContent>
  structure: Structure
}

const AVAILABILITY_ORDER_ERROR = 'La date de fin doit être postérieure à la date de début.'

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
        .whereIn('module_id', trx.from('course_modules').select('id').where('course_id', courseId)) // trash-ok: ids only, the hooked outer query hides trashed contents
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

/**
 * Items to process for a structural action, in tree order (the builder's
 * `buildRows` order, every section expanded): an item whose ancestor section
 * is also selected is dropped, as it travels with that ancestor.
 */
function topLevelItems(scope: Scope): Item[] {
  const { sections, contents } = scope.structure
  const rows = buildRows(sections, contents, new Set(sections.map((s) => s.id)))
  const position = new Map(rows.map((row, i) => [row.key, i]))
  const parentOf = new Map<number, number | null>()
  for (const row of rows) if (row.kind === 'section') parentOf.set(row.id, row.parentId)

  const covered = (start: number | null) => {
    const seen = new Set<number>()
    for (let p = start; p !== null && !seen.has(p); p = parentOf.get(p) ?? null) {
      if (scope.sections.has(p)) return true
      seen.add(p)
    }
    return false
  }
  return scope.items
    .filter(
      (item) =>
        !covered(
          item.kind === 'section'
            ? (parentOf.get(item.id) ?? null)
            : scope.contents.get(item.id)!.moduleId
        )
    )
    .sort((a, b) => position.get(rowKey(a))! - position.get(rowKey(b))!)
}

/** Copies a content row (and its attachment pivot rows; the blobs are shared). */
async function copyContent(
  trx: TransactionClientContract,
  original: CourseContent,
  moduleId: number,
  order: number,
  title: string
): Promise<CourseContent> {
  const { id, createdAt, updatedAt, ...attributes } = original.$attributes
  const copy = await CourseContent.create(
    {
      ...attributes,
      moduleId,
      order,
      title,
      copiedFromId: original.id,
      isPublished: !COPIES_START_AS_DRAFT && Boolean(original.isPublished),
    },
    { client: trx }
  )

  const pivots = await trx
    .from('content_content_files')
    .where('course_content_id', original.id)
    .select('content_file_id', 'filename', 'mime_type')
  const now = DateTime.local().toFormat(trx.dialect.dateTimeFormat)
  for (let i = 0; i < pivots.length; i += PIVOT_CHUNK) {
    const chunk = pivots.slice(i, i + PIVOT_CHUNK).map((p) => ({
      course_content_id: copy.id,
      content_file_id: p.content_file_id,
      filename: p.filename,
      mime_type: p.mime_type,
      created_at: now,
      updated_at: now,
    }))
    await trx.insertQuery().table('content_content_files').multiInsert(chunk)
  }
  return copy
}

/** Copies a section with its contents and sub-sections, keeping their relative order. */
async function copySection(
  trx: TransactionClientContract,
  original: CourseModule,
  parentId: number | null,
  order: number,
  title: string,
  created: Ids,
  level = 0
): Promise<void> {
  const { id, createdAt, updatedAt, ...attributes } = original.$attributes
  const copy = await CourseModule.create(
    {
      ...attributes,
      parentId,
      order,
      title,
      copiedFromId: original.id,
      isPublished: !COPIES_START_AS_DRAFT && Boolean(original.isPublished),
    },
    { client: trx }
  )
  push(created, 'section', copy.id)

  const contents = await CourseContent.query({ client: trx })
    .where('module_id', original.id)
    .orderBy('order', 'asc')
    .orderBy('id', 'asc')
  for (const [i, content] of contents.entries()) {
    const contentCopy = await copyContent(trx, content, copy.id, i + 1, content.title)
    push(created, 'content', contentCopy.id)
  }

  // Cycle guard: the depth check already refused anything deeper
  if (level >= MAX_SECTION_DEPTH) return
  const children = await CourseModule.query({ client: trx })
    .where('parent_id', original.id)
    .orderBy('order', 'asc')
    .orderBy('id', 'asc')
  for (const [i, child] of children.entries()) {
    await copySection(trx, child, copy.id, i + 1, child.title, created, level + 1)
  }
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
      const until = payload.availableUntil
        ? inclusiveEnd(DateTime.fromJSDate(payload.availableUntil))
        : null
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
   * Move the selection to the end of `parentId` (contents first, then
   * sections), through the single-move rules (scope, cycle, 2-level depth).
   */
  async move(ctx: HttpContext) {
    return this.run(ctx, bulkMoveValidator, async (trx, scope, payload) => {
      const ordered = topLevelItems(scope)
      const contents = ordered.filter((item) => item.kind === 'content')
      const sections = ordered.filter((item) => item.kind === 'section')
      if (payload.parentId === null && contents.length > 0) {
        throw new BulkRefusal(422, {
          code: 'E_INVALID_DESTINATION',
          message: PARENT_ERROR,
          ids: contents.map(({ kind, id }) => ({ kind, id })),
        })
      }

      const affected = emptyIds()
      const touchedParents: (number | null)[] = []
      const touchedSections: number[] = []
      for (const { kind, id } of [...contents, ...sections]) {
        const end = Number.MAX_SAFE_INTEGER
        const outcome =
          kind === 'content'
            ? await CourseStructureService.moveContent(
                trx,
                scope.courseId,
                scope.contents.get(id)!,
                payload.parentId!,
                end
              )
            : await CourseStructureService.moveModule(
                trx,
                scope.courseId,
                scope.sections.get(id)!,
                payload.parentId,
                end
              )
        if (!outcome.ok) {
          throw new BulkRefusal(422, {
            code: outcome.code,
            message: outcome.message,
            ids: [{ kind, id }],
          })
        }
        push(affected, kind, id)
        if (kind === 'content') {
          touchedSections.push(outcome.fromParentId!, outcome.toParentId!)
        } else {
          touchedParents.push(outcome.fromParentId, outcome.toParentId)
        }
      }
      return {
        auditAction: 'course.bulk.move',
        extraMetadata: { parentId: payload.parentId },
        affected,
        touchedParents,
        touchedSections,
      }
    })
  }

  /**
   * Duplicate each item right after its original (D-12: every copy stores
   * copied_from_id); a section copy takes its contents and sub-sections along.
   */
  async duplicate(ctx: HttpContext) {
    return this.run(ctx, bulkDuplicateValidator, async (trx, scope) => {
      const ordered = topLevelItems(scope)
      const parentById = new Map(scope.structure.sections.map((s) => [s.id, s.parentId]))
      // Copying legacy third-level data would add more invisible data (D-02)
      const tooDeep = ordered.filter((item) =>
        item.kind === 'section'
          ? depthOf(parentById, item.id) + subtreeHeight(parentById, item.id) > MAX_SECTION_DEPTH
          : depthOf(parentById, scope.contents.get(item.id)!.moduleId) > MAX_SECTION_DEPTH
      )
      if (tooDeep.length > 0) {
        throw new BulkRefusal(422, {
          code: 'E_DEPTH',
          message: DEPTH_ERROR,
          ids: tooDeep.map(({ kind, id }) => ({ kind, id })),
        })
      }

      const created = emptyIds()
      const touchedParents: (number | null)[] = []
      const touchedSections: number[] = []
      for (const item of ordered) {
        if (item.kind === 'content') {
          const original = scope.contents.get(item.id)!
          const siblings = await CourseContent.query({ client: trx })
            .where('module_id', original.moduleId)
            .orderBy('order', 'asc')
            .orderBy('id', 'asc')
          const at = siblings.findIndex((s) => s.id === original.id) + 1
          const title = `${original.title} (copie)`
          const copy = await copyContent(trx, original, original.moduleId, at + 1, title)
          push(created, 'content', copy.id)
          const final = siblings.map((s) => ({ id: s.id, order: s.order }))
          final.splice(at, 0, { id: copy.id, order: at + 1 })
          await CourseStructureService.renumber(trx, final, CourseContent)
          touchedSections.push(original.moduleId)
        } else {
          const original = scope.sections.get(item.id)!
          const query = CourseModule.query({ client: trx }).where('course_id', scope.courseId)
          if (original.parentId === null) {
            query.whereNull('parent_id')
          } else {
            query.where('parent_id', original.parentId)
          }
          const siblings = await query.orderBy('order', 'asc').orderBy('id', 'asc')
          const at = siblings.findIndex((s) => s.id === original.id) + 1
          const before = created.sectionIds.length
          const title = `${original.title} (copie)`
          await copySection(trx, original, original.parentId, at + 1, title, created)
          const final = siblings.map((s) => ({ id: s.id, order: s.order }))
          final.splice(at, 0, { id: created.sectionIds[before], order: at + 1 })
          await CourseStructureService.renumber(trx, final, CourseModule)
          touchedParents.push(original.parentId)
        }
      }
      // Not otherwise modified (renumbering skips updated_at): bump the tokens so
      // a replay of this request after a lost response is a 409, not a second copy
      for (const item of ordered) {
        const original =
          item.kind === 'content' ? scope.contents.get(item.id)! : scope.sections.get(item.id)!
        original.updatedAt = DateTime.now()
        await original.save()
      }
      const ids = sorted(created)
      return {
        auditAction: 'course.bulk.duplicate',
        extraMetadata: { createdSectionIds: ids.sectionIds, createdContentIds: ids.contentIds },
        affected: created,
        touchedParents,
        touchedSections,
      }
    })
  }

  /**
   * Move the selection to the trash under one batch (D-03): a selected section
   * takes its whole subtree, selected or not. `deleted` lists every row that
   * left the live tree. Remaining siblings are not renumbered (gaps are fine).
   */
  async destroy(ctx: HttpContext) {
    const userId = ctx.auth.user!.id
    return this.run(ctx, bulkDeleteValidator, async (trx, scope) => {
      const roots = idsOf(topLevelItems(scope))
      const { batch, deleted } = await TrashService.trash(trx, scope.courseId, roots, userId)
      return {
        auditAction: 'course.bulk.delete',
        extraMetadata: { batch, ...deleted },
        affected: emptyIds(),
        deleted,
        batch,
      }
    })
  }

  /**
   * Read-only: how many learners have progress on the given contents of this
   * course. The delete dialogs show it before the teacher confirms.
   */
  async deleteImpact({ params, request, response, bouncer }: HttpContext) {
    const course = await Course.findOrFail(params.id)
    await bouncer.with('CoursePolicy').authorize('edit', course)
    const { contentIds } = await request.validateUsing(deleteImpactValidator)
    if (contentIds.length === 0) return response.json({ learners: 0 })

    const row = await db
      .from('content_progresses')
      .whereIn(
        'content_id',
        db
          .from('course_contents') // trash-ok: counts trashed ids on purpose (permanent-delete confirmation)
          .select('id')
          .whereIn('id', contentIds)
          .whereIn(
            'module_id',
            db.from('course_modules').select('id').where('course_id', course.id) // trash-ok: same course scope, trashed included
          )
      )
      .countDistinct('user_id as learners')
      .first()
    // PostgreSQL returns counts as strings
    return response.json({ learners: Number(row?.learners ?? 0) })
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
        const result = await action(trx, scope, payload)
        // In the transaction: a failed audit write rolls the change back (committed ⇔ audited)
        await AuditService.logFromContext(
          ctx,
          {
            action: result.auditAction,
            resourceType: 'Course',
            resourceId: course.id,
            metadata: { ...idsOf(items), ...result.extraMetadata },
          },
          trx
        )
        return result
      })
    } catch (error) {
      // Outside the callback: PostgreSQL aborts the transaction on errors
      if (error instanceof BulkRefusal) return response.status(error.status).json(error.body)
      throw error
    }

    const structure = await loadBuilderStructure(course.id)
    return response.json({
      ...structure,
      affected: withRenumbered(outcome, structure),
      deleted: sorted(outcome.deleted ?? emptyIds()),
      batch: outcome.batch,
    })
  }
}
