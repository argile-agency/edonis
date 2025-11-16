import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import Course from '#models/course'
import CourseEnrollment from '#models/course_enrollment'
import { DateTime } from 'luxon'

export default class extends BaseSeeder {
  async run() {
    // Trouver l'utilisateur étudiant de test
    const student = await User.query()
      .where('email', 'student@edonis.test')
      .preload('roles')
      .first()

    if (!student) {
      console.log('❌ Student user not found. Please run user_seeder first.')
      return
    }

    // Trouver les cours publiés
    const courses = await Course.query()
      .where('status', 'published')
      .where('allow_enrollment', true)
      .limit(3)

    if (courses.length === 0) {
      console.log('❌ No published courses found. Please run course_seeder first.')
      return
    }

    // Inscrire l'étudiant dans les cours
    for (const [index, course] of courses.entries()) {
      const existing = await CourseEnrollment.query()
        .where('user_id', student.id)
        .where('course_id', course.id)
        .first()

      if (!existing) {
        await CourseEnrollment.create({
          userId: student.id,
          courseId: course.id,
          courseRole: 'student',
          status: 'active',
          enrolledAt: DateTime.now().minus({ days: 20 - index * 5 }),
          progressPercentage: index === 0 ? 65 : index === 1 ? 30 : 10, // Progression différente par cours
          lastAccessAt: DateTime.now().minus({ hours: index * 2 }),
          completedAt: null,
        })
      }
    }

    console.log('✅ Student enrolled in demo courses successfully!')
  }
}
