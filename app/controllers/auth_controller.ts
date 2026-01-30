import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import UserRole from '#models/user_role'
import { loginValidator, registerValidator } from '#validators/auth_validator'
import AuditService from '#services/audit_service'
import env from '#start/env'

export default class AuthController {
  /**
   * Afficher le formulaire de connexion
   * GET /login
   */
  async showLogin({ inertia }: HttpContext) {
    return inertia.render('auth/login')
  }

  /**
   * Traiter la connexion
   * POST /login
   */
  async login(ctx: HttpContext) {
    const { request, response, auth, session } = ctx
    const { email, password } = await request.validateUsing(loginValidator)

    try {
      const user = await User.verifyCredentials(email, password)

      // Vérifier que le compte est actif
      if (!user.isActive) {
        await AuditService.logFromContext(ctx, {
          action: 'user.login.blocked',
          resourceType: 'User',
          resourceId: user.id,
          metadata: { reason: 'account_disabled' },
        })
        session.flash('error', 'Votre compte a été désactivé. Contactez un administrateur.')
        return response.redirect().back()
      }

      // Check if 2FA is enabled
      if (user.twoFactorEnabled) {
        session.put('two_factor_user_id', user.id)

        await AuditService.logFromContext(ctx, {
          action: 'user.login.2fa_required',
          resourceType: 'User',
          resourceId: user.id,
        })

        return response.redirect().toPath('/two-factor/challenge')
      }

      // Connecter l'utilisateur
      await auth.use('web').login(user)

      // Mettre à jour la dernière connexion
      await user.updateLastLogin()

      await AuditService.logFromContext(ctx, {
        action: 'user.login',
        resourceType: 'User',
        resourceId: user.id,
      })

      session.flash('success', 'Connexion réussie !')
      return response.redirect().toRoute('dashboard')
    } catch (error) {
      await AuditService.logFromContext(ctx, {
        action: 'user.login.failed',
        resourceType: 'User',
        metadata: { email },
      })
      session.flash('error', 'Email ou mot de passe incorrect')
      return response.redirect().back()
    }
  }

  /**
   * Afficher le formulaire d'inscription
   * GET /register
   */
  async showRegister({ inertia }: HttpContext) {
    return inertia.render('auth/register')
  }

  /**
   * Traiter l'inscription
   * POST /register
   */
  async register(ctx: HttpContext) {
    const { request, response, auth, session } = ctx
    const data = await request.validateUsing(registerValidator)

    try {
      // Créer l'utilisateur
      const user = await User.create({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        isActive: true,
        termsAcceptedAt: DateTime.now(),
        termsAcceptedVersion: env.get('TERMS_VERSION', '') || null,
      })

      // Assigner le rôle "student" par défaut
      await UserRole.assignRole(user.id, 'student')

      // Connecter automatiquement l'utilisateur
      await auth.use('web').login(user)

      await AuditService.logFromContext(ctx, {
        action: 'user.register',
        resourceType: 'User',
        resourceId: user.id,
      })

      session.flash('success', 'Inscription réussie ! Bienvenue sur Edonis LMS.')
      return response.redirect().toRoute('dashboard')
    } catch (error) {
      session.flash('error', "Une erreur s'est produite lors de l'inscription")
      return response.redirect().back()
    }
  }

  /**
   * Déconnexion
   * POST /logout
   */
  async logout(ctx: HttpContext) {
    const { auth, response, session } = ctx
    const userId = auth.user?.id

    await AuditService.logFromContext(ctx, {
      action: 'user.logout',
      resourceType: 'User',
      resourceId: userId,
    })

    await auth.use('web').logout()
    session.flash('success', 'Vous avez été déconnecté avec succès')
    return response.redirect().toRoute('login')
  }
}
