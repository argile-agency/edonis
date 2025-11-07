import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import UserRole from '#models/user_role'

export default class extends BaseSeeder {
  async run() {
    // Créer un administrateur
    const admin = await User.updateOrCreate(
      { email: 'admin@edonis.com' },
      {
        fullName: 'Administrateur Principal',
        email: 'admin@edonis.com',
        password: 'Admin123!',
        isActive: true,
      }
    )
    await UserRole.assignRole(admin.id, 'admin')

    // Créer un manager
    const manager = await User.updateOrCreate(
      { email: 'manager@edonis.com' },
      {
        fullName: 'Manager LMS',
        email: 'manager@edonis.com',
        password: 'Manager123!',
        isActive: true,
      }
    )
    await UserRole.assignRole(manager.id, 'manager')

    // Créer un enseignant
    const teacher = await User.updateOrCreate(
      { email: 'teacher@edonis.com' },
      {
        fullName: 'Professeur Martin',
        email: 'teacher@edonis.com',
        password: 'Teacher123!',
        department: 'Informatique',
        isActive: true,
      }
    )
    await UserRole.assignRole(teacher.id, 'teacher')

    // Créer un étudiant
    const student = await User.updateOrCreate(
      { email: 'student@edonis.com' },
      {
        fullName: 'Étudiant Dupont',
        email: 'student@edonis.com',
        password: 'Student123!',
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
    console.log('🔴 Admin:    admin@edonis.com / Admin123!')
    console.log('🟡 Manager:  manager@edonis.com / Manager123!')
    console.log('🟢 Teacher:  teacher@edonis.com / Teacher123!')
    console.log('🔵 Student:  student@edonis.com / Student123!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }
}
