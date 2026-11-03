import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Course from '#models/course'
import CourseModule from '#models/course_module'
import CourseContent from '#models/course_content'
import ContentProgress from '#models/content_progress'
import {
  createModuleValidator,
  updateModuleValidator,
  createContentValidator,
  updateContentValidator,
  reorderModulesValidator,
  reorderContentsValidator,
  updateProgressValidator,
  learnQueryValidator,
  moveContentValidator,
  moveModuleValidator,
} from '#validators/course_content'
import AuditService from '#services/audit_service'
import CourseStructureService, {
  CONFLICT_ERROR,
  DEPTH_ERROR,
  MAX_SECTION_DEPTH,
  PARENT_ERROR,
  sameSecond,
} from '#services/course_structure_service'
import { depthOf } from '../helpers/category_tree.js'
import { loadBuilderStructure } from '../helpers/builder_props.js'

const NOT_EMPTY_ERROR = "Déplacez ou supprimez d'abord son contenu."
const DATE_ORDER_ERROR = 'La date de fin doit être postérieure à la date de début.'
const DATE_ORDER_BODY = { errors: [{ field: 'availableUntil', message: DATE_ORDER_ERROR }] }

/** Same negotiation as the exception handler: Inertia and no Accept header resolve to html. */
function wantsJson(request: HttpContext['request']): boolean {
  return request.accepts(['html', 'json']) === 'json'
}

type Dated = { availableFrom: DateTime | null; availableUntil: DateTime | null }

/**
 * Maps incoming availability dates (undefined = untouched, null = cleared) and
 * checks the resulting range against the stored values. Null when start > end.
 */
function availability(
  stored: Dated,
  from: Date | null | undefined,
  until: Date | null | undefined
): Partial<Dated> | null {
  const changes: Partial<Dated> = {}
  if (from !== undefined) changes.availableFrom = from ? DateTime.fromJSDate(from) : null
  if (until !== undefined) changes.availableUntil = until ? DateTime.fromJSDate(until) : null
  const start = from === undefined ? stored.availableFrom : changes.availableFrom
  const end = until === undefined ? stored.availableUntil : changes.availableUntil
  return start && end && start > end ? null : changes
}

/** 409 body; attributes only, so preloaded relations are not sent back. */
function conflictBody(row: CourseModule | CourseContent) {
  return { code: 'E_CONFLICT', message: CONFLICT_ERROR, item: row.serializeAttributes() }
}

function savedItem(row: CourseModule | CourseContent) {
  return { id: row.id, updatedAt: row.updatedAt?.toISO() ?? null }
}

export default class CourseContentsController {
  /**
   * Display course content builder for instructors
   */
  async builder({ inertia, params, bouncer }: HttpContext) {
    const course = await Course.findOrFail(params.id)
    await bouncer.with('CoursePolicy').authorize('edit', course)

    const { sections, contents } = await loadBuilderStructure(course.id)
    return inertia.render('courses/builder', {
      course: { id: course.id, title: course.title, code: course.code },
      sections,
      contents,
    })
  }

