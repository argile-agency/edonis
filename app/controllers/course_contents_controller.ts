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
} from '#validators/course_content'
import { wouldCreateCycle } from '../helpers/category_tree.js'

/**
 * Flash shown when a module parent is outside the course, the module itself,
 * or one of its descendants.
 */
const PARENT_ERROR = 'Module parent invalide.'

export default class CourseContentsController {
  /**
   * Display course content builder for instructors
   */
  async builder({ inertia, params, bouncer }: HttpContext) {
    const course = await Course.query()
      .where('id', params.id)
      .preload('modules', (moduleQuery) => {
        moduleQuery
          .whereNull('parent_id')
          .orderBy('order', 'asc')
          .preload('children', (childQuery) => {
            childQuery.orderBy('order', 'asc').preload('contents', (contentQuery) => {
              contentQuery.orderBy('order', 'asc')
            })
          })
          .preload('contents', (contentQuery) => {
            contentQuery.orderBy('order', 'asc')
          })
      })
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('edit', course)

    return inertia.render('courses/builder', {
      course: course.serialize(),
      modules: course.modules.map((m) => m.serialize()),
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
  async outline({ inertia, params, auth }: HttpContext) {
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

    // The parent must be a module of the same course
    if (payload.parentId) {
      const parent = await CourseModule.query()
        .where('id', payload.parentId)
        .where('course_id', course.id)
        .first()
      if (!parent) {
        session.flash('error', PARENT_ERROR)
        return response.redirect().back()
      }
    }

    // Get max order for this level
    let query = CourseModule.query().where('course_id', payload.courseId)
    if (payload.parentId) {
      query = query.where('parent_id', payload.parentId)
    } else {
      query = query.whereNull('parent_id')
    }
    const maxOrderResult = await query.pojo<{ maxOrder: number | null }>().max('order as maxOrder')
    const maxOrder = maxOrderResult[0]?.maxOrder ?? null
    const order = payload.order ?? (maxOrder || 0) + 1

    await CourseModule.create({
      ...payload,
      availableFrom: payload.availableFrom ? DateTime.fromJSDate(payload.availableFrom) : null,
      availableUntil: payload.availableUntil ? DateTime.fromJSDate(payload.availableUntil) : null,
      order,
    })

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

    // The new parent must be a module of the same course, and neither the
    // module itself nor one of its descendants
    if (payload.parentId !== undefined && payload.parentId !== null) {
      const parent = await CourseModule.query()
        .where('id', payload.parentId)
        .where('course_id', module.courseId)
        .first()

      const courseModules = await CourseModule.query()
        .where('course_id', module.courseId)
        .select('id', 'parent_id')
      const parentById = new Map<number, number | null>(
        courseModules.map((m) => [m.id, m.parentId])
      )

      if (!parent || wouldCreateCycle(parentById, module.id, payload.parentId)) {
        session.flash('error', PARENT_ERROR)
        return response.redirect().back()
      }
    }

    await module
      .merge({
        ...payload,
        availableFrom: payload.availableFrom
          ? DateTime.fromJSDate(payload.availableFrom)
          : undefined,
        availableUntil: payload.availableUntil
          ? DateTime.fromJSDate(payload.availableUntil)
          : undefined,
      })
      .save()

    session.flash('success', 'Module mis à jour avec succès')
    return response.redirect().back()
  }

  /**
   * Delete a module
   */
  async deleteModule({ params, response, session, bouncer }: HttpContext) {
    const module = await CourseModule.query()
      .where('id', params.moduleId)
      .preload('course')
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('edit', module.course)

    await module.delete()

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

    // Get max order
    const maxOrderResult = await CourseContent.query()
      .where('module_id', payload.moduleId)
      .pojo<{ maxOrder: number | null }>()
      .max('order as maxOrder')
    const maxOrder = maxOrderResult[0]?.maxOrder ?? null
    const order = payload.order ?? (maxOrder || 0) + 1

    await CourseContent.create({
      ...payload,
      availableFrom: payload.availableFrom ? DateTime.fromJSDate(payload.availableFrom) : null,
      availableUntil: payload.availableUntil ? DateTime.fromJSDate(payload.availableUntil) : null,
      dueDate: payload.dueDate ? DateTime.fromJSDate(payload.dueDate) : null,
      order,
    })

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

    await content
      .merge({
        ...payload,
        availableFrom: payload.availableFrom
          ? DateTime.fromJSDate(payload.availableFrom)
          : undefined,
        availableUntil: payload.availableUntil
          ? DateTime.fromJSDate(payload.availableUntil)
          : undefined,
        dueDate: payload.dueDate ? DateTime.fromJSDate(payload.dueDate) : undefined,
      })
      .save()

    session.flash('success', 'Contenu mis à jour avec succès')
    return response.redirect().back()
  }

  /**
   * Delete a content item
   */
  async deleteContent({ params, response, session, bouncer }: HttpContext) {
    const content = await CourseContent.query()
      .where('id', params.contentId)
      .preload('module', (query) => query.preload('course'))
      .firstOrFail()

    await bouncer.with('CoursePolicy').authorize('edit', content.module.course)

    await content.delete()

    session.flash('success', 'Contenu supprimé avec succès')
    return response.redirect().back()
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
  async updateProgress({ request, params, auth, response }: HttpContext) {
    const user = auth.user!
    const content = await CourseContent.findOrFail(params.contentId)

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
  async markComplete({ params, auth, response, session }: HttpContext) {
    const user = auth.user!
    const content = await CourseContent.findOrFail(params.contentId)

    const progress = await ContentProgress.getOrCreate(user.id, content.id)
    await progress.markAsCompleted()

    session.flash('success', 'Marqué comme terminé')
    return response.redirect().back()
  }

  /**
   * Get user's overall course progress
   */
  async getCourseProgress({ params, auth, response }: HttpContext) {
    const user = auth.user!
    const course = await Course.query()
      .where('id', params.id)
      .preload('modules', (moduleQuery) => {
        moduleQuery.preload('contents').preload('children', (childQuery) => {
          childQuery.preload('contents')
        })
      })
      .firstOrFail()

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
