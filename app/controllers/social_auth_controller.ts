import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import UserRole from '#models/user_role'
import SocialAccount from '#models/social_account'
import AuditService from '#services/audit_service'

const SUPPORTED_PROVIDERS = ['google', 'github'] as const
type Provider = (typeof SUPPORTED_PROVIDERS)[number]

export default class SocialAuthController {
  /**
   * Redirect to the OAuth provider.
   * GET /auth/:provider/redirect
   */
  async redirect(ctx: HttpContext) {
    const { params, ally, response } = ctx
    const provider = params.provider as string

    if (!this.isSupported(provider)) {
      return response.notFound('Provider non supporté')
    }

    return ally.use(provider).redirect()
  }

  /**
   * Handle the OAuth callback.
   * GET /auth/:provider/callback
   */
  async callback(ctx: HttpContext) {
    const { params, ally, auth, response, session } = ctx
    const provider = params.provider as string

    if (!this.isSupported(provider)) {
      return response.notFound('Provider non supporté')
    }

    const social = ally.use(provider)

    if (social.accessDenied()) {
      session.flash('error', 'Accès refusé. Vous avez annulé la connexion.')
      return response.redirect().toRoute('login')
    }

    if (social.stateMisMatch()) {
      session.flash('error', 'Erreur de sécurité. Veuillez réessayer.')
      return response.redirect().toRoute('login')
    }

    if (social.hasError()) {
      session.flash('error', `Erreur OAuth : ${social.getError() ?? 'erreur inconnue'}`)
      return response.redirect().toRoute('login')
    }

    try {
      const socialUser = await social.user()
      const email = socialUser.email

      if (!email) {
        session.flash('error', 'Impossible de récupérer votre adresse email depuis le provider.')
        return response.redirect().toRoute('login')
      }

      // Find or create user
      let user = await User.findBy('email', email)
      let isNewUser = false

      if (!user) {
        isNewUser = true
        user = await User.create({
          fullName: socialUser.name || socialUser.nickName || email.split('@')[0],
          email,
          password: this.generateRandomPassword(),
          avatarUrl: socialUser.avatarUrl || null,
          isActive: true,
          termsAcceptedAt: DateTime.now(),
        })

        // Assign default student role
        await UserRole.assignRole(user.id, 'student')
      }

      // Upsert social account link
      await SocialAccount.updateOrCreate(
        { provider, providerId: String(socialUser.id) },
        {
          userId: user.id,
          email: socialUser.email || null,
          name: socialUser.name || socialUser.nickName || null,
          avatarUrl: socialUser.avatarUrl || null,
        }
      )

      // Check account is active
      if (!user.isActive) {
        session.flash('error', 'Votre compte a été désactivé. Contactez un administrateur.')
        return response.redirect().toRoute('login')
      }

      // Login the user
      await auth.use('web').login(user)
      await user.updateLastLogin()

      await AuditService.logFromContext(ctx, {
        action: isNewUser ? 'user.register.oauth' : 'user.login.oauth',
        resourceType: 'User',
        resourceId: user.id,
        metadata: { provider },
      })

      session.flash('success', isNewUser ? 'Compte créé avec succès !' : 'Connexion réussie !')
      return response.redirect().toRoute('dashboard')
    } catch (error) {
      session.flash('error', 'Erreur lors de la connexion. Veuillez réessayer.')
      return response.redirect().toRoute('login')
    }
  }

  /**
   * Disconnect a social account.
   * DELETE /user/social-accounts/:id
   */
  async disconnect(ctx: HttpContext) {
    const { params, auth, session, response } = ctx
    const user = auth.user!

    const account = await SocialAccount.query()
      .where('id', params.id)
      .where('user_id', user.id)
      .first()

    if (!account) {
      session.flash('error', 'Compte social introuvable.')
      return response.redirect().back()
    }

    await account.delete()

    await AuditService.logFromContext(ctx, {
      action: 'user.social.disconnect',
      resourceType: 'SocialAccount',
      resourceId: account.id,
      metadata: { provider: account.provider },
    })

    session.flash('success', `Compte ${account.provider} déconnecté.`)
    return response.redirect().back()
  }

  private isSupported(provider: string): provider is Provider {
    return SUPPORTED_PROVIDERS.includes(provider as Provider)
  }

  private generateRandomPassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
    let password = ''
    for (let i = 0; i < 32; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }
}
