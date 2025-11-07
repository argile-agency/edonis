import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import UserRole from '#models/user_role'

export default class extends BaseSeeder {
  async run() {
    // Créer un administrateur
    const admin = await User.updateOrCreate(
      { email: 'admin@edonis.test' },
      {
        fullName: 'Administrateur Principal',
        email: 'admin@edonis.test',
        password: 'password',
        isActive: true,
      }
    )
    await UserRole.assignRole(admin.id, 'admin')

    // Créer un manager
    const manager = await User.updateOrCreate(
      { email: 'manager@edonis.test' },
      {
        fullName: 'Manager LMS',
        email: 'manager@edonis.test',
        password: 'password',
        isActive: true,
      }
    )
    await UserRole.assignRole(manager.id, 'manager')

    // Créer un enseignant
    const teacher = await User.updateOrCreate(
      { email: 'teacher@edonis.test' },
      {
        fullName: 'Professeur Martin',
        email: 'teacher@edonis.test',
        password: 'password',
        department: 'Informatique',
        isActive: true,
      }
    )
    await UserRole.assignRole(teacher.id, 'teacher')

    // Créer un étudiant
    const student = await User.updateOrCreate(
      { email: 'student@edonis.test' },
      {
        fullName: 'Étudiant Dupont',
        email: 'student@edonis.test',
        password: 'password',
        studentId: 'STU-2024-001',
        department: 'Informatique',
        isActive: true,
      }
    )
    await UserRole.assignRole(student.id, 'student')

    console.log('✅ Utilisateurs de test créés avec succès!')
    console.log('')
    console.log('👤 Comptes disponibles:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔴 Admin:    admin@edonis.test / password')
    console.log('🟡 Manager:  manager@edonis.test / password')
    console.log('🟢 Teacher:  teacher@edonis.test / password')
    console.log('🔵 Student:  student@edonis.test / password')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }
}
