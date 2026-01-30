import type { HttpContext } from '@adonisjs/core/http'
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import hash from '@adonisjs/core/services/hash'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import AuditLog from '#models/audit_log'
import AuditService from '#services/audit_service'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'

const passwordConfirmValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(1),
  })
)

export default class AccountController {
  /**
   * Show the account management page.
   * GET /user/account
   */
  async show(ctx: HttpContext) {
    const { inertia, auth } = ctx
    const user = auth.user!

    return inertia.render('account/index', {
      user: user.serialize(),
    })
  }

  /**
   * Accept updated terms of service (re-consent).
   * POST /user/account/accept-terms
   */
  async acceptTerms(ctx: HttpContext) {
    const { auth, response, session } = ctx
    const user = auth.user!
    const currentVersion = env.get('TERMS_VERSION', '')

    user.termsAcceptedAt = DateTime.now()
    user.termsAcceptedVersion = currentVersion || null
    await user.save()

    await AuditService.logFromContext(ctx, {
      action: 'user.terms.accept',
      resourceType: 'User',
      resourceId: user.id,
      metadata: { version: currentVersion },
    })

    session.flash('success', 'Conditions acceptées. Merci.')
    return response.redirect().back()
  }

  /**
   * Export all user data as JSON (GDPR portability).
   * POST /user/account/export
   */
  async exportData(ctx: HttpContext) {
    const { auth, response } = ctx
    const user = auth.user!

    // Collect all user data
    const userData = user.serialize()

    // Enrollments
    const { default: CourseEnrollment } = await import('#models/course_enrollment')
    const enrollments = await CourseEnrollment.query().where('user_id', user.id).preload('course')
    const enrollmentData = enrollments.map((e) => e.serialize())

    // Submissions & grades
    const { default: Submission } = await import('#models/submission')
    const submissions = await Submission.query().where('user_id', user.id)
    const submissionData = submissions.map((s) => s.serialize())

    // Content progress
    const { default: ContentProgress } = await import('#models/content_progress')
    const progress = await ContentProgress.query().where('user_id', user.id)
    const progressData = progress.map((p) => p.serialize())

    // Audit logs
    const auditLogs = await AuditLog.query()
      .where('user_id', user.id)
      .orderBy('created_at', 'desc')
      .limit(500)
    const auditData = auditLogs.map((l) => l.serialize())

    const exportPayload = {
      exportDate: DateTime.now().toISO(),
      profile: userData,
      enrollments: enrollmentData,
      submissions: submissionData,
      contentProgress: progressData,
      auditLogs: auditData,
    }

    await AuditService.logFromContext(ctx, {
      action: 'user.data.export',
      resourceType: 'User',
      resourceId: user.id,
    })

    response.header('Content-Type', 'application/json')
    response.header(
      'Content-Disposition',
      `attachment; filename="edonis-data-export-${user.id}-${DateTime.now().toFormat('yyyy-MM-dd')}.json"`
    )
    return response.send(JSON.stringify(exportPayload, null, 2))
  }

  /**
   * Delete (anonymize) the user account (GDPR right to be forgotten).
   * DELETE /user/account
   */
  async deleteAccount(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const user = auth.user!

    const { password } = await request.validateUsing(passwordConfirmValidator)

    // Verify password
    const isValid = await hash.verify(user.password, password)
    if (!isValid) {
      session.flash('error', 'Mot de passe incorrect')
      return response.redirect().back()
    }

    // Delete avatar file if exists
    if (user.avatarUrl) {
      try {
        const filePath = join(app.publicPath(), user.avatarUrl)
        await unlink(filePath)
      } catch {
        // File may not exist
      }
    }

    // Anonymize user data
    const timestamp = DateTime.now().toMillis()
    user.fullName = 'Utilisateur supprimé'
    user.firstName = null
    user.lastName = null
    user.email = `deleted_${user.id}_${timestamp}@anonymized.local`
    user.avatarUrl = null
    user.avatarDescription = null
    user.bio = null
    user.phone = null
    user.mobilePhone = null
    user.address = null
    user.identificationNumber = null
    user.studentId = null
    user.department = null
    user.organization = null
    user.city = null
    user.country = null
    user.webUrl = null
    user.isActive = false
    user.password = randomBytes(32).toString('hex')
    user.twoFactorSecret = null
    user.twoFactorEnabled = false
    user.twoFactorRecoveryCodes = null
    user.twoFactorConfirmedAt = null

    await user.save()

    await AuditService.logFromContext(ctx, {
      action: 'user.account.delete',
      resourceType: 'User',
      resourceId: user.id,
      metadata: { anonymized: true },
    })

    // Logout
    await auth.use('web').logout()

    session.flash('success', 'Votre compte a été supprimé. Nous espérons vous revoir.')
    return response.redirect().toRoute('home')
  }
}