  /**
   * Display course player/viewer for students
   */
  async learn({ inertia, params, auth, response, request, bouncer }: HttpContext) {
    const user = auth.user!
    const { content: contentId } = await request.validateUsing(learnQueryValidator)

    const course = await Course.query()
      .where('id', params.id)
      .preload('modules', (moduleQuery) => {
        moduleQuery
          .where('is_published', true)
          .whereNull('parent_id')
          .orderBy('order', 'asc')
          .preload('children', (childQuery) => {
            childQuery
              .where('is_published', true)
              .orderBy('order', 'asc')
              .preload('contents', (contentQuery) => {
                contentQuery.where('is_published', true).orderBy('order', 'asc')
              })
          })
          .preload('contents', (contentQuery) => {
            contentQuery.where('is_published', true).orderBy('order', 'asc')
          })
      })
      .firstOrFail()

    // Not allowed to learn: back to the course page (enrolment happens there)
    if (await bouncer.with('CoursePolicy').denies('learn', course)) {
      return response.redirect().toRoute('courses.show', { id: course.id })
    }

    // Get current content or first available content
    let currentContent: CourseContent | null = null
    if (contentId) {
      // Scoped to this course: another course's content id is a 404
      currentContent = await CourseContent.query()
        .where('id', contentId)
        .where('is_published', true)
        .whereHas('module', (moduleQuery) => moduleQuery.where('course_id', course.id))
        .firstOrFail()
    } else {
      // Find first available content
      for (const module of course.modules) {
        if (module.contents.length > 0) {
          currentContent = module.contents[0]
          break
        }
        for (const child of module.children) {
          if (child.contents.length > 0) {
            currentContent = child.contents[0]
            break
          }
        }
        if (currentContent) break
      }
    }

    // Get progress for current content
    let progress = null
    if (currentContent) {
      progress = await ContentProgress.getOrCreate(user.id, currentContent.id)
      await progress.markAsStarted()
    }

    // Get all user's progress for this course
    const allContentIds: number[] = []
    course.modules.forEach((module) => {
      module.contents.forEach((content) => allContentIds.push(content.id))
      module.children.forEach((child) => {
        child.contents.forEach((content) => allContentIds.push(content.id))
      })
    })

    const allProgress = await ContentProgress.query()
      .where('user_id', user.id)
      .whereIn('content_id', allContentIds)

    const progressMap = new Map(allProgress.map((p) => [p.contentId, p]))

    return inertia.render('courses/learn', {
      course: course.serialize(),
      modules: course.modules.map((m) => m.serialize()),
      currentContent: currentContent?.serialize(),
      progress: progress?.serialize(),
      progressMap: Object.fromEntries(progressMap.entries()),
    })
  }

  /**
   * Display course outline
   */
  async outline({ inertia, params, auth, bouncer }: HttpContext) {
    const user = auth.user!
    const course = await Course.query()
      .where('id', params.id)
      .preload('modules', (moduleQuery) => {
        moduleQuery
          .where('is_published', true)
          .whereNull('parent_id')
          .orderBy('order', 'asc')
          .preload('children', (childQuery) => {
            childQuery
              .where('is_published', true)
              .orderBy('order', 'asc')
              .preload('contents', (contentQuery) => {
                contentQuery.where('is_published', true).orderBy('order', 'asc')
              })
          })
          .preload('contents', (contentQuery) => {
            contentQuery.where('is_published', true).orderBy('order', 'asc')
          })
      })
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('learn', course)

    // Get all user's progress
    const allContentIds: number[] = []
    course.modules.forEach((module) => {
      module.contents.forEach((content) => allContentIds.push(content.id))
      module.children.forEach((child) => {
        child.contents.forEach((content) => allContentIds.push(content.id))
      })
    })

    const allProgress = await ContentProgress.query()
      .where('user_id', user.id)
      .whereIn('content_id', allContentIds)

    const progressMap = new Map(allProgress.map((p) => [p.contentId, p.serialize()]))

    return inertia.render('courses/outline', {
      course: course.serialize(),
      modules: course.modules.map((m) => m.serialize()),
      progressMap: Object.fromEntries(progressMap.entries()),
    })
  }

  // ==================== MODULE MANAGEMENT ====================

