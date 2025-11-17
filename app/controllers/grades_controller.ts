import type { HttpContext } from '@adonisjs/core/http'
import Course from '#models/course'
import CourseEnrollment from '#models/course_enrollment'
import Assignment from '#models/assignment'
import Submission from '#models/submission'
import GradeCategory from '#models/grade_category'
import db from '@adonisjs/lucid/services/db'

export default class GradesController {
  /**
   * Display all grades for the current user across all courses
   */
  async index({ auth, inertia }: HttpContext) {
    const user = auth.user!

    // Get all enrollments for the student
    const enrollments = await CourseEnrollment.query()
      .where('user_id', user.id)
      .preload('course', (query) => {
        query.preload('instructor')
      })
      .orderBy('created_at', 'desc')

    // For each enrollment, calculate grades
    const gradesData = await Promise.all(
      enrollments.map(async (enrollment) => {
        const courseId = enrollment.courseId

        // Get all assignments for this course
        const assignments = await Assignment.query()
          .where('course_id', courseId)
          .where('is_published', true)
          .preload('gradeCategory')

        // Get all submissions for this student
        const submissions = await Submission.query()
          .whereIn(
            'assignment_id',
            assignments.map((a) => a.id)
          )
          .where('student_id', user.id)
          .where('status', 'graded')

        // Calculate overall grade
        let totalPoints = 0
        let earnedPoints = 0
        let gradedCount = 0

        submissions.forEach((submission) => {
          const assignment = assignments.find((a) => a.id === submission.assignmentId)
          if (assignment && submission.pointsEarned !== null) {
            totalPoints += assignment.maxPoints
            earnedPoints += submission.pointsEarned
            gradedCount++
          }
        })

        const overallGrade = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : null

        return {
          course: enrollment.course.serialize(),
          assignmentCount: assignments.length,
          submittedCount: submissions.filter((s) => s.status !== 'draft').length,
          gradedCount,
          overallGrade,
          earnedPoints,
          totalPoints,
        }
      })
    )

    return inertia.render('grades/index', {
      grades: gradesData,
    })
  }

