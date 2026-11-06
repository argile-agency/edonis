import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppSetting from '#models/app_setting'
import Course from '#models/course'
import CourseContent from '#models/course_content'
import CourseModule from '#models/course_module'
import AuditService from '#services/audit_service'
import TrashService, { type RestoreResult } from '#services/trash_service'
import TrashPurgeService from '#services/trash_purge_service'
import { restoreBatchValidator, restoreValidator, trashItemValidator } from '#validators/trash'
import { loadBuilderStructure } from '../helpers/builder_props.js'
import { BulkRefusal, emptyIds, withRenumbered } from '../helpers/builder_ids.js'
import { moveTargets } from '../../inertia/lib/builder_tree.js'

/** Same negotiation as the exception handler: Inertia and no Accept header resolve to html. */
function wantsJson(request: HttpContext['request']): boolean {
  return request.accepts(['html', 'json']) === 'json'
}

const notInTrash = () =>
  new BulkRefusal(404, {
    code: 'E_NOT_IN_TRASH',
    message: "Cet élément n'est plus dans la corbeille.",
  })

/** The success flash of a restore (UI-SPEC copywriting). */
function restoredMessage(result: RestoreResult): string {
  const title = `« ${result.title} »`
  if (result.fallback) {
    return `${title} a été restauré à la fin du cours : sa section d'origine n'existe plus ou n'accepte plus de sous-section.`
  }
  if (result.destination) return `${title} a été restauré dans « ${result.destination.title} ».`
  if (result.restoredSection) {
    return `${title} et la section « ${result.restoredSection.title} » ont été restaurés.`
  }
  return `${title} a été restauré.`
}

/**
 * The course trash (phase 05.2): list, restore, permanent delete. Editors see and
 * restore; only the owner and admins delete for good (D-09, D-10).
 */
export default class TrashController {
  async index(ctx: HttpContext) {
    const { params, inertia, bouncer } = ctx
    const course = await Course.findOrFail(params.id)
    await bouncer.with('CoursePolicy').authorize('edit', course)

    // D-12: expired rows go before the list; a failed purge must not break the page
    try {
      await TrashPurgeService.purgeExpired({ courseId: course.id, trigger: 'page', ctx })
    } catch (error) {
      logger.error({ err: error, courseId: course.id }, 'trash page: lazy purge failed')
    }

    const { trashRetentionDays: retentionDays } = await AppSetting.getOrCreateActive()
    const rows = await TrashService.list(course.id, retentionDays, db.connection())
    const { sections, contents } = await loadBuilderStructure(course.id)

    return inertia.render('courses/trash', {
      course: { id: course.id, title: course.title },
      rows,
      retentionDays,
      moveTargets: moveTargets(sections, contents, { kind: 'content', id: 0 }),
      permissions: { canPurge: await bouncer.with('CoursePolicy').allows('emptyTrash', course) },
    })
  }

  async restore(ctx: HttpContext) {
    const { params, request, bouncer } = ctx
    const course = await Course.findOrFail(params.id)
    await bouncer.with('CoursePolicy').authorize('edit', course)
    const { kind, id, withSection, moduleId } = await request.validateUsing(restoreValidator)

    const result = await this.locked(course.id, async (trx) => {
      const restored = await TrashService.restore(
        trx,
        course.id,
        { kind, id },
        { withSection, moduleId }
      )
      const placed =
        kind === 'section'
          ? await CourseModule.query({ client: trx }).where('id', id).firstOrFail()
          : await CourseContent.query({ client: trx }).where('id', id).firstOrFail()
      await AuditService.logFromContext(
        ctx,
        {
          action: 'course.trash.restore',
          resourceType: 'Course',
          resourceId: course.id,
          metadata: {
            courseId: course.id,
            batch: restored.batch,
            sectionIds: restored.sectionIds,
            contentIds: restored.contentIds,
            toParentId: placed instanceof CourseModule ? placed.parentId : placed.moduleId,
            fallback: restored.fallback,
          },
        },
        trx
      )
      return restored
    })
    return this.answerRestore(ctx, course.id, result)
  }

  /** The builder undo (05.2-05): every root of one batch, all or nothing. */
  async restoreBatch(ctx: HttpContext) {
    const { params, request, bouncer } = ctx
    const course = await Course.findOrFail(params.id)
    await bouncer.with('CoursePolicy').authorize('edit', course)
    const { batch } = await request.validateUsing(restoreBatchValidator)

    const result = await this.locked(course.id, async (trx) => {
      const restored = await TrashService.restoreBatch(trx, course.id, batch)
      await AuditService.logFromContext(
        ctx,
        {
          action: 'course.trash.restore',
          resourceType: 'Course',
          resourceId: course.id,
          metadata: {
            courseId: course.id,
            batch,
            sectionIds: restored.sectionIds,
            contentIds: restored.contentIds,
            fallback: restored.fallback,
          },
        },
        trx
      )
      return restored
    })
    return this.answerRestore(ctx, course.id, result)
  }