  /**
   * Create a new module
   */
  async createModule({ request, response, session, bouncer }: HttpContext) {
    const payload = await request.validateUsing(createModuleValidator)

    const course = await Course.findOrFail(payload.courseId)
    await bouncer.with('CoursePolicy').authorize('edit', course)

    // Same lock as moves and deletes: the parent cannot vanish or go deeper meanwhile
    const error = await db.transaction(async (trx) => {
      await Course.query({ client: trx }).where('id', course.id).forUpdate().first()

      const siblings = CourseModule.query({ client: trx }).where('course_id', course.id)
      if (payload.parentId) {
        // The parent must be a module of the same course
        const parent = await CourseModule.query({ client: trx })
          .where('id', payload.parentId)
          .where('course_id', course.id)
          .first()
        if (!parent) return PARENT_ERROR
        // A parent that is itself a sub-section would put this one past 2 levels (D-02)
        if (parent.parentId !== null) return DEPTH_ERROR
        siblings.where('parent_id', parent.id)
      } else {
        siblings.whereNull('parent_id')
      }

      const maxOrderResult = await siblings
        .pojo<{ maxOrder: number | null }>()
        .max('order as maxOrder')
      const maxOrder = maxOrderResult[0]?.maxOrder ?? null
      const order = payload.order ?? (maxOrder || 0) + 1

      await CourseModule.create(
        {
          ...payload,
          availableFrom: payload.availableFrom ? DateTime.fromJSDate(payload.availableFrom) : null,
          availableUntil: payload.availableUntil
            ? DateTime.fromJSDate(payload.availableUntil)
            : null,
          order,
        },
        { client: trx }
      )
      return null
    })

    if (error) {
      session.flash('error', error)
      return response.redirect().back()
    }
    session.flash('success', 'Module créé avec succès')
    return response.redirect().back()
  }

  /**
   * Update a module
   */
  async updateModule({ request, params, response, session, bouncer }: HttpContext) {
    const module = await CourseModule.query()
      .where('id', params.moduleId)
      .preload('course')
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('edit', module.course)

    const payload = await request.validateUsing(updateModuleValidator)
    const { updatedAt: expected, availableFrom, availableUntil, ...changes } = payload
    const json = wantsJson(request)

    if (expected !== undefined && !sameSecond(module.updatedAt, expected)) {
      if (json) return response.status(409).json(conflictBody(module))
      session.flash('error', CONFLICT_ERROR)
      return response.redirect().back()
    }

    const dates = availability(module, availableFrom, availableUntil)
    if (!dates) {
      if (json) return response.status(422).json(DATE_ORDER_BODY)
      session.flash('error', DATE_ORDER_ERROR)
      return response.redirect().back()
    }

    await module.merge({ ...changes, ...dates }).save()

    if (json) return response.json({ item: savedItem(module) })
    session.flash('success', 'Module mis à jour avec succès')
    return response.redirect().back()
  }

  /**
   * Move a section to `position` under `parentId` (null = course root) in the
   * same course (JSON). 409 on a stale token, 422 on a cycle, a foreign parent
   * or a depth beyond 2 levels. The only way to re-parent a section.
   */
  async moveModule(ctx: HttpContext) {
    const { params, request, response, bouncer } = ctx
    const module = await CourseModule.query()
      .where('id', params.moduleId)
      .preload('course')
      .firstOrFail()
    const course = module.course

    await bouncer.with('CoursePolicy').authorize('edit', course)

    const payload = await request.validateUsing(moveModuleValidator)

    // Every check runs before the first write, so an early return writes nothing
    const result = await db.transaction(async (trx) => {
      await Course.query({ client: trx }).where('id', course.id).forUpdate().first()

      const fresh = await CourseModule.query({ client: trx }).where('id', module.id).firstOrFail()
      if (!sameSecond(fresh.updatedAt, payload.updatedAt)) {
        const body = { code: 'E_CONFLICT', message: CONFLICT_ERROR, item: fresh.serialize() }
        return { status: 409, body, moved: null }
      }

      const outcome = await CourseStructureService.moveModule(
        trx,
        course.id,
        fresh,
        payload.parentId,
        payload.position
      )
      if (!outcome.ok) {
        return { status: 422, body: { code: outcome.code, message: outcome.message }, moved: null }
      }

      const item = { id: fresh.id, updatedAt: fresh.updatedAt?.toISO() ?? null }
      return { status: 200, body: { item }, moved: outcome }
    })

    if (result.moved) {
      await AuditService.logFromContext(ctx, {
        action: 'course.module.move',
        resourceType: 'CourseModule',
        resourceId: module.id,
        metadata: {
          courseId: course.id,
          fromParentId: result.moved.fromParentId,
          toParentId: result.moved.toParentId,
          position: result.moved.position,
        },
      })
    }

    return response.status(result.status).json(result.body)
  }

