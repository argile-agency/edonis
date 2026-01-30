import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import TwoFactorService from '#services/two_factor_service'
import AuditService from '#services/audit_service'

const tokenValidator = vine.compile(
  vine.object({
    token: vine.string().fixedLength(6),
  })
)

const passwordValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(1),
  })
)

export default class TwoFactorController {
  /**
   * Show the 2FA setup page.
   * GET /user/two-factor
   */
  async show(ctx: HttpContext) {
    const { inertia, auth, session } = ctx
    const user = auth.user!

    const qrCode = session.pull('two_factor_qr_code')
    const recoveryCodes = session.pull('two_factor_recovery_codes')

    return inertia.render('two-factor/setup', {
      twoFactorEnabled: user.twoFactorEnabled,
      two_factor_qr_code: qrCode ?? null,
      two_factor_recovery_codes: recoveryCodes ?? null,
    })
  }

  /**
   * Generate a new TOTP secret and QR code.
   * POST /user/two-factor/enable
   */
  async enable(ctx: HttpContext) {
    const { response, session, auth } = ctx
    const user = auth.user!

    if (user.twoFactorEnabled) {
      session.flash('error', 'La double authentification est déjà activée')
      return response.redirect().back()
    }

    const { secret, qrCodeDataUrl } = await TwoFactorService.generateSecret(user)

    // Store secret (not yet confirmed)
    user.twoFactorSecret = secret
    await user.save()

    // Store QR code in session for display
    session.put('two_factor_qr_code', qrCodeDataUrl)

    session.flash('success', "Scannez le QR code avec votre application d'authentification")
    return response.redirect().back()
  }

  /**
   * Confirm the 2FA setup with a valid token.
   * POST /user/two-factor/confirm
   */
  async confirm(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const user = auth.user!
    const { token } = await request.validateUsing(tokenValidator)

    if (!user.twoFactorSecret) {
      session.flash('error', "Veuillez d'abord activer la double authentification")
      return response.redirect().back()
    }

    const isValid = TwoFactorService.verifyToken(user, token)
    if (!isValid) {
      session.flash('error', 'Code invalide. Veuillez réessayer.')
      return response.redirect().back()
    }

    // Generate recovery codes
    const recoveryCodes = TwoFactorService.generateRecoveryCodes()

    user.twoFactorEnabled = true
    user.twoFactorConfirmedAt = DateTime.now()
    user.twoFactorRecoveryCodes = TwoFactorService.encryptRecoveryCodes(recoveryCodes)
    await user.save()

    await AuditService.logFromContext(ctx, {
      action: 'user.2fa.enable',
      resourceType: 'User',
      resourceId: user.id,
    })

    // Store recovery codes in session for one-time display
    session.put('two_factor_recovery_codes', recoveryCodes)
    session.forget('two_factor_qr_code')

    session.flash(
      'success',
      'Double authentification activée. Conservez vos codes de récupération.'
    )
    return response.redirect().back()
  }

  /**
   * Disable 2FA (requires password).
   * POST /user/two-factor/disable
   */
  async disable(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const user = auth.user!
    const { password } = await request.validateUsing(passwordValidator)

    const isValid = await hash.verify(user.password, password)
    if (!isValid) {
      session.flash('error', 'Mot de passe incorrect')
      return response.redirect().back()
    }

    user.twoFactorSecret = null
    user.twoFactorEnabled = false
    user.twoFactorRecoveryCodes = null
    user.twoFactorConfirmedAt = null
    await user.save()

    await AuditService.logFromContext(ctx, {
      action: 'user.2fa.disable',
      resourceType: 'User',
      resourceId: user.id,
    })

    session.flash('success', 'Double authentification désactivée')
    return response.redirect().back()
  }

  /**
   * Regenerate recovery codes.
   * POST /user/two-factor/recovery
   */
  async regenerateCodes(ctx: HttpContext) {
    const { response, session, auth } = ctx
    const user = auth.user!

    if (!user.twoFactorEnabled) {
      session.flash('error', "La double authentification n'est pas activée")
      return response.redirect().back()
    }

    const recoveryCodes = TwoFactorService.generateRecoveryCodes()
    user.twoFactorRecoveryCodes = TwoFactorService.encryptRecoveryCodes(recoveryCodes)
    await user.save()

    await AuditService.logFromContext(ctx, {
      action: 'user.2fa.recovery.regenerate',
      resourceType: 'User',
      resourceId: user.id,
    })

    session.put('two_factor_recovery_codes', recoveryCodes)
    session.flash('success', 'Nouveaux codes de récupération générés')
    return response.redirect().back()
  }

  /**
   * Show the 2FA challenge page (during login).
   * GET /two-factor/challenge
   */
  async challenge(ctx: HttpContext) {
    const { inertia, session, response } = ctx
    const userId = session.get('two_factor_user_id')

    if (!userId) {
      return response.redirect().toRoute('login')
    }

    return inertia.render('two-factor/challenge')
  }

  /**
   * Verify a TOTP token during login.
   * POST /two-factor/challenge
   */
  async verifyChallenge(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const userId = session.get('two_factor_user_id')

    if (!userId) {
      return response.redirect().toRoute('login')
    }

    const { token } = await request.validateUsing(tokenValidator)
    const user = await User.findOrFail(userId)

    const isValid = TwoFactorService.verifyToken(user, token)
    if (!isValid) {
      session.flash('error', 'Code invalide. Veuillez réessayer.')
      return response.redirect().back()
    }

    // Complete login
    session.forget('two_factor_user_id')
    await auth.use('web').login(user)
    await user.updateLastLogin()

    await AuditService.logFromContext(ctx, {
      action: 'user.login.2fa',
      resourceType: 'User',
      resourceId: user.id,
    })

    session.flash('success', 'Connexion réussie !')
    return response.redirect().toRoute('dashboard')
  }

  /**
   * Verify a recovery code during login.
   * POST /two-factor/challenge/recovery
   */
  async verifyRecovery(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const userId = session.get('two_factor_user_id')

    if (!userId) {
      return response.redirect().toRoute('login')
    }

    const recoveryCodeValidator = vine.compile(
      vine.object({
        recoveryCode: vine.string().minLength(1),
      })
    )

    const { recoveryCode } = await request.validateUsing(recoveryCodeValidator)
    const user = await User.findOrFail(userId)

    const isValid = await TwoFactorService.verifyRecoveryCode(user, recoveryCode)
    if (!isValid) {
      session.flash('error', 'Code de récupération invalide')
      return response.redirect().back()
    }

    // Complete login
    session.forget('two_factor_user_id')
    await auth.use('web').login(user)
    await user.updateLastLogin()

    await AuditService.logFromContext(ctx, {
      action: 'user.login.2fa.recovery',
      resourceType: 'User',
      resourceId: user.id,
    })

    session.flash('success', 'Connexion réussie via code de récupération')
    return response.redirect().toRoute('dashboard')
  }
}
