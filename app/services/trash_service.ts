import { randomUUID } from 'node:crypto'
import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import CourseStructureService from '#services/course_structure_service'
import { loadBuilderStructure } from '../helpers/builder_props.js'
import { BulkRefusal, PIVOT_CHUNK, sorted, type Ids, type Outcome } from '../helpers/builder_ids.js'

export type TrashedRow = {
  kind: 'section' | 'content'
  id: number
  title: string
  type: string | null
  /** `parent_id` for a section, `module_id` for a content. */
  parentId: number | null
  order: number
  deletedAt: DateTime
  batch: string
  deletedById: number | null
}

export type RestoreTarget = { kind: 'section' | 'content'; id: number }
export type RestoreOptions = { withSection?: boolean; moduleId?: number }
export type RestoreResult = {
  outcome: Outcome
  title: string
  batch: string
  sectionIds: number[]
  contentIds: number[]
  /** The content's section, restored first by `withSection`. */
  restoredSection: { id: number; title: string } | null
  /** The live section chosen with `moduleId`. */
  destination: { id: number; title: string } | null
  /** A section went to the end of the root sections instead of its original place. */
  fallback: boolean
}

const nullableNumber = (value: unknown) => (value === null ? null : Number(value))

const notInTrash = () =>
  new BulkRefusal(404, {
    code: 'E_NOT_IN_TRASH',
    message: "Cet élément n'est plus dans la corbeille.",
  })

/** Live rows sorting before the stored `(order, id)` of `row`: its original index among them. */
const positionAmong = (siblings: { id: number; order: number }[], row: TrashedRow) =>
  siblings.filter((s) => s.order < row.order || (s.order === row.order && s.id < row.id)).length

/** `primary` keeps its title, batch and destination; ids and touched lists are unioned. */
function combine(primary: RestoreResult, other: RestoreResult): RestoreResult {
  const union = <T>(a: T[] = [], b: T[] = []) => [...new Set([...a, ...b])]
  const ids = sorted({
    sectionIds: [...primary.sectionIds, ...other.sectionIds],
    contentIds: [...primary.contentIds, ...other.contentIds],
  })
  return {
    ...primary,
    ...ids,
    outcome: {
      ...primary.outcome,
      affected: ids,
      touchedParents: union(primary.outcome.touchedParents, other.outcome.touchedParents),
      touchedSections: union(primary.outcome.touchedSections, other.outcome.touchedSections),
    },
    restoredSection: primary.restoredSection ?? other.restoredSection,
    destination: primary.destination ?? other.destination,
    fallback: primary.fallback || other.fallback,
  }
}

/**
 * The builder trash (D-01, D-07). Raw trx.from() reads/writes on purpose: the
 * model hooks hide trashed rows.
 */
export default class TrashService {
  /**
   * Moves `roots` and their whole live subtree to the trash under one new batch.
   * Keeps `order`, progress and file pivots; conflict tokens stay as they are, no renumbering.
   * Rows already trashed are left as they are.
   */
  static async trash(
    trx: TransactionClientContract,
    courseId: number,
    roots: Ids,
    userId: number
  ): Promise<{ batch: string; deleted: Ids }> {
    const structure = await loadBuilderStructure(courseId, trx)
    const childrenOf = new Map<number, number[]>()
    for (const s of structure.sections) {
      if (s.parentId !== null)
        childrenOf.set(s.parentId, [...(childrenOf.get(s.parentId) ?? []), s.id])
    }
    const contentsOf = new Map<number, number[]>()
    for (const c of structure.contents) {
      contentsOf.set(c.moduleId, [...(contentsOf.get(c.moduleId) ?? []), c.id])
    }

    const liveSections = new Set(structure.sections.map((s) => s.id))
    const liveContents = new Set(structure.contents.map((c) => c.id))
    const sectionIds = new Set<number>()
    const contentIds = new Set(roots.contentIds.filter((id) => liveContents.has(id)))
    const stack = roots.sectionIds.filter((id) => liveSections.has(id))
    while (stack.length > 0) {
      const s = stack.pop()!
      if (sectionIds.has(s)) continue
      sectionIds.add(s)
      for (const c of contentsOf.get(s) ?? []) contentIds.add(c)
      stack.push(...(childrenOf.get(s) ?? []))
    }

    const batch = randomUUID()
    const values = {
      deleted_at: this.toDbDateTime(DateTime.now(), trx),
      deleted_batch: batch,
      deleted_by_id: userId,
    }
    await this.inChunks([...sectionIds], (chunk) =>
      trx.from('course_modules').whereIn('id', chunk).whereNull('deleted_at').update(values)
    )
    await this.inChunks([...contentIds], (chunk) =>
      trx.from('course_contents').whereIn('id', chunk).whereNull('deleted_at').update(values)
    )

    return { batch, deleted: sorted({ sectionIds: [...sectionIds], contentIds: [...contentIds] }) }
  }