  /**
   * Delete a module
   */
  async deleteModule(ctx: HttpContext) {
    const { params, request, response, session, bouncer } = ctx
    const module = await CourseModule.query()
      .where('id', params.moduleId)
      .preload('course')
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('edit', module.course)

    // Both FKs cascade, so emptiness is checked under the course lock (D-05)
    const deleted = await db.transaction(async (trx) => {
      await Course.query({ client: trx }).where('id', module.courseId).forUpdate().first()
      const [children] = await CourseModule.query({ client: trx })
        .where('parent_id', module.id)
        .pojo<{ total: number | string }>()
        .count('* as total')
      const [contents] = await CourseContent.query({ client: trx })
        .where('module_id', module.id)
        .pojo<{ total: number | string }>()
        .count('* as total')
      if (Number(children.total) > 0 || Number(contents.total) > 0) return false
      module.useTransaction(trx)
      await module.delete()
      return true
    })

    const json = wantsJson(request)
    if (!deleted) {
      if (json) return response.status(409).json({ code: 'E_NOT_EMPTY', message: NOT_EMPTY_ERROR })
      session.flash('error', NOT_EMPTY_ERROR)
      return response.redirect().back()
    }

    await AuditService.logFromContext(ctx, {
      action: 'course.module.delete',
      resourceType: 'CourseModule',
      resourceId: module.id,
      metadata: { courseId: module.courseId, parentId: module.parentId },
    })

    if (json) return response.json({ item: { id: module.id } })
    session.flash('success', 'Module supprimé avec succès')
    return response.redirect().back()
  }

  /**
   * Reorder modules
   */
  async reorderModules({ request, params, response, session, bouncer }: HttpContext) {
    const course = await Course.findOrFail(params.id)

    await bouncer.with('CoursePolicy').authorize('edit', course)

    const payload = await request.validateUsing(reorderModulesValidator)

    // Ids outside this course match no row and are ignored
    await db.transaction(async (trx) => {
      for (const item of payload.modules) {
        await CourseModule.query({ client: trx })
          .where('id', item.id)
          .where('course_id', course.id)
          .update({ order: item.order })
      }
    })

    session.flash('success', 'Modules réordonnés avec succès')
    return response.redirect().back()
  }

  // ==================== CONTENT MANAGEMENT ====================

  /**
   * Create a new content item
   */
  async createContent({ request, response, session, bouncer }: HttpContext) {
    const payload = await request.validateUsing(createContentValidator)

    const module = await CourseModule.query()
      .where('id', payload.moduleId)
      .preload('course')
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('edit', module.course)
    const courseId = module.course.id

    // Same lock as moves and deletes: the section cannot vanish or go deeper meanwhile
    const error = await db.transaction(async (trx) => {
      await Course.query({ client: trx }).where('id', courseId).forUpdate().first()

      const section = await CourseModule.query({ client: trx })
        .where('id', module.id)
        .where('course_id', courseId)
        .first()
      if (!section) return PARENT_ERROR

      // A legacy third-level section is invisible to learners (D-02)
      const rows = await CourseModule.query({ client: trx })
        .where('course_id', courseId)
        .select('id', 'parent_id')
      const parentById = new Map(rows.map((row) => [row.id, row.parentId]))
      if (depthOf(parentById, section.id) > MAX_SECTION_DEPTH) return DEPTH_ERROR

      const maxOrderResult = await CourseContent.query({ client: trx })
        .where('module_id', section.id)
        .pojo<{ maxOrder: number | null }>()
        .max('order as maxOrder')
      const maxOrder = maxOrderResult[0]?.maxOrder ?? null
      const order = payload.order ?? (maxOrder || 0) + 1

      await CourseContent.create(
        {
          ...payload,
          availableFrom: payload.availableFrom ? DateTime.fromJSDate(payload.availableFrom) : null,
          availableUntil: payload.availableUntil
            ? DateTime.fromJSDate(payload.availableUntil)
            : null,
          dueDate: payload.dueDate ? DateTime.fromJSDate(payload.dueDate) : null,
          order,
        },
        { client: trx }
      )
      return null
    })

    if (error) {
      session.flash('error', error)
      return response.redirect().back()
    }
    session.flash('success', 'Contenu créé avec succès')
    return response.redirect().back()
  }

