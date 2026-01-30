import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Role from '#models/role'
import UserRole from '#models/user_role'
import {
  createUserValidator,
  updateUserValidator,
  validateEmailUnique,
  validateStudentIdUnique,
} from '#validators/user_validator'
import AuditService from '#services/audit_service'

export default class UsersController {
  /**
   * Afficher la liste de tous les utilisateurs
   * GET /admin/users
   */
  async index({ inertia, request }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const search = request.input('search', '')
    const roleFilter = request.input('role', '')
    const status = request.input('status', '')

    const query = User.query().preload('roles').orderBy('created_at', 'desc')

    // Filtre de recherche
    if (search) {
      query.where((subQuery) => {
        subQuery
          .whereILike('full_name', `%${search}%`)
          .orWhereILike('email', `%${search}%`)
          .orWhereILike('student_id', `%${search}%`)
      })
    }

    // Filtre par statut
    if (status === 'active') {
      query.where('is_active', true)
    } else if (status === 'inactive') {
      query.where('is_active', false)
    }

    // Filtre par rôle
    if (roleFilter) {
      query.whereHas('roles', (rolesQuery) => {
        rolesQuery.where('slug', roleFilter)
      })
    }

    const users = await query.paginate(page, limit)

    return inertia.render('users/index', {
      users: users.serialize(),
    })
  }

