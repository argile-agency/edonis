import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import TwoFactorService from '#services/two_factor_service'
import AuditService from '#services/audit_service'
import { tokenValidator, passwordValidator, recoveryCodeValidator } from '#validators/two_factor'
import {
  LEGACY_TWO_FACTOR_KEY,
  TWO_FACTOR_PENDING_KEY,
  readPending,
  recordFailedAttempt,
  type TwoFactorPending,
} from '../helpers/two_factor_pending.js'

export default class TwoFactorController {
  /**
   * Resolve the pending (password-verified, code-not-yet-verified) login.
   *
   * Returns the pending record, or `null` after having already redirected
   * to the login page (no pending state, or expired). The pre-expiry
   * session key (LEGACY_TWO_FACTOR_KEY) is always forgotten and never honoured.
   */
  private async resolvePending(ctx: HttpContext): Promise<TwoFactorPending | null> {
    const { session, response } = ctx
    session.forget(LEGACY_TWO_FACTOR_KEY)

    const raw = session.get(TWO_FACTOR_PENDING_KEY)
    const result = readPending(raw, Date.now())

    if (result.status === 'ok') {
      return result.pending
    }

    if (result.status === 'expired') {
      session.forget(TWO_FACTOR_PENDING_KEY)
      const rawUserId = (raw as { userId?: unknown }).userId
      await AuditService.logFromContext(ctx, {
        action: 'user.login.2fa_expired',
        resourceType: 'User',
        resourceId: typeof rawUserId === 'number' ? rawUserId : null,
      })
      session.flash('error', 'Votre session de vérification a expiré. Veuillez vous reconnecter.')
    }

    response.redirect().toRoute('login')
    return null
  }

  /**
   * Record a wrong code on the pending login. Under the cap, the incremented
   * state is stored and the user is sent back with `errorMessage`. On the
   * last allowed failure the pending state is destroyed, the lockout is
   * audited and the user must re-enter the password.
   */
  private async handleFailedAttempt(
    ctx: HttpContext,
    pending: TwoFactorPending,
    errorMessage: string
  ) {
    const { session, response } = ctx
    const result = recordFailedAttempt(pending)

    if (result.locked) {
      session.forget(TWO_FACTOR_PENDING_KEY)
      await AuditService.logFromContext(ctx, {
        action: 'user.login.2fa_locked',
        resourceType: 'User',
        resourceId: pending.userId,
      })
      session.flash('error', 'Trop de tentatives. Veuillez vous reconnecter.')
      return response.redirect().toRoute('login')
    }

    session.put(TWO_FACTOR_PENDING_KEY, result.pending)
    session.flash('error', errorMessage)
    return response.redirect().back()
  }

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
    const { inertia } = ctx
    const pending = await this.resolvePending(ctx)

    if (!pending) {
      return
    }

    return inertia.render('two-factor/challenge')
  }

  /**
   * Verify a TOTP token during login.
   * POST /two-factor/challenge
   */
  async verifyChallenge(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const pending = await this.resolvePending(ctx)

    if (!pending) {
      return
    }

    const { token } = await request.validateUsing(tokenValidator)
    const user = await User.findOrFail(pending.userId)

    const isValid = TwoFactorService.verifyToken(user, token)
    if (!isValid) {
      return this.handleFailedAttempt(ctx, pending, 'Code invalide. Veuillez réessayer.')
    }

    // Complete login
    session.forget(TWO_FACTOR_PENDING_KEY)
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
    const pending = await this.resolvePending(ctx)

    if (!pending) {
      return
    }

    const { recoveryCode } = await request.validateUsing(recoveryCodeValidator)
    const user = await User.findOrFail(pending.userId)

    const isValid = await TwoFactorService.verifyRecoveryCode(user, recoveryCode)
    if (!isValid) {
      return this.handleFailedAttempt(ctx, pending, 'Code de récupération invalide')
    }

    // Complete login
    session.forget(TWO_FACTOR_PENDING_KEY)
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
