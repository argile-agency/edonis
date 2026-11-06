import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import AppSetting from '#models/app_setting'
import Course from '#models/course'
import AuditService from '#services/audit_service'
import FileStorageService from '#services/file_storage_service'

export type Roots = { sectionIds: number[]; contentIds: number[] }

export type PurgeResult = {
  sectionIds: number[]
  contentIds: number[]
  fileIds: number[]
  blobPaths: string[]
}

export type PurgeReport = {
  courseId: number
  sectionIds: number[]
  contentIds: number[]
  fileIds: number[]
  error?: string
}

/** Keeps every whereIn list under the SQLite bound-variable limit. */
const CHUNK = 100

async function chunked<T>(ids: number[], fn: (part: number[]) => PromiseLike<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += CHUNK) out.push(...(await fn(ids.slice(i, i + CHUNK))))
  return out
}

const sorted = (ids: Iterable<number>) => [...new Set(ids)].sort((a, b) => a - b)

/**
 * Physical deletion of trashed sections and contents (TRASH-08).
 * Shared by trash:purge (cron) and the trash page (lazy purge, D-12).
 * Raw `client.from()` reads throughout: the model hooks hide trashed rows.
 */
export default class TrashPurgeService {
  /**
   * Delete trashed roots of `courseId` and everything under them. The caller holds
   * the course lock and writes the audit row. Ids that are live or belong to another
   * course are ignored. FK cascades remove progress rows, file pivots and sub-sections;
   * `assignments.module_id` becomes NULL (grades are kept, D-08).
   */
  static async forceDelete(
    trx: TransactionClientContract,
    courseId: number,
    roots: Roots
  ): Promise<PurgeResult> {
    const modules: { id: number; parent_id: number | null; deleted_at: unknown }[] = await trx
      .from('course_modules')
      .where('course_id', courseId)
      .select('id', 'parent_id', 'deleted_at')
    const byId = new Map(modules.map((m) => [Number(m.id), m]))
    const childrenOf = new Map<number, number[]>()
    for (const m of modules) {
      if (m.parent_id === null) continue
      const parent = Number(m.parent_id)
      childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), Number(m.id)])
    }

    const sectionIds = new Set<number>()
    for (const rootId of roots.sectionIds) {
      const root = byId.get(rootId)
      if (!root || root.deleted_at === null || sectionIds.has(rootId)) continue

      const subtree: number[] = []
      const stack = [rootId]
      while (stack.length > 0) {
        const id = stack.pop()!
        subtree.push(id)
        stack.push(...(childrenOf.get(id) ?? []))
      }
      const liveSection = subtree.some((id) => byId.get(id)!.deleted_at === null)
      const liveContent = await chunked(subtree, (part) =>
        trx.from('course_contents').whereIn('module_id', part).whereNull('deleted_at').select('id')
      )
      if (liveSection || liveContent.length > 0) {
        // Cannot happen while trash takes whole subtrees; refusing beats cascading live data away
        logger.warn({ courseId, sectionId: rootId }, 'trash purge: section has live descendants')
        continue
      }
      for (const id of subtree) sectionIds.add(id)
    }

    const underSections = await chunked([...sectionIds], (part) =>
      trx.from('course_contents').whereIn('module_id', part).select('id')
    )
    const rootContents = await chunked(roots.contentIds, (part) =>
      trx
        .from('course_contents')
        .join('course_modules', 'course_modules.id', 'course_contents.module_id')
        .where('course_modules.course_id', courseId)
        .whereIn('course_contents.id', part)
        .whereNotNull('course_contents.deleted_at')
        .select('course_contents.id')
    )
    const contentIds = sorted([...underSections, ...rootContents].map((r) => Number(r.id)))

    // Read before deleting: the content delete cascades the pivots away
    const pivots = await chunked(contentIds, (part) =>
      trx
        .from('content_content_files')
        .whereIn('course_content_id', part)
        .distinct('content_file_id')
    )
    const candidates = sorted(pivots.map((p) => Number(p.content_file_id)))

    await chunked(contentIds, async (part) => {
      await trx.from('course_contents').whereIn('id', part).delete()
      return []
    })
    await chunked([...sectionIds], async (part) => {
      await trx.from('course_modules').whereIn('id', part).delete()
      return []
    })

    // shortcut: an upload of the same bytes can reuse a row between this select and its
    // delete; its pivot insert then fails on the FK and the user retries. Lock if it shows up.
    const unreferenced = (q: any) =>
      q
        .from('content_content_files')
        .whereColumn('content_content_files.content_file_id', 'content_files.id')
    const orphans: { id: number; storage_path: string }[] = await chunked(candidates, (part) =>
      trx
        .from('content_files')
        .whereIn('id', part)
        .whereNotExists(unreferenced)
        .select('id', 'storage_path')
    )
    const fileIds = sorted(orphans.map((o) => Number(o.id)))
    await chunked(fileIds, async (part) => {
      await trx.from('content_files').whereIn('id', part).whereNotExists(unreferenced).delete()
      return []
    })

    return {
      sectionIds: sorted(sectionIds),
      contentIds,
      fileIds,
      blobPaths: orphans.map((o) => o.storage_path),
    }
  }

  /**
   * Unlink blobs of deleted content_files rows. Call after commit only: a rollback
   * would leave rows pointing at deleted files.
   */
  static async removeBlobs(blobPaths: string[], storage = new FileStorageService()): Promise<void> {
    for (const path of blobPaths) await storage.deleteBlob(path)
  }

  private static cutoff(client: QueryClientContract, retentionDays: number, now: DateTime) {
    // Cutoff computed in the app, in the dialect's format: SQLite compares strings
    return now.minus({ days: retentionDays }).toFormat(client.dialect.dateTimeFormat)
  }

  /**
   * Trashed sections and contents of a course whose deleted_at is older than the window.
   */
  static async expiredRoots(
    client: QueryClientContract,
    courseId: number,
    retentionDays: number,
    now: DateTime = DateTime.now()
  ): Promise<Roots> {
    const cutoff = this.cutoff(client, retentionDays, now)
    const sections = await client
      .from('course_modules')
      .where('course_id', courseId)
      .whereNotNull('deleted_at')
      .where('deleted_at', '<', cutoff)
      .select('id')
    const contents = await client
      .from('course_contents')
      .join('course_modules', 'course_modules.id', 'course_contents.module_id')
      .where('course_modules.course_id', courseId)
      .whereNotNull('course_contents.deleted_at')
      .where('course_contents.deleted_at', '<', cutoff)
      .select('course_contents.id')
    return {
      sectionIds: sorted(sections.map((r) => Number(r.id))),
      contentIds: sorted(contents.map((r) => Number(r.id))),
    }
  }

  /**
   * Courses holding at least one expired section or content.
   */
  static async expiredCourseIds(
    client: QueryClientContract,
    retentionDays: number,
    now: DateTime = DateTime.now()
  ): Promise<number[]> {
    const cutoff = this.cutoff(client, retentionDays, now)
    const sections = await client
      .from('course_modules')
      .whereNotNull('deleted_at')
      .where('deleted_at', '<', cutoff)
      .distinct('course_id')
    const contents = await client
      .from('course_contents')
      .join('course_modules', 'course_modules.id', 'course_contents.module_id')
      .whereNotNull('course_contents.deleted_at')
      .where('course_contents.deleted_at', '<', cutoff)
      .distinct('course_modules.course_id')
    return sorted([...sections, ...contents].map((r) => Number(r.course_id)))
  }

  /**
   * Purge expired items, one transaction per course so one failure does not block the
   * others. Courses with nothing to purge get no report and no audit row (idempotent).
   */
  static async purgeExpired(options: {
    courseId?: number
    trigger: 'cli' | 'page'
    ctx?: HttpContext
    dryRun?: boolean
    now?: DateTime
    storage?: FileStorageService
  }): Promise<PurgeReport[]> {
    const now = options.now ?? DateTime.now()
    const settings = await AppSetting.getOrCreateActive()
    const retentionDays = settings.trashRetentionDays
    const courseIds =
      options.courseId === undefined
        ? await this.expiredCourseIds(db.connection(), retentionDays, now)
        : [options.courseId]

    const reports: PurgeReport[] = []
    for (const courseId of courseIds) {
      try {
        const result = await this.purgeCourse(courseId, retentionDays, now, options)
        if (result.sectionIds.length + result.contentIds.length === 0) continue
        reports.push({
          courseId,
          sectionIds: result.sectionIds,
          contentIds: result.contentIds,
          fileIds: result.fileIds,
        })
      } catch (error) {
        logger.error({ err: error, courseId }, 'trash purge failed')
        reports.push({
          courseId,
          sectionIds: [],
          contentIds: [],
          fileIds: [],
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return reports
  }

  private static async purgeCourse(
    courseId: number,
    retentionDays: number,
    now: DateTime,
    options: {
      trigger: 'cli' | 'page'
      ctx?: HttpContext
      dryRun?: boolean
      storage?: FileStorageService
    }
  ): Promise<PurgeResult> {
    const trx = await db.transaction()
    let result: PurgeResult
    try {
      await Course.query({ client: trx }).where('id', courseId).forUpdate().first()
      const roots = await this.expiredRoots(trx, courseId, retentionDays, now)
      result = await this.forceDelete(trx, courseId, roots)

      // A dry run deletes inside the transaction and rolls back: the report includes cascades
      if (options.dryRun) {
        await trx.rollback()
        return result
      }
      if (result.sectionIds.length + result.contentIds.length > 0) {
        const audit = {
          action: 'course.trash.purge',
          resourceType: 'Course',
          resourceId: courseId,
          metadata: {
            courseId,
            trigger: options.trigger,
            sectionIds: result.sectionIds,
            contentIds: result.contentIds,
            fileIds: result.fileIds,
          },
        }
        // In the transaction: committed ⇔ audited
        if (options.ctx) await AuditService.logFromContext(options.ctx, audit, trx)
        else await AuditService.log({ ...audit, userId: null }, trx)
      }
      await trx.commit()
    } catch (error) {
      if (!trx.isCompleted) await trx.rollback()
      throw error
    }

    await this.removeBlobs(result.blobPaths, options.storage)
    return result
  }
}
