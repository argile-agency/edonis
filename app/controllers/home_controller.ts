import type { HttpContext } from '@adonisjs/core/http'
import CourseEnrollment from '#models/course_enrollment'
import { DateTime } from 'luxon'

export default class HomeController {
  /**
   * Afficher la page d'accueil
   * GET /
   */
  async index({ auth, inertia }: HttpContext) {
    const user = auth.user

    if (!user) {
      // Visiteur non connecté
      return inertia.render('home')
    }

    await user.load('roles')

    // Déterminer le rôle de l'utilisateur
    const roles = user.roles.map((r) => r.slug)
    const isStudent = roles.includes('student')
    const isInstructor = roles.includes('instructor') || roles.includes('teacher')

    let dashboardData = {}

    if (isStudent) {
      // Récupérer les données pour l'étudiant
      const enrollments = await CourseEnrollment.query()
        .where('user_id', user.id)
        .where('status', 'active')
        .preload('course')
        .orderBy('last_access_at', 'desc')
        .limit(5)

      const enrolledCourses = enrollments.map((enrollment) => ({
        id: enrollment.course.id,
        code: enrollment.course.code,
        title: enrollment.course.title,
        progress: enrollment.progressPercentage,
        lastAccess: enrollment.lastAccessAt?.toFormat('dd/MM/yyyy'),
        currentChapter: this.getCurrentChapter(enrollment.progressPercentage),
      }))

      // Prochaines échéances (simulées pour la démo)
      const upcomingDeadlines = [
        {
          id: 1,
          title: 'Quiz JavaScript',
          courseTitle: enrolledCourses[0]?.title || 'Développement Web Moderne',
          dueDate: DateTime.now().plus({ days: 2 }).toFormat('dd/MM/yyyy'),
          daysRemaining: 2,
        },
        {
          id: 2,
          title: 'Projet final React',
          courseTitle: enrolledCourses[0]?.title || 'Développement Web Moderne',
          dueDate: DateTime.now().plus({ days: 5 }).toFormat('dd/MM/yyyy'),
          daysRemaining: 5,
        },
      ]

      // Statistiques de l'étudiant
      const stats = {
        coursesCompleted: await CourseEnrollment.query()
          .where('user_id', user.id)
          .where('status', 'completed')
          .count('* as total')
          .then((result) => result[0]?.$extras.total || 0),
        hoursLearned: Math.round(
          enrollments.reduce(
            (sum, e) => sum + (e.progressPercentage / 100) * (e.course.estimatedHours || 40),
            0
          )
        ),
        averageGrade: 85, // Simulé pour la démo
      }

      // Notifications récentes (simulées)
      const notifications = [
        {
          id: 1,
          type: 'assignment',
          title: 'Nouveau devoir disponible',
          message: `${enrolledCourses[0]?.title || 'Développement Web Moderne'} - Il y a 2 heures`,
          icon: 'FileText',
        },
        {
          id: 2,
          type: 'grade',
          title: 'Note reçue',
          message: 'Quiz JavaScript: 18/20 - Hier',
          icon: 'Award',
        },
      ]

      dashboardData = {
        enrolledCourses,
        upcomingDeadlines,
        stats,
        notifications,
      }
    } else if (isInstructor) {
      // Récupérer les données pour l'instructeur
      const { default: Course } = await import('#models/course')

      const instructorCourses = await Course.query()
        .where('instructor_id', user.id)
        .where('status', 'published')
        .select('id', 'code', 'title', 'enrolled_count')

      const myCourses = instructorCourses.map((course) => ({
        id: course.id,
        code: course.code,
        title: course.title,
        enrolledCount: course.enrolledCount || 0,
        status: 'Actif',
      }))

      // Travaux à corriger (simulé)
      const pendingWork = [
        {
          id: 1,
          title: 'Projet final - React',
          courseTitle: myCourses[0]?.title || 'Développement Web Moderne',
          submissionsCount: 8,
        },
        {
          id: 2,
          title: 'Quiz JavaScript',
          courseTitle: myCourses[0]?.title || 'Développement Web Moderne',
          submissionsCount: 4,
        },
      ]

      // Statistiques de l'instructeur
      const stats = {
        totalStudents: instructorCourses.reduce((sum, c) => sum + (c.enrolledCount || 0), 0),
        activeCourses: instructorCourses.length,
        averageCompletion: 78, // Simulé
      }

      dashboardData = {
        myCourses,
        pendingWork,
        stats,
      }
    }

    return inertia.render('home', {
      dashboardData,
    })
  }

  /**
   * Détermine le chapitre actuel basé sur la progression
   */
  private getCurrentChapter(progress: number): string {
    if (progress < 25) return 'Chapitre 1: Introduction'
    if (progress < 50) return 'Chapitre 2: Fondamentaux'
    if (progress < 75) return 'Chapitre 3: Concepts avancés'
    return 'Chapitre 4: Projet final'
  }
}