  /**
   * Restores `target` with the rows of its batch below it (D-07), at its original
   * place (D-06), or at the end of the root sections when that place is gone or too
   * deep. A content whose section is trashed needs `withSection` or `moduleId` (D-05).
   * Precondition: the caller holds the course-row lock; refusals throw so the transaction rolls back.
   */
  static async restore(
    trx: TransactionClientContract,
    courseId: number,
    target: RestoreTarget,
    options: RestoreOptions = {}
  ): Promise<RestoreResult> {
    const rows = await this.trashedRows(trx, courseId)
    const row = rows.find((r) => r.kind === target.kind && r.id === target.id)
    if (!row) throw notInTrash()
    return row.kind === 'section'
      ? this.restoreSection(trx, courseId, row, rows)
      : this.restoreContent(trx, courseId, row, options)
  }

  /** Every root of `batch` (the builder undo), all or nothing. */
  static async restoreBatch(
    trx: TransactionClientContract,
    courseId: number,
    batch: string
  ): Promise<RestoreResult> {
    const roots = this.rootsOf(await this.trashedRows(trx, courseId))
      .filter((r) => r.batch === batch)
      // Ascending stored order: each position counts the siblings restored before it
      .sort((a, b) => a.order - b.order || a.id - b.id)
    if (roots.length === 0) throw notInTrash()
    let result: RestoreResult | null = null
    for (const root of roots) {
      const restored = await this.restore(trx, courseId, root)
      result = result ? combine(result, restored) : restored
    }
    return result!
  }

  private static async restoreSection(
    trx: TransactionClientContract,
    courseId: number,
    row: TrashedRow,
    rows: TrashedRow[]
  ): Promise<RestoreResult> {
    const sectionIds = [row.id]
    const contentIds: number[] = []
    for (let i = 0; i < sectionIds.length; i++) {
      for (const r of rows) {
        if (r.batch !== row.batch || r.parentId !== sectionIds[i]) continue
        ;(r.kind === 'section' ? sectionIds : contentIds).push(r.id)
      }
    }

    const parentLive =
      row.parentId === null ||
      (await CourseModule.query({ client: trx })
        .where('id', row.parentId)
        .where('course_id', courseId)
        .first()) !== null
    let position = 0
    if (parentLive) {
      const siblings = CourseModule.query({ client: trx }).where('course_id', courseId)
      if (row.parentId === null) siblings.whereNull('parent_id')
      else siblings.where('parent_id', row.parentId)
      position = positionAmong(await siblings, row)
    }

    // Cleared first so the depth check counts the restored sub-sections
    await this.clear(trx, sectionIds, contentIds)
    const module = await CourseModule.query({ client: trx }).where('id', row.id).firstOrFail()
    let moved = parentLive
      ? await CourseStructureService.moveModule(trx, courseId, module, row.parentId, position)
      : null
    const fallback = !moved?.ok
    if (fallback) {
      moved = await CourseStructureService.moveModule(
        trx,
        courseId,
        module,
        null,
        Number.MAX_SAFE_INTEGER
      )
    }
    if (!moved!.ok) throw new BulkRefusal(422, { code: moved!.code, message: moved!.message })

    return this.result(row, sectionIds, contentIds, {
      touchedParents: [...new Set([row.parentId, moved!.toParentId])],
      fallback,
    })
  }

  private static async restoreContent(
    trx: TransactionClientContract,
    courseId: number,
    row: TrashedRow,
    options: RestoreOptions
  ): Promise<RestoreResult> {
    const sectionId = row.parentId!
    let moduleId = sectionId
    let position = Number.MAX_SAFE_INTEGER
    let destination: RestoreResult['destination'] = null
    let withSection: RestoreResult | null = null
    let restoredSection: RestoreResult['restoredSection'] = null

    if (options.moduleId !== undefined) {
      // A trashed or foreign section is hidden here; moveContent then refuses it
      moduleId = options.moduleId
      const dest = await CourseModule.query({ client: trx })
        .where('id', moduleId)
        .where('course_id', courseId)
        .first()
      destination = dest && { id: dest.id, title: dest.title }
    } else {
      // trashedRows already scoped the content to the course through this section
      const section = await trx.from('course_modules').where('id', sectionId).firstOrFail()
      if (section.deleted_at !== null) {
        restoredSection = { id: sectionId, title: section.title as string }
        if (!options.withSection) {
          throw new BulkRefusal(409, {
            code: 'E_PARENT_TRASHED',
            section: restoredSection,
            message:
              'La section de ce contenu est dans la corbeille. Restaurez-la ou choisissez une autre section.',
          })
        }
        withSection = await this.restore(trx, courseId, { kind: 'section', id: sectionId })
        // Same batch: the section brought the content back already
        if (withSection.contentIds.includes(row.id)) {
          return { ...withSection, title: row.title, restoredSection }
        }
      }
      const siblings = await CourseContent.query({ client: trx }).where('module_id', sectionId)
      position = positionAmong(siblings, row)
    }

    await this.clear(trx, [], [row.id])
    const content = await CourseContent.query({ client: trx }).where('id', row.id).firstOrFail()
    const moved = await CourseStructureService.moveContent(
      trx,
      courseId,
      content,
      moduleId,
      position
    )
    if (!moved.ok) throw new BulkRefusal(422, { code: moved.code, message: moved.message })

    const result = this.result(row, [], [row.id], {
      touchedSections: [...new Set([sectionId, moduleId])],
      destination,
    })
    return withSection ? { ...combine(result, withSection), restoredSection } : result
  }

