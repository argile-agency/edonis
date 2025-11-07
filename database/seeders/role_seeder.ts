import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role, { type RolePermissions } from '#models/role'

export default class extends BaseSeeder {
  async run() {
    const roles: Array<{
      name: string
      slug: string
      description: string
      isSystem: boolean
      permissions: RolePermissions
    }> = [
      {
        name: 'Administrator',
        slug: 'admin',
        description: 'Accès complet au système. Peut gérer tous les aspects de la plateforme.',
        isSystem: true,
        permissions: {
          'system.manage': true,
          'users.create': true,
          'users.read': true,
          'users.update': true,
          'users.delete': true,
          'courses.create': true,
          'courses.read': true,
          'courses.update': true,
          'courses.delete': true,
          'content.create': true,
          'content.update': true,
          'content.delete': true,
          'grades.manage': true,
          'reports.view': true,
        },
      },
      {
        name: 'Manager',
        slug: 'manager',
        description: 'Peut gérer les cours et les utilisateurs, mais pas la configuration système.',
        isSystem: true,
        permissions: {
          'users.create': true,
          'users.read': true,
          'users.update': true,
          'courses.create': true,
          'courses.read': true,
          'courses.update': true,
          'courses.delete': true,
          'reports.view': true,
        },
      },
      {
        name: 'Teacher',
        slug: 'teacher',
        description: 'Peut créer et gérer ses propres cours, noter les étudiants.',
        isSystem: true,
        permissions: {
          'courses.create': true,
          'courses.read': true,
          'courses.update.own': true,
          'content.create': true,
          'content.update.own': true,
          'content.delete.own': true,
          'grades.manage.own': true,
          'students.view': true,
        },
      },
      {
        name: 'Student',
        slug: 'student',
        description: 'Peut accéder aux cours, soumettre des devoirs et voir ses notes.',
        isSystem: true,
        permissions: {
          'courses.read.enrolled': true,
          'content.view': true,
          'assignments.submit': true,
          'grades.view.own': true,
          'forums.participate': true,
        },
      },
      {
        name: 'Guest',
        slug: 'guest',
        description: 'Accès en lecture seule aux cours publics.',
        isSystem: true,
        permissions: {
          'courses.read.public': true,
          'content.view.public': true,
        },
      },
    ]

    // Utiliser updateOrCreate pour éviter les doublons
    for (const roleData of roles) {
      const existing = await Role.findBy('slug', roleData.slug)

      if (existing) {
        existing.name = roleData.name
        existing.description = roleData.description
        existing.permissions = roleData.permissions
        existing.isSystem = roleData.isSystem
        await existing.save()
      } else {
        await Role.create({
          name: roleData.name,
          slug: roleData.slug,
          description: roleData.description,
          isSystem: roleData.isSystem,
          permissions: roleData.permissions,
        })
      }
    }
  }
}
