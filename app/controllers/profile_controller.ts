import type { HttpContext } from '@adonisjs/core/http'
import { cuid } from '@adonisjs/core/helpers'
import hash from '@adonisjs/core/services/hash'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import {
  updateProfileValidator,
  updatePasswordValidator,
  updateSettingsValidator,
} from '#validators/profile_validator'
import { validateEmailUnique } from '#validators/user_validator'
import AuditService from '#services/audit_service'
import SocialAccount from '#models/social_account'
import { unlink, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export default class ProfileController {
  /**
   * Afficher la page d'édition du profil
   * GET /user/profile
   */
  async edit({ inertia, auth }: HttpContext) {
    const user = auth.user!
    return inertia.render('profile/edit', {
      user: user.serialize(),
    })
  }

  /**
   * Mettre à jour le profil (champs texte uniquement, pas d'avatar)
   * POST /user/profile
   */
  async update(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const user = auth.user!

    try {
      const data = await request.validateUsing(updateProfileValidator)

      // Validate email uniqueness
      if (data.email && data.email !== user.email) {
        const emailIsUnique = await validateEmailUnique(data.email, user.id)
        if (!emailIsUnique) {
          session.flash('error', 'Cet email est déjà utilisé')
          return response.redirect().back()
        }
      }

      const oldValues = user.serialize()

      user.merge({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        emailVisibility: data.emailVisibility,
        bio: data.bio,
        phone: data.phone,
        mobilePhone: data.mobilePhone,
        city: data.city,
        country: data.country,
        address: data.address,
        timezone: data.timezone,
        webUrl: data.webUrl,
        identificationNumber: data.identificationNumber,
        organization: data.organization,
        department: data.department,
        avatarDescription: data.avatarDescription,
      })

      await user.save()

      await AuditService.logFromContext(ctx, {
        action: 'user.profile.update',
        resourceType: 'User',
        resourceId: user.id,
        oldValues,
        newValues: user.serialize(),
      })

      session.flash('success', 'Profil mis à jour avec succès')
    } catch (error) {
      logger.error('Profile update error: %O', error)
      session.flash('error', 'Erreur lors de la mise à jour du profil')
    }

    return response.redirect().back()
  }

  /**
   * Upload de l'avatar (formulaire séparé)
   * POST /user/profile/avatar
   */
  async updateAvatar(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const user = auth.user!

    try {
      const avatar = request.file('avatar', {
        size: '2mb',
        extnames: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      })

      if (!avatar) {
        session.flash('error', 'Aucun fichier sélectionné')
        return response.redirect().back()
      }

      if (!avatar.isValid) {
        session.flash('error', avatar.errors.map((e) => e.message).join(', '))
        return response.redirect().back()
      }

      // Delete old avatar file if exists
      if (user.avatarUrl) {
        await this.deleteAvatarFile(user.avatarUrl)
      }

      // Ensure uploads directory exists
      const uploadsDir = app.publicPath('uploads/avatars')
      await mkdir(uploadsDir, { recursive: true })

      const fileName = `${cuid()}.${avatar.extname}`
      await avatar.move(uploadsDir, { name: fileName })

      if (avatar.state === 'moved') {
        user.avatarUrl = `/uploads/avatars/${fileName}`
        await user.save()

        await AuditService.logFromContext(ctx, {
          action: 'user.avatar.update',
          resourceType: 'User',
          resourceId: user.id,
        })

        session.flash('success', 'Avatar mis à jour avec succès')
      } else {
        session.flash('error', 'Erreur lors du déplacement du fichier')
      }
    } catch (error) {
      logger.error('Avatar upload error: %O', error)
      session.flash('error', "Erreur lors de l'upload de l'avatar")
    }

    return response.redirect().back()
  }

  /**
   * Changer le mot de passe
   * POST /user/profile/password
   */
  async updatePassword(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const user = auth.user!

    try {
      const data = await request.validateUsing(updatePasswordValidator)

      const isValid = await hash.verify(user.password, data.currentPassword)
      if (!isValid) {
        session.flash('error', 'Le mot de passe actuel est incorrect')
        return response.redirect().back()
      }

      user.password = data.newPassword
      await user.save()

      await AuditService.logFromContext(ctx, {
        action: 'user.password.change',
        resourceType: 'User',
        resourceId: user.id,
      })

      session.flash('success', 'Mot de passe modifié avec succès')
    } catch (error) {
      logger.error('Password update error: %O', error)
      session.flash('error', 'Erreur lors du changement de mot de passe')
    }

    return response.redirect().back()
  }

  /**
   * Supprimer l'avatar
   * DELETE /user/profile/avatar
   */
  async deleteAvatar({ response, session, auth }: HttpContext) {
    const user = auth.user!

    try {
      if (user.avatarUrl) {
        await this.deleteAvatarFile(user.avatarUrl)
        user.avatarUrl = null
        user.avatarDescription = null
        await user.save()
      }

      session.flash('success', 'Avatar supprimé')
    } catch (error) {
      logger.error('Avatar delete error: %O', error)
      session.flash('error', "Erreur lors de la suppression de l'avatar")
    }

    return response.redirect().back()
  }

  /**
   * Afficher la page des paramètres
   * GET /user/settings
   */
  async settings({ inertia, auth }: HttpContext) {
    const user = auth.user!
    const socialAccounts = await SocialAccount.query().where('user_id', user.id).orderBy('provider')
    return inertia.render('settings/index', {
      user: user.serialize(),
      socialAccounts: socialAccounts.map((a) => a.serialize()),
    })
  }

  /**
   * Mettre à jour les paramètres
   * PUT /user/settings
   */
  async updateSettings({ request, response, session, auth }: HttpContext) {
    const user = auth.user!

    try {
      const data = await request.validateUsing(updateSettingsValidator)

      user.merge({
        locale: data.locale,
        timezone: data.timezone,
        profileVisibility: data.profileVisibility,
      })

      await user.save()

      session.flash('success', 'Paramètres mis à jour avec succès')
    } catch (error) {
      logger.error('Settings update error: %O', error)
      session.flash('error', 'Erreur lors de la mise à jour des paramètres')
    }

    return response.redirect().back()
  }

  /**
   * Helper: delete avatar file from disk
   */
  private async deleteAvatarFile(avatarUrl: string) {
    try {
      const filePath = join(app.publicPath(), avatarUrl)
      await unlink(filePath)
    } catch {
      // File may not exist, ignore
    }
  }
}
