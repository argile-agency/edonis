import type { HttpContext } from '@adonisjs/core/http'
import Course from '#models/course'
import { editModeValidator } from '#validators/edit_mode'
import { EDIT_MODE_KEY, type EditModeState } from '../helpers/edit_mode.js'

/** Where "off" (and a refusal) lands, per page the switch was used on (D-12). */
const BACK_TO = { show: 'courses.show', learn: 'courses.learn', builder: 'courses.learn' } as const

export default class EditModeController {
  /**
   * Turn « Mode d'édition » on or off. A view preference: it grants no right,
   * the builder still authorizes `edit` itself.
   * POST /edit-mode
   */
  async update({ request, response, session, bouncer, auth }: HttpContext) {
    const { enabled, courseId, from } = await request.validateUsing(editModeValidator)
    const course = await Course.findOrFail(courseId)

    // denies() + flash, not authorize(): on Inertia requests authorize() renders the full 403 page.
    if (await bouncer.with('CoursePolicy').denies('edit', course)) {
      session.flash('error', 'Vous ne pouvez pas modifier ce cours. Contactez son responsable.')
      const target = from === 'builder' ? 'courses.show' : BACK_TO[from]
      return response.redirect().toRoute(target, { id: course.id })
    }

    if (enabled) {
      const state: EditModeState = { userId: auth.user!.id }
      session.put(EDIT_MODE_KEY, state)
      return response.redirect().toRoute('courses.builder', { id: course.id })
    }

    session.forget(EDIT_MODE_KEY)
    return response.redirect().toRoute(BACK_TO[from], { id: course.id })
  }
}
