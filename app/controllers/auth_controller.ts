import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import UserRole from '#models/user_role'
import { loginValidator, registerValidator } from '#validators/auth_validator'

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
  async login({ request, response, auth, session }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    try {
      const user = await User.verifyCredentials(email, password)

      // Vérifier que le compte est actif
      if (!user.isActive) {
        session.flash('error', 'Votre compte a été désactivé. Contactez un administrateur.')
        return response.redirect().back()
      }

      // Connecter l'utilisateur
      await auth.use('web').login(user)

      // Mettre à jour la dernière connexion
      await user.updateLastLogin()

      session.flash('success', 'Connexion réussie !')
      return response.redirect().toRoute('dashboard')
    } catch (error) {
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
  async register({ request, response, auth, session }: HttpContext) {
    const data = await request.validateUsing(registerValidator)

    try {
      // Créer l'utilisateur
      const user = await User.create({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        isActive: true,
      })

      // Assigner le rôle "student" par défaut
      await UserRole.assignRole(user.id, 'student')

      // Connecter automatiquement l'utilisateur
      await auth.use('web').login(user)

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
  async logout({ auth, response, session }: HttpContext) {
    await auth.use('web').logout()
    session.flash('success', 'Vous avez été déconnecté avec succès')
    return response.redirect().toRoute('login')
  }
}
