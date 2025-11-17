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
        description:
          'Supervise une filière de cours et les évaluations. Ne peut pas gérer les utilisateurs.',
        isSystem: true,
        permissions: {
          'courses.read': true,
          'courses.supervise': true,
          'groups.manage': true,
          'grades.view': true,
          'grades.supervise': true,
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

    // Créer ou mettre à jour les rôles
    for (const roleData of roles) {
      await Role.updateOrCreate(
        { slug: roleData.slug },
        {
          name: roleData.name,
          slug: roleData.slug,
          description: roleData.description,
          isSystem: roleData.isSystem,
          permissions: roleData.permissions,
        }
      )
    }
  }
}