  /**
   * Update a content item
   */
  async updateContent({ request, params, response, session, bouncer }: HttpContext) {
    const content = await CourseContent.query()
      .where('id', params.contentId)
      .preload('module', (query) => query.preload('course'))
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('edit', content.module.course)

    const payload = await request.validateUsing(updateContentValidator)
    const { updatedAt: expected, availableFrom, availableUntil, dueDate, ...changes } = payload
    const json = wantsJson(request)

    if (expected !== undefined && !sameSecond(content.updatedAt, expected)) {
      if (json) return response.status(409).json(conflictBody(content))
      session.flash('error', CONFLICT_ERROR)
      return response.redirect().back()
    }

    const dates = availability(content, availableFrom, availableUntil)
    if (!dates) {
      if (json) return response.status(422).json(DATE_ORDER_BODY)
      session.flash('error', DATE_ORDER_ERROR)
      return response.redirect().back()
    }

    await content
      .merge({
        ...changes,
        ...dates,
        dueDate: dueDate ? DateTime.fromJSDate(dueDate) : undefined,
      })
      .save()

    if (json) return response.json({ item: savedItem(content) })
    session.flash('success', 'Contenu mis à jour avec succès')
    return response.redirect().back()
  }

  /**
   * Delete a content item
   */
  async deleteContent(ctx: HttpContext) {
    const { params, request, response, session, bouncer } = ctx
    const content = await CourseContent.query()
      .where('id', params.contentId)
      .preload('module', (query) => query.preload('course'))
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('edit', content.module.course)

    // Pivot and progress rows cascade; content_files rows and blobs may be shared, so they stay
    await content.delete()

    await AuditService.logFromContext(ctx, {
      action: 'course.content.delete',
      resourceType: 'CourseContent',
      resourceId: content.id,
      metadata: { courseId: content.module.course.id, moduleId: content.moduleId },
    })

    if (wantsJson(request)) return response.json({ item: { id: content.id } })
    session.flash('success', 'Contenu supprimé avec succès')
    return response.redirect().back()
  }

  /**
   * Move a content item to `position` in a section of the same course (JSON).
   * 409 on a stale `updatedAt` token, 422 on an invalid destination.
   */
  async moveContent(ctx: HttpContext) {
    const { params, request, response, bouncer } = ctx
    const content = await CourseContent.query()
      .where('id', params.contentId)
      .preload('module', (query) => query.preload('course'))
      .firstOrFail()
    const course = content.module.course

    await bouncer.with('CoursePolicy').authorize('edit', course)

    const payload = await request.validateUsing(moveContentValidator)

    // Every check runs before the first write, so an early return writes nothing
    const result = await db.transaction(async (trx) => {
      await Course.query({ client: trx }).where('id', course.id).forUpdate().first()

      const fresh = await CourseContent.query({ client: trx }).where('id', content.id).firstOrFail()
      if (!sameSecond(fresh.updatedAt, payload.updatedAt)) {
        const body = { code: 'E_CONFLICT', message: CONFLICT_ERROR, item: fresh.serialize() }
        return { status: 409, body, moved: null }
      }

      const outcome = await CourseStructureService.moveContent(
        trx,
        course.id,
        fresh,
        payload.moduleId,
        payload.position
      )
      if (!outcome.ok) {
        return { status: 422, body: { code: outcome.code, message: outcome.message }, moved: null }
      }

      const item = { id: fresh.id, updatedAt: fresh.updatedAt?.toISO() ?? null }
      return { status: 200, body: { item }, moved: outcome }
    })

    if (result.moved) {
      await AuditService.logFromContext(ctx, {
        action: 'course.content.move',
        resourceType: 'CourseContent',
        resourceId: content.id,
        metadata: {
          courseId: course.id,
          fromModuleId: result.moved.fromParentId,
          toModuleId: result.moved.toParentId,
          position: result.moved.position,
        },
      })
    }

    return response.status(result.status).json(result.body)
  }