  private static result(
    row: TrashedRow,
    sectionIds: number[],
    contentIds: number[],
    extra: Pick<Outcome, 'touchedParents' | 'touchedSections'> &
      Partial<Pick<RestoreResult, 'destination' | 'fallback'>>
  ): RestoreResult {
    const ids = sorted({ sectionIds, contentIds })
    return {
      outcome: {
        auditAction: 'course.trash.restore',
        affected: ids,
        batch: row.batch,
        touchedParents: extra.touchedParents ?? [],
        touchedSections: extra.touchedSections ?? [],
      },
      title: row.title,
      batch: row.batch,
      ...ids,
      restoredSection: null,
      destination: extra.destination ?? null,
      fallback: extra.fallback ?? false,
    }
  }

  /** Back to live with a fresh conflict token (the move's save() writes nothing in place). */
  private static async clear(
    trx: TransactionClientContract,
    sectionIds: number[],
    contentIds: number[]
  ) {
    const values = {
      deleted_at: null,
      deleted_batch: null,
      deleted_by_id: null,
      updated_at: this.toDbDateTime(DateTime.now(), trx),
    }
    await this.inChunks(sectionIds, (chunk) =>
      trx.from('course_modules').whereIn('id', chunk).update(values)
    )
    await this.inChunks(contentIds, (chunk) =>
      trx.from('course_contents').whereIn('id', chunk).update(values)
    )
  }

  private static async inChunks(ids: number[], run: (chunk: number[]) => Promise<unknown>) {
    for (let i = 0; i < ids.length; i += PIVOT_CHUNK) await run(ids.slice(i, i + PIVOT_CHUNK))
  }

  /** Every trashed section and content of the course, any batch. */
  static async trashedRows(client: QueryClientContract, courseId: number): Promise<TrashedRow[]> {
    const sections = await client
      .from('course_modules')
      .where('course_id', courseId)
      .whereNotNull('deleted_at')
      .select('id', 'title', 'parent_id', 'order', 'deleted_at', 'deleted_batch', 'deleted_by_id')
    const contents = await client
      .from('course_contents')
      .join('course_modules', 'course_modules.id', 'course_contents.module_id')
      .where('course_modules.course_id', courseId)
      .whereNotNull('course_contents.deleted_at')
      .select(
        'course_contents.id',
        'course_contents.title',
        'course_contents.content_type',
        'course_contents.module_id',
        'course_contents.order',
        'course_contents.deleted_at',
        'course_contents.deleted_batch',
        'course_contents.deleted_by_id'
      )

    const common = (row: Record<string, any>) => ({
      id: Number(row.id),
      title: row.title as string,
      order: Number(row.order),
      deletedAt: this.fromDbDateTime(row.deleted_at),
      batch: row.deleted_batch as string,
      deletedById: nullableNumber(row.deleted_by_id),
    })
    return [
      ...sections.map((row) => ({
        ...common(row),
        kind: 'section' as const,
        type: null,
        parentId: nullableNumber(row.parent_id),
      })),
      ...contents.map((row) => ({
        ...common(row),
        kind: 'content' as const,
        type: row.content_type as string,
        parentId: Number(row.module_id),
      })),
    ]
  }

  /** Batch roots: trashed rows whose parent is not a trashed row of the same batch. */
  static rootsOf(rows: TrashedRow[]): TrashedRow[] {
    const batchOfSection = new Map(
      rows.filter((r) => r.kind === 'section').map((r) => [r.id, r.batch])
    )
    return rows.filter((r) => r.parentId === null || batchOfSection.get(r.parentId) !== r.batch)
  }

  /** `client`: `db` outside a transaction, `trx` inside (SQLite has one connection). */
  static async countRoots(courseId: number, client: QueryClientContract): Promise<number> {
    return this.rootsOf(await this.trashedRows(client, courseId)).length
  }

  /** Dialect format: SQLite stores and compares timestamps as text. */
  static toDbDateTime(dt: DateTime, client: QueryClientContract): string {
    return dt.toFormat(client.dialect.dateTimeFormat)
  }

  /** pg/mysql2 return a Date, SQLite a string; both read in the app zone. */
  static fromDbDateTime(value: Date | string): DateTime {
    return value instanceof Date ? DateTime.fromJSDate(value) : DateTime.fromSQL(value)
  }
}