  /** Permanent delete of one trash row and everything under it (TRASH-08). */
  async destroy(ctx: HttpContext) {
    const { params, request, response, session, bouncer } = ctx
    const course = await Course.findOrFail(params.id)
    await bouncer.with('CoursePolicy').authorize('emptyTrash', course)
    const { kind, id } = await request.validateUsing(trashItemValidator)

    const result = await this.locked(course.id, async (trx) => {
      const rows = await TrashService.trashedRows(trx, course.id)
      const row = rows.find((r) => r.kind === kind && r.id === id)
      if (!row) throw notInTrash()
      const purged = await TrashPurgeService.forceDelete(trx, course.id, {
        sectionIds: kind === 'section' ? [id] : [],
        contentIds: kind === 'content' ? [id] : [],
      })
      await AuditService.logFromContext(
        ctx,
        {
          action: 'course.trash.delete',
          resourceType: 'Course',
          resourceId: course.id,
          metadata: {
            courseId: course.id,
            sectionIds: purged.sectionIds,
            contentIds: purged.contentIds,
            fileIds: purged.fileIds,
          },
        },
        trx
      )
      return { title: row.title, purged }
    })
    if (result instanceof BulkRefusal) return this.refuse(ctx, result)

    // After commit: a rollback would leave rows pointing at deleted files
    await TrashPurgeService.removeBlobs(result.purged.blobPaths)
    if (wantsJson(request)) return response.json({ deleted: result.purged })
    session.flash('success', `« ${result.title} » a été supprimé définitivement.`)
    return response.redirect().back()
  }

  /** Permanent delete of every trash row of the course. */
  async empty(ctx: HttpContext) {
    const { params, request, response, session, bouncer } = ctx
    const course = await Course.findOrFail(params.id)
    await bouncer.with('CoursePolicy').authorize('emptyTrash', course)

    const result = await this.locked(course.id, async (trx) => {
      const roots = TrashService.rootsOf(await TrashService.trashedRows(trx, course.id))
      const purged = await TrashPurgeService.forceDelete(trx, course.id, {
        sectionIds: roots.filter((r) => r.kind === 'section').map((r) => r.id),
        contentIds: roots.filter((r) => r.kind === 'content').map((r) => r.id),
      })
      await AuditService.logFromContext(
        ctx,
        {
          action: 'course.trash.empty',
          resourceType: 'Course',
          resourceId: course.id,
          metadata: {
            courseId: course.id,
            sectionIds: purged.sectionIds,
            contentIds: purged.contentIds,
            fileIds: purged.fileIds,
          },
        },
        trx
      )
      return purged
    })
    if (result instanceof BulkRefusal) return this.refuse(ctx, result)

    await TrashPurgeService.removeBlobs(result.blobPaths)
    if (wantsJson(request)) return response.json({ deleted: result })
    session.flash('success', 'Corbeille vidée.')
    return response.redirect().back()
  }

  /** One transaction under the course-row lock; a refusal rolls back and is returned. */
  private async locked<T>(
    courseId: number,
    work: (trx: TransactionClientContract) => Promise<T>
  ): Promise<T | BulkRefusal> {
    try {
      return await db.transaction(async (trx) => {
        await Course.query({ client: trx }).where('id', courseId).forUpdate().first()
        // In the transaction: a failed audit write rolls the change back (committed ⇔ audited)
        return work(trx)
      })
    } catch (error) {
      // Outside the callback: PostgreSQL aborts the transaction on errors
      if (error instanceof BulkRefusal) return error
      throw error
    }
  }

  private refuse({ request, response, session }: HttpContext, error: BulkRefusal) {
    if (wantsJson(request)) return response.status(error.status).json(error.body)
    session.flash('error', String(error.body.message))
    return response.redirect().back()
  }

  /** JSON: the bulk shape of the builder (`mergeBulkResult`); HTML: back with the flash. */
  private async answerRestore(
    ctx: HttpContext,
    courseId: number,
    result: RestoreResult | BulkRefusal
  ) {
    if (result instanceof BulkRefusal) return this.refuse(ctx, result)
    const { request, response, session } = ctx
    if (wantsJson(request)) {
      const structure = await loadBuilderStructure(courseId)
      return response.json({
        ...structure,
        affected: withRenumbered(result.outcome, structure),
        deleted: emptyIds(),
      })
    }
    session.flash('success', restoredMessage(result))
    return response.redirect().back()
  }
}