  /**
   * Display gradebook for a specific course
   */
  async course({ auth, params, inertia, response }: HttpContext) {
    const user = auth.user!
    const courseId = params.id

    // Get the course
    const course = await Course.query().where('id', courseId).preload('instructor').firstOrFail()

    // Check if user is enrolled or is instructor
    const isInstructor = course.instructorId === user.id
    const enrollment = await CourseEnrollment.query()
      .where('course_id', courseId)
      .where('user_id', user.id)
      .first()

    if (!isInstructor && !enrollment) {
      return response.forbidden('You do not have access to this gradebook')
    }

    // Get grade categories
    const categories = await GradeCategory.query()
      .where('course_id', courseId)
      .orderBy('position', 'asc')

    // Get all assignments with their categories
    const assignments = await Assignment.query()
      .where('course_id', courseId)
      .where('is_published', true)
      .preload('gradeCategory')
      .preload('module')
      .orderBy('position', 'asc')

    if (isInstructor) {
      // Instructor view: Show all students and their grades
      const students = await db
        .from('course_enrollments')
        .join('users', 'course_enrollments.user_id', 'users.id')
        .where('course_enrollments.course_id', courseId)
        .select(
          'users.id',
          'users.email',
          'users.full_name',
          'course_enrollments.enrolled_at',
          'course_enrollments.status as enrollment_status'
        )
        .orderBy('users.full_name', 'asc')

      // Get all submissions for all students
      const submissions = await Submission.query()
        .whereIn(
          'assignment_id',
          assignments.map((a) => a.id)
        )
        .preload('student')

      // Build gradebook matrix
      const gradebook = students.map((student) => {
        const studentSubmissions = submissions.filter((s) => s.studentId === student.id)

        const grades = assignments.map((assignment) => {
          const submission = studentSubmissions.find((s) => s.assignmentId === assignment.id)
          return {
            assignmentId: assignment.id,
            submissionId: submission?.id,
            status: submission?.status || 'not_submitted',
            grade: submission?.grade,
            pointsEarned: submission?.pointsEarned,
            maxPoints: assignment.maxPoints,
            isLate: submission?.isLate || false,
            submittedAt: submission?.submittedAt?.toISO(),
          }
        })

        // Calculate overall grade
        let totalPoints = 0
        let earnedPoints = 0

        grades.forEach((g) => {
          if (g.pointsEarned !== null && g.pointsEarned !== undefined) {
            totalPoints += g.maxPoints
            earnedPoints += g.pointsEarned
          }
        })

        const overallGrade = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : null

        return {
          student,
          grades,
          overallGrade,
          earnedPoints,
          totalPoints,
        }
      })

      return inertia.render('grades/course', {
        course: course.serialize(),
        categories: categories.map((c) => c.serialize()),
        assignments: assignments.map((a) => ({
          id: a.id,
          title: a.title,
          maxPoints: a.maxPoints,
          dueDate: a.dueDate?.toISO(),
          categoryId: a.gradeCategoryId,
          category: a.gradeCategory?.name,
        })),
        gradebook,
        isInstructor: true,
      })
    } else {
      // Student view: Show only their grades
      const submissions = await Submission.query()
        .whereIn(
          'assignment_id',
          assignments.map((a) => a.id)
        )
        .where('student_id', user.id)
        .preload('grader')

      // Load grader relations
      await Promise.all(submissions.map((s) => s.load('grader')))

      const grades: any[] = []

      // First add submissions that exist
      for (const submission of submissions) {
        const assignment = assignments.find((a) => a.id === submission.assignmentId)!

        grades.push({
          assignment: {
            id: assignment.id,
            title: assignment.title,
            description: assignment.description,
            maxPoints: assignment.maxPoints,
            dueDate: assignment.dueDate?.toISO(),
            categoryId: assignment.gradeCategoryId,
            category: assignment.gradeCategory?.name,
            module: assignment.module?.title,
          },
          submission: {
            id: submission.id,
            status: submission.status,
            grade: submission.grade,
            pointsEarned: submission.pointsEarned,
            isLate: submission.isLate,
            submittedAt: submission.submittedAt?.toISO(),
            gradedAt: submission.gradedAt?.toISO(),
            feedback: submission.feedback,
            graderName: submission.grader?.fullName || null,
          },
        })
      }

      // Add assignments without submissions
      const assignmentsWithoutSubmissions = assignments.filter(
        (assignment) => !submissions.some((s) => s.assignmentId === assignment.id)
      )

      for (const assignment of assignmentsWithoutSubmissions) {
        grades.push({
          assignment: {
            id: assignment.id,
            title: assignment.title,
            description: assignment.description,
            maxPoints: assignment.maxPoints,
            dueDate: assignment.dueDate?.toISO(),
            categoryId: assignment.gradeCategoryId,
            category: assignment.gradeCategory?.name,
            module: assignment.module?.title,
          },
          submission: null,
        })
      }

      // Calculate overall grade
      let totalPoints = 0
      let earnedPoints = 0
      let gradedCount = 0

      grades.forEach((g) => {
        if (g.submission?.pointsEarned !== null && g.submission?.pointsEarned !== undefined) {
          totalPoints += g.assignment.maxPoints
          earnedPoints += g.submission.pointsEarned
          gradedCount++
        }
      })

      const overallGrade = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : null

      // Calculate grades by category
      const categoryGrades = categories.map((category) => {
        const categoryAssignments = grades.filter((g) => g.assignment.categoryId === category.id)
        let catTotal = 0
        let catEarned = 0

        categoryAssignments.forEach((g) => {
          if (g.submission?.pointsEarned !== null && g.submission?.pointsEarned !== undefined) {
            catTotal += g.assignment.maxPoints
            catEarned += g.submission.pointsEarned
          }
        })

        const categoryGrade = catTotal > 0 ? (catEarned / catTotal) * 100 : null

        return {
          ...category.serialize(),
          grade: categoryGrade,
          earnedPoints: catEarned,
          totalPoints: catTotal,
        }
      })

      return inertia.render('grades/course', {
        course: course.serialize(),
        categories: categoryGrades,
        grades,
        overallGrade,
        earnedPoints,
        totalPoints,
        gradedCount,
        isInstructor: false,
      })
    }
  }
}