  /**
   * Afficher le formulaire de création
   * GET /admin/users/create
   */
  async create({ inertia }: HttpContext) {
    const roles = await Role.all()

    return inertia.render('users/create', {
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        slug: role.slug,
        description: role.description,
      })),
    })
  }

  /**
   * Créer un nouvel utilisateur
   * POST /admin/users
   */
  async store(ctx: HttpContext) {
    const { request, response, session } = ctx
    const data = await request.validateUsing(createUserValidator)

    // Validation manuelle de l'unicité
    const emailExists = !(await validateEmailUnique(data.email))
    if (emailExists) {
      session.flash('error', 'Cet email est déjà utilisé')
      return response.redirect().back()
    }

    if (data.studentId) {
      const studentIdExists = !(await validateStudentIdUnique(data.studentId))
      if (studentIdExists) {
        session.flash('error', 'Ce matricule est déjà utilisé')
        return response.redirect().back()
      }
    }

    // Créer l'utilisateur
    const user = await User.create({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      avatarUrl: data.avatarUrl,
      bio: data.bio,
      phone: data.phone,
      studentId: data.studentId,
      department: data.department,
      organization: data.organization,
      locale: data.locale || 'fr',
      timezone: data.timezone || 'Europe/Paris',
      isActive: data.isActive ?? true,
    })

    // Assigner les rôles
    if (data.roleIds && data.roleIds.length > 0) {
      for (const roleId of data.roleIds) {
        await UserRole.create({
          userId: user.id,
          roleId: roleId,
          courseId: null, // Rôle global
        })
      }
    }

    await AuditService.logFromContext(ctx, {
      action: 'admin.user.create',
      resourceType: 'User',
      resourceId: user.id,
      newValues: user.serialize(),
    })

    session.flash('success', 'Utilisateur créé avec succès')
    return response.redirect().toRoute('users.index')
  }

  /**
   * Afficher les détails d'un utilisateur
   * GET /admin/users/:id
   */
  async show({ params, inertia }: HttpContext) {
    const user = await User.query().where('id', params.id).preload('roles').firstOrFail()

    const userRoles = await UserRole.getUserRoles(user.id)

    return inertia.render('users/show', {
      user: user.serialize(),
      userRoles: userRoles.map((ur) => ur.serialize()),
    })
  }

  /**
   * Afficher le formulaire d'édition
   * GET /admin/users/:id/edit
   */
  async edit({ params, inertia }: HttpContext) {
    const user = await User.query().where('id', params.id).preload('roles').firstOrFail()

    const roles = await Role.all()

    return inertia.render('users/edit', {
      user: {
        ...user.serialize(),
        roleIds: user.roles.map((role) => role.id),
      },
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        slug: role.slug,
        description: role.description,
      })),
    })
  }

  /**
   * Mettre à jour un utilisateur
   * PUT/PATCH /admin/users/:id
   */
  async update(ctx: HttpContext) {
    const { params, request, response, session } = ctx
    const user = await User.findOrFail(params.id)
    const oldValues = user.serialize()
    const data = await request.validateUsing(updateUserValidator)

    // Validation manuelle de l'unicité
    if (data.email) {
      const emailExists = !(await validateEmailUnique(data.email, user.id))
      if (emailExists) {
        session.flash('error', 'Cet email est déjà utilisé')
        return response.redirect().back()
      }
    }

    if (data.studentId) {
      const studentIdExists = !(await validateStudentIdUnique(data.studentId, user.id))
      if (studentIdExists) {
        session.flash('error', 'Ce matricule est déjà utilisé')
        return response.redirect().back()
      }
    }

    // Mettre à jour les informations de base
    user.merge({
      fullName: data.fullName,
      email: data.email,
      avatarUrl: data.avatarUrl,
      bio: data.bio,
      phone: data.phone,
      studentId: data.studentId,
      department: data.department,
      organization: data.organization,
      locale: data.locale,
      timezone: data.timezone,
      isActive: data.isActive,
    })

    // Mettre à jour le mot de passe si fourni
    if (data.password) {
      user.password = data.password
    }

    await user.save()

    // Mettre à jour les rôles
    if (data.roleIds !== undefined) {
      // Supprimer tous les rôles globaux existants
      await UserRole.query().where('user_id', user.id).whereNull('course_id').delete()

      // Ajouter les nouveaux rôles
      for (const roleId of data.roleIds) {
        await UserRole.create({
          userId: user.id,
          roleId: roleId,
          courseId: null,
        })
      }
    }

    await AuditService.logFromContext(ctx, {
      action: 'admin.user.update',
      resourceType: 'User',
      resourceId: user.id,
      oldValues,
      newValues: user.serialize(),
    })

    session.flash('success', 'Utilisateur mis à jour avec succès')
    return response.redirect().toRoute('users.index')
  }

  /**
   * Supprimer un utilisateur (soft delete via is_active)
   * DELETE /admin/users/:id
   */
  async destroy(ctx: HttpContext) {
    const { params, response, session } = ctx
    const user = await User.findOrFail(params.id)

    // Soft delete - désactiver l'utilisateur
    user.isActive = false
    await user.save()

    await AuditService.logFromContext(ctx, {
      action: 'admin.user.deactivate',
      resourceType: 'User',
      resourceId: user.id,
    })

    session.flash('success', 'Utilisateur désactivé avec succès')
    return response.redirect().toRoute('users.index')
  }

  /**
   * Activer un utilisateur
   * POST /admin/users/:id/activate
   */
  async activate(ctx: HttpContext) {
    const { params, response, session } = ctx
    const user = await User.findOrFail(params.id)
    user.isActive = true
    await user.save()

    await AuditService.logFromContext(ctx, {
      action: 'admin.user.activate',
      resourceType: 'User',
      resourceId: user.id,
    })

    session.flash('success', 'Utilisateur activé avec succès')
    return response.redirect().back()
  }

  /**
   * Supprimer définitivement un utilisateur
   * DELETE /admin/users/:id/force
   */
  async forceDestroy(ctx: HttpContext) {
    const { params, response, session } = ctx
    const user = await User.findOrFail(params.id)
    const oldValues = user.serialize()

    await AuditService.logFromContext(ctx, {
      action: 'admin.user.delete',
      resourceType: 'User',
      resourceId: user.id,
      oldValues,
    })

    await user.delete()

    session.flash('success', 'Utilisateur supprimé définitivement')
    return response.redirect().toRoute('users.index')
  }
}