  /**
   * Reorder content items
   */
  async reorderContents({ request, params, response, session, bouncer }: HttpContext) {
    const module = await CourseModule.query()
      .where('id', params.moduleId)
      .preload('course')
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('edit', module.course)

    const payload = await request.validateUsing(reorderContentsValidator)

    // Ids outside this module match no row and are ignored
    await db.transaction(async (trx) => {
      for (const item of payload.contents) {
        await CourseContent.query({ client: trx })
          .where('id', item.id)
          .where('module_id', module.id)
          .update({ order: item.order })
      }
    })

    session.flash('success', 'Contenu réordonné avec succès')
    return response.redirect().back()
  }

  // ==================== PROGRESS TRACKING ====================

  /**
   * Update user progress on content
   */
  async updateProgress({ request, params, auth, response, bouncer }: HttpContext) {
    const user = auth.user!
    const content = await CourseContent.query()
      .where('id', params.contentId)
      .preload('module', (query) => query.preload('course'))
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('learn', content.module.course)

    const progress = await ContentProgress.getOrCreate(user.id, content.id)
    const payload = await request.validateUsing(updateProgressValidator)

    if (payload.status === 'completed') {
      await progress.markAsCompleted()
    } else if (payload.status === 'in_progress') {
      await progress.markAsStarted()
    }

    if (payload.timeSpent) {
      await progress.addTimeSpent(payload.timeSpent)
    }

    return response.json({
      success: true,
      progress: progress.serialize(),
    })
  }

  /**
   * Mark content as complete
   */
  async markComplete({ params, auth, response, session, bouncer }: HttpContext) {
    const user = auth.user!
    const content = await CourseContent.query()
      .where('id', params.contentId)
      .preload('module', (query) => query.preload('course'))
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('learn', content.module.course)

    const progress = await ContentProgress.getOrCreate(user.id, content.id)
    await progress.markAsCompleted()

    session.flash('success', 'Marqué comme terminé')
    return response.redirect().back()
  }

  /**
   * Get user's overall course progress
   */
  async getCourseProgress({ params, auth, response, bouncer }: HttpContext) {
    const user = auth.user!
    const course = await Course.query()
      .where('id', params.id)
      .preload('modules', (moduleQuery) => {
        moduleQuery.preload('contents').preload('children', (childQuery) => {
          childQuery.preload('contents')
        })
      })
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('learn', course)

    // Get all content IDs
    const allContentIds: number[] = []
    course.modules.forEach((module) => {
      module.contents.forEach((content) => allContentIds.push(content.id))
      module.children.forEach((child) => {
        child.contents.forEach((content) => allContentIds.push(content.id))
      })
    })

    const totalContents = allContentIds.length
    const completedProgress = await ContentProgress.query()
      .where('user_id', user.id)
      .whereIn('content_id', allContentIds)
      .where('status', 'completed')

    const completedCount = completedProgress.length
    const progressPercentage =
      totalContents > 0 ? Math.round((completedCount / totalContents) * 100) : 0

    return response.json({
      totalContents,
      completedCount,
      progressPercentage,
    })
  }
}
