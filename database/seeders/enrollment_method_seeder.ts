import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Course from '#models/course'
import CourseCategory from '#models/course_category'
import CourseEnrollmentMethod from '#models/course_enrollment_method'
import CourseGroup from '#models/course_group'
import CourseGrouping from '#models/course_grouping'
import { DateTime } from 'luxon'

export default class extends BaseSeeder {
  async run() {
    // Clear existing enrollment methods and groups
    await CourseEnrollmentMethod.query().delete()
    await CourseGroup.query().delete()
    await CourseGrouping.query().delete()

    // Update courses with categories
    const programmationCat = await CourseCategory.findBy('slug', 'programmation')
    const webCat = await CourseCategory.findBy('slug', 'developpement-web')
    const mathCat = await CourseCategory.findBy('slug', 'mathematiques')
    const marketingCat = await CourseCategory.findBy('slug', 'marketing')
    const physiqueCat = await CourseCategory.findBy('slug', 'physique')
    const dataScienceCat = await CourseCategory.findBy('slug', 'data-science')

    // Update course categories and approval status
    let cs101 = await Course.findBy('code', 'CS101')
    if (cs101 && programmationCat) {
      cs101.categoryId = programmationCat.id
      cs101.approvalStatus = 'approved'
      await cs101.save()
      // Don't reload - just use the updated instance
    }

    let web201 = await Course.findBy('code', 'WEB201')
    if (web201 && webCat) {
      web201.categoryId = webCat.id
      web201.approvalStatus = 'approved'
      await web201.save()
    }

    let math101 = await Course.findBy('code', 'MATH101')
    if (math101 && mathCat) {
      math101.categoryId = mathCat.id
      math101.approvalStatus = 'approved'
      await math101.save()
    }

    let ai301 = await Course.findBy('code', 'AI301')
    if (ai301 && dataScienceCat) {
      ai301.categoryId = dataScienceCat.id
      ai301.approvalStatus = 'draft'
      await ai301.save()
    }

    let bus101 = await Course.findBy('code', 'BUS101')
    if (bus101 && marketingCat) {
      bus101.categoryId = marketingCat.id
      bus101.approvalStatus = 'approved'
      await bus101.save()
    }

    let sci201 = await Course.findBy('code', 'SCI201')
    if (sci201 && physiqueCat) {
      sci201.categoryId = physiqueCat.id
      sci201.approvalStatus = 'approved'
      await sci201.save()
    }

    // === CS101 - Introduction à la Programmation ===
    if (cs101) {
      // Create groupings
      const sectionsGrouping = await CourseGrouping.create({
        courseId: cs101.id,
        name: 'Sections',
        description: 'Sections du cours par niveau',
      })

      await CourseGrouping.create({
        courseId: cs101.id,
        name: 'Projets',
        description: 'Groupes de projets',
      })

      // Create groups
      const groupA = await CourseGroup.create({
        courseId: cs101.id,
        groupingId: sectionsGrouping.id,
        name: 'Section A - Débutants',
        description: 'Pour les étudiants sans expérience en programmation',
        maxMembers: 25,
        currentMembers: 0,
        isVisibleToStudents: true,
        enableGroupMessaging: true,
      })

      await CourseGroup.create({
        courseId: cs101.id,
        groupingId: sectionsGrouping.id,
        name: 'Section B - Intermédiaires',
        description: 'Pour les étudiants ayant quelques bases',
        maxMembers: 25,
        currentMembers: 0,
        isVisibleToStudents: true,
        enableGroupMessaging: true,
      })

      // Enrollment Method 1: Manual for instructors
      await CourseEnrollmentMethod.create({
        courseId: cs101.id,
        methodType: 'manual',
        isEnabled: true,
        sortOrder: 1,
        name: 'Inscription Manuelle (Enseignants)',
        maxEnrollments: null,
        currentEnrollments: 0,
        defaultRole: 'teaching_assistant',
        enrollmentStartDate: null,
        enrollmentEndDate: null,
        enrollmentDurationDays: null,
        sendWelcomeEmail: true,
        notifyInstructor: false,
      })

      // Enrollment Method 2: Self-enrollment with key for students
      await CourseEnrollmentMethod.create({
        courseId: cs101.id,
        methodType: 'key',
        isEnabled: true,
        sortOrder: 2,
        name: 'Auto-inscription avec Clé (Étudiants)',
        maxEnrollments: 50,
        currentEnrollments: 0,
        defaultRole: 'student',
        enrollmentStartDate: DateTime.now().minus({ days: 30 }),
        enrollmentEndDate: DateTime.now().plus({ days: 5 }),
        enrollmentDurationDays: 90,
        enrollmentKey: 'CS101-2024',
        keyCaseSensitive: false,
        autoAssignGroupId: groupA.id,
        welcomeMessage:
          'Bienvenue dans le cours Introduction à la Programmation ! Consultez le syllabus et rejoignez votre groupe.',
        sendWelcomeEmail: true,
        notifyInstructor: true,
      })
    }

    // === WEB201 - Développement Web Moderne ===
    if (web201) {
      // Create groupings
      const teamsGrouping = await CourseGrouping.create({
        courseId: web201.id,
        name: 'Équipes de Projet',
        description: 'Équipes pour le projet final',
      })

      // Create groups
      await CourseGroup.create({
        courseId: web201.id,
        groupingId: teamsGrouping.id,
        name: 'Équipe 1 - Frontend',
        description: 'Spécialisation React et UI/UX',
        maxMembers: 5,
        currentMembers: 0,
        isVisibleToStudents: true,
        enableGroupMessaging: true,
      })

      await CourseGroup.create({
        courseId: web201.id,
        groupingId: teamsGrouping.id,
        name: 'Équipe 2 - Backend',
        description: 'Spécialisation Node.js et APIs',
        maxMembers: 5,
        currentMembers: 0,
        isVisibleToStudents: true,
        enableGroupMessaging: true,
      })

      // Enrollment Method 1: Open self-enrollment
      await CourseEnrollmentMethod.create({
        courseId: web201.id,
        methodType: 'self',
        isEnabled: true,
        sortOrder: 1,
        name: 'Auto-inscription Ouverte',
        maxEnrollments: 40,
        currentEnrollments: 0,
        defaultRole: 'student',
        enrollmentStartDate: DateTime.now().minus({ days: 15 }),
        enrollmentEndDate: DateTime.now().plus({ days: 10 }),
        enrollmentDurationDays: 90,
        welcomeMessage:
          'Bienvenue dans Développement Web Moderne ! Ce cours couvre React, Node.js et bien plus.',
        sendWelcomeEmail: true,
        notifyInstructor: false,
      })

      // Enrollment Method 2: Manual for TAs
      await CourseEnrollmentMethod.create({
        courseId: web201.id,
        methodType: 'manual',
        isEnabled: true,
        sortOrder: 2,
        name: 'Ajout Manuel (Assistants)',
        maxEnrollments: null,
        currentEnrollments: 0,
        defaultRole: 'teaching_assistant',
        sendWelcomeEmail: true,
        notifyInstructor: true,
      })
    }

    // === MATH101 - Mathématiques pour Data Science ===
    if (math101) {
      // Enrollment Method 1: Approval required
      await CourseEnrollmentMethod.create({
        courseId: math101.id,
        methodType: 'approval',
        isEnabled: true,
        sortOrder: 1,
        name: 'Inscription avec Approbation',
        maxEnrollments: null,
        currentEnrollments: 0,
        defaultRole: 'student',
        requiresApproval: true,
        approvalMessage:
          'Ce cours nécessite des prérequis en mathématiques. Veuillez expliquer votre niveau et motivation.',
        welcomeMessage:
          'Félicitations ! Votre inscription a été approuvée. Bienvenue dans le cours.',
        sendWelcomeEmail: true,
        notifyInstructor: true,
      })

      // Enrollment Method 2: Key for cohort students
      await CourseEnrollmentMethod.create({
        courseId: math101.id,
        methodType: 'key',
        isEnabled: true,
        sortOrder: 2,
        name: 'Clé L2/L3 Informatique',
        maxEnrollments: 100,
        currentEnrollments: 0,
        defaultRole: 'student',
        enrollmentKey: 'MATH-L2L3-2024',
        keyCaseSensitive: false,
        enrollmentDurationDays: 120,
        welcomeMessage: 'Bienvenue ! Ce cours est essentiel pour votre parcours en Data Science.',
        sendWelcomeEmail: true,
        notifyInstructor: false,
      })
    }

    // === BUS101 - Marketing Digital ===
    if (bus101) {
      // Create groupings
      const workshopsGrouping = await CourseGrouping.create({
        courseId: bus101.id,
        name: 'Ateliers Pratiques',
        description: 'Groupes pour les ateliers pratiques',
      })

      // Create groups
      await CourseGroup.create({
        courseId: bus101.id,
        groupingId: workshopsGrouping.id,
        name: 'Atelier SEO',
        description: 'Optimisation pour moteurs de recherche',
        maxMembers: 20,
        currentMembers: 0,
        isVisibleToStudents: true,
        enableGroupMessaging: true,
      })

      await CourseGroup.create({
        courseId: bus101.id,
        groupingId: workshopsGrouping.id,
        name: 'Atelier Social Media',
        description: 'Gestion des réseaux sociaux',
        maxMembers: 20,
        currentMembers: 0,
        isVisibleToStudents: true,
        enableGroupMessaging: true,
      })

      // Enrollment Method: Open enrollment
      await CourseEnrollmentMethod.create({
        courseId: bus101.id,
        methodType: 'self',
        isEnabled: true,
        sortOrder: 1,
        name: 'Inscription Libre',
        maxEnrollments: 60,
        currentEnrollments: 0,
        defaultRole: 'student',
        enrollmentStartDate: DateTime.now().minus({ days: 5 }),
        enrollmentEndDate: DateTime.now().plus({ days: 15 }),
        enrollmentDurationDays: 100,
        welcomeMessage:
          'Bienvenue dans Fondamentaux du Marketing Digital ! Préparez-vous à transformer votre stratégie marketing.',
        sendWelcomeEmail: true,
        notifyInstructor: false,
      })
    }

    console.log('✅ Created enrollment methods, groups, and groupings successfully!')
  }
}
