import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import AppSetting from '#models/app_setting'
import Course from '#models/course'
import TrashService from '#services/trash_service'
import TrashPurgeService from '#services/trash_purge_service'
import { loadBuilderStructure } from '../helpers/builder_props.js'
import { moveTargets } from '../../inertia/lib/builder_tree.js'

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

  async restore({ params, response, bouncer }: HttpContext) {
    await bouncer.with('CoursePolicy').authorize('edit', await Course.findOrFail(params.id))
    return response.notImplemented()
  }

  async restoreBatch({ params, response, bouncer }: HttpContext) {
    await bouncer.with('CoursePolicy').authorize('edit', await Course.findOrFail(params.id))
    return response.notImplemented()
  }

  async destroy({ params, response, bouncer }: HttpContext) {
    await bouncer.with('CoursePolicy').authorize('emptyTrash', await Course.findOrFail(params.id))
    return response.notImplemented()
  }

  async empty({ params, response, bouncer }: HttpContext) {
    await bouncer.with('CoursePolicy').authorize('emptyTrash', await Course.findOrFail(params.id))
    return response.notImplemented()
  }
}
