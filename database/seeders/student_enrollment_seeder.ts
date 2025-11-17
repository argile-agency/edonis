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

    // Trouver tous les cours
    const allCourses = await Course.query().preload('instructor')

    if (allCourses.length === 0) {
      console.log('❌ No courses found. Please run course_seeder first.')
      return
    }

    // Inscrire les instructeurs/propriétaires dans leurs propres cours
    for (const course of allCourses) {
      const existingInstructor = await CourseEnrollment.query()
        .where('user_id', course.instructorId)
        .where('course_id', course.id)
        .first()

      if (!existingInstructor) {
        await CourseEnrollment.create({
          userId: course.instructorId,
          courseId: course.id,
          courseRole: 'instructor',
          status: 'active',
          enrolledAt: course.createdAt || DateTime.now(),
          progressPercentage: 100,
          lastAccessAt: DateTime.now(),
          completedAt: null,
        })
      }
    }

    // Trouver les cours publiés pour l'étudiant
    const courses = await Course.query()
      .where('status', 'published')
      .where('allow_enrollment', true)
      .limit(3)

    if (courses.length === 0) {
      console.log('❌ No published courses found.')
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

    console.log('✅ Instructors enrolled in their courses successfully!')
    console.log('✅ Student enrolled in demo courses successfully!')
  }
}
