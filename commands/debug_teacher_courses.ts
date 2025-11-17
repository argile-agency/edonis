import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'
import Course from '#models/course'

export default class DebugTeacherCourses extends BaseCommand {
  static commandName = 'debug:teacher:courses'
  static description = 'Debug teacher courses assignment'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Debugging teacher courses assignment...')

    // First, check all users and their roles
    const allUsers = await User.query().preload('roles')
    this.logger.info(`\nAll users in database (${allUsers.length}):`)
    for (const user of allUsers) {
      this.logger.info(
        `- ID: ${user.id}, Email: ${user.email}, Roles: ${user.roles.map((r) => `${r.name} (slug: ${r.slug})`).join(', ') || 'NO ROLES'}`
      )
    }

    // Find all users with teacher or instructor role
    const teachers = await User.query()
      .whereHas('roles', (query) => {
        query.whereIn('slug', ['instructor', 'teacher'])
      })
      .preload('roles')

    this.logger.info(`\nFound ${teachers.length} teachers/instructors:`)
    for (const teacher of teachers) {
      this.logger.info(
        `- ID: ${teacher.id}, Email: ${teacher.email}, Name: ${teacher.fullName}, Roles: ${teacher.roles.map((r) => r.name).join(', ')}`
      )

      // Find courses for this teacher
      const courses = await Course.query().where('instructor_id', teacher.id)
      this.logger.info(`  -> Has ${courses.length} courses:`)
      for (const course of courses) {
        this.logger.info(
          `     - ${course.code}: ${course.title} (Status: ${course.status}, Visibility: ${course.visibility})`
        )
      }
    }

    // Show all courses
    this.logger.info('\nAll courses in database:')
    const allCourses = await Course.query().preload('instructor')
    for (const course of allCourses) {
      this.logger.info(
        `- ${course.code}: ${course.title} (Instructor ID: ${course.instructorId}, Status: ${course.status})`
      )
    }
  }
}
