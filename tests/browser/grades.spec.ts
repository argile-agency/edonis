import { test } from '@japa/runner'
import User from '#models/user'
import Course from '#models/course'
import Assignment from '#models/assignment'
import Submission from '#models/submission'
import GradeCategory from '#models/grade_category'
import CourseEnrollment from '#models/course_enrollment'
import { DateTime } from 'luxon'

test.group('Grades - Browser Tests', (group) => {
  let student: User
  let instructor: User
  let course: Course

  group.each.setup(async () => {
    // Create test users
    student = await User.create({
      email: 'student@edonis.test',
      password: 'password',
      fullName: 'Test Student',
    })

    instructor = await User.create({
      email: 'instructor@edonis.test',
      password: 'password',
      fullName: 'Dr. Jane Smith',
    })

    // Create a course
    course = await Course.create({
      code: 'CS101',
      title: 'Introduction to Computer Science',
      description: 'Learn the fundamentals of computer science',
      instructorId: instructor.id,
      status: 'published',
      visibility: 'public',
      language: 'en',
      allowEnrollment: true,
      enrolledCount: 1,
      completedCount: 0,
      approvalStatus: 'approved',
    })

    // Enroll student
    await CourseEnrollment.create({
      userId: student.id,
      courseId: course.id,
      status: 'active',
      enrolledAt: DateTime.now(),
    })
  })

  group.each.teardown(async () => {
    // Clean up
    await Submission.query().delete()
    await Assignment.query().delete()
    await GradeCategory.query().delete()
    await CourseEnrollment.query().delete()
    await Course.query().delete()
    await User.query().delete()
  })

  test('student can navigate to grades page from navigation', async ({ visit }) => {
    const page = await visit('/login')

    // Login as student
    await page.locator('input[name="email"]').fill('student@edonis.test')
    await page.locator('input[name="password"]').fill('password')
    await page.locator('button[type="submit"]').click()

    await page.waitForURL('/dashboard')

    // Navigate to grades (if there's a link in navigation)
    await page.goto('/grades')
    await page.waitForLoadState('networkidle')

    // Verify we're on the grades page
    await page.locator('h1:has-text("Mes Notes")').isVisible()
  })

  test('student sees grades overview with statistics', async ({ visit }) => {
    // Create some test data
    const assignment = await Assignment.create({
      courseId: course.id,
      title: 'Midterm Project',
      assignmentType: 'file_upload',
      maxPoints: 100,
      isPublished: true,
      gradingType: 'points',
      maxAttempts: 1,
      allowLateSubmissions: true,
      useRubric: false,
      requireSubmissionStatement: false,
      position: 1,
    })

    await Submission.create({
      assignmentId: assignment.id,
      studentId: student.id,
      attemptNumber: 1,
      status: 'graded',
      submittedAt: DateTime.now(),
      isLate: false,
      pointsEarned: 85,
      grade: 85,
      gradedBy: instructor.id,
      gradedAt: DateTime.now(),
      feedback: 'Excellent work on the project!',
      requiresGrading: false,
    })

    const page = await visit('/login')

    await page.locator('input[name="email"]').fill('student@edonis.test')
    await page.locator('input[name="password"]').fill('password')
    await page.locator('button[type="submit"]').click()

    await page.waitForURL('/dashboard')
    await page.goto('/grades')
    await page.waitForLoadState('networkidle')

    // Check statistics cards
    await page.locator('text=Moyenne Générale').isVisible()
    await page.locator('text=Cours Actifs').isVisible()
    await page.locator('text=Devoirs Soumis').isVisible()

    // Check course is listed
    await page.locator(`text=${course.code}`).isVisible()
    await page.locator(`text=${course.title}`).isVisible()
  })

  test('student can view course gradebook details', async ({ visit }) => {
    // Create grade category
    const category = await GradeCategory.create({
      courseId: course.id,
      name: 'Assignments',
      description: 'Course assignments',
      weight: 60,
      dropLowest: false,
      dropLowestCount: 0,
      position: 1,
    })

    // Create assignment
    const assignment = await Assignment.create({
      courseId: course.id,
      gradeCategoryId: category.id,
      title: 'Final Project',
      description: 'Create a full-stack web application',
      assignmentType: 'file_upload',
      maxPoints: 100,
      isPublished: true,
      gradingType: 'points',
      dueDate: DateTime.now().plus({ days: 7 }),
      maxAttempts: 1,
      allowLateSubmissions: true,
      useRubric: false,
      requireSubmissionStatement: false,
      position: 1,
    })

    await Submission.create({
      assignmentId: assignment.id,
      studentId: student.id,
      attemptNumber: 1,
      status: 'graded',
      submittedAt: DateTime.now().minus({ days: 1 }),
      isLate: false,
      pointsEarned: 92,
      grade: 92,
      gradedBy: instructor.id,
      gradedAt: DateTime.now(),
      feedback: 'Outstanding project! Great attention to detail and clean code.',
      requiresGrading: false,
    })

    const page = await visit('/login')

    await page.locator('input[name="email"]').fill('student@edonis.test')
    await page.locator('input[name="password"]').fill('password')
    await page.locator('button[type="submit"]').click()

    await page.waitForURL('/dashboard')
    await page.goto(`/grades/courses/${course.id}`)
    await page.waitForLoadState('networkidle')

    // Check course header
    await page.locator(`text=${course.code}`).isVisible()
    await page.locator(`text=${course.title}`).isVisible()
    await page.locator('text=Dr. Jane Smith').isVisible()

    // Check grade display
    await page.locator('text=92.0%').isVisible()

    // Check assignment list
    await page.locator('text=Final Project').isVisible()
    await page.locator('text=92.0 / 100').isVisible()
    await page
      .locator('text=Outstanding project! Great attention to detail and clean code.')
      .isVisible()

    // Check tabs
    await page.locator('text=Devoirs').isVisible()
    await page.locator('text=Par Catégorie').isVisible()

    // Switch to category view
    await page.locator('text=Par Catégorie').click()
    await page.waitForTimeout(500)
    await page.locator('text=Assignments').isVisible()
    await page.locator('text=Pondération: 60%').isVisible()
  })

  test('instructor can view gradebook matrix', async ({ visit }) => {
    // Create another student
    const student2 = await User.create({
      email: 'student2@edonis.test',
      password: 'password',
      fullName: 'Alice Johnson',
    })

    await CourseEnrollment.create({
      userId: student2.id,
      courseId: course.id,
      status: 'active',
      enrolledAt: DateTime.now(),
    })

    // Create assignments
    const assignment1 = await Assignment.create({
      courseId: course.id,
      title: 'Quiz 1',
      assignmentType: 'online_text',
      maxPoints: 50,
      isPublished: true,
      gradingType: 'points',
      maxAttempts: 1,
      allowLateSubmissions: true,
      useRubric: false,
      requireSubmissionStatement: false,
      position: 1,
    })

    const assignment2 = await Assignment.create({
      courseId: course.id,
      title: 'Quiz 2',
      assignmentType: 'online_text',
      maxPoints: 50,
      isPublished: true,
      gradingType: 'points',
      maxAttempts: 1,
      allowLateSubmissions: true,
      useRubric: false,
      requireSubmissionStatement: false,
      position: 2,
    })

    // Create submissions
    await Submission.create({
      assignmentId: assignment1.id,
      studentId: student.id,
      attemptNumber: 1,
      status: 'graded',
      submittedAt: DateTime.now(),
      isLate: false,
      pointsEarned: 45,
      grade: 90,
      gradedBy: instructor.id,
      gradedAt: DateTime.now(),
      requiresGrading: false,
    })

    await Submission.create({
      assignmentId: assignment1.id,
      studentId: student2.id,
      attemptNumber: 1,
      status: 'graded',
      submittedAt: DateTime.now(),
      isLate: false,
      pointsEarned: 48,
      grade: 96,
      gradedBy: instructor.id,
      gradedAt: DateTime.now(),
      requiresGrading: false,
    })

    await Submission.create({
      assignmentId: assignment2.id,
      studentId: student.id,
      attemptNumber: 1,
      status: 'graded',
      submittedAt: DateTime.now(),
      isLate: false,
      pointsEarned: 42,
      grade: 84,
      gradedBy: instructor.id,
      gradedAt: DateTime.now(),
      requiresGrading: false,
    })

    const page = await visit('/login')

    await page.locator('input[name="email"]').fill('instructor@edonis.test')
    await page.locator('input[name="password"]').fill('password')
    await page.locator('button[type="submit"]').click()

    await page.waitForURL('/dashboard')
    await page.goto(`/grades/courses/${course.id}`)
    await page.waitForLoadState('networkidle')

    // Check gradebook table header
    await page.locator('text=Tableau des Notes').isVisible()
    await page.locator('text=Exporter (CSV)').isVisible()

    // Check student names in table
    await page.locator('text=Test Student').isVisible()
    await page.locator('text=Alice Johnson').isVisible()

    // Check assignment headers
    await page.locator('text=Quiz 1').isVisible()
    await page.locator('text=Quiz 2').isVisible()

    // Check grades are displayed
    await page.locator('text=45.0').first().isVisible() // Student 1, Quiz 1
    await page.locator('text=48.0').first().isVisible() // Student 2, Quiz 1
    await page.locator('text=42.0').first().isVisible() // Student 1, Quiz 2
  })

  test('late submission is marked appropriately', async ({ visit }) => {
    const assignment = await Assignment.create({
      courseId: course.id,
      title: 'Homework 1',
      assignmentType: 'file_upload',
      maxPoints: 100,
      isPublished: true,
      gradingType: 'points',
      dueDate: DateTime.now().minus({ days: 3 }),
      cutOffDate: DateTime.now().plus({ days: 7 }),
      maxAttempts: 1,
      allowLateSubmissions: true,
      latePenaltyPercent: 10,
      useRubric: false,
      requireSubmissionStatement: false,
      position: 1,
    })

    await Submission.create({
      assignmentId: assignment.id,
      studentId: student.id,
      attemptNumber: 1,
      status: 'graded',
      submittedAt: DateTime.now().minus({ days: 1 }),
      isLate: true,
      pointsEarned: 81, // 90 - 10% penalty
      grade: 81,
      gradedBy: instructor.id,
      gradedAt: DateTime.now(),
      feedback: 'Good work, but submitted late.',
      requiresGrading: false,
    })

    const page = await visit('/login')

    await page.locator('input[name="email"]').fill('student@edonis.test')
    await page.locator('input[name="password"]').fill('password')
    await page.locator('button[type="submit"]').click()

    await page.waitForURL('/dashboard')
    await page.goto(`/grades/courses/${course.id}`)
    await page.waitForLoadState('networkidle')

    // Check for late badge
    await page.locator('text=En retard').isVisible()
  })

  test('unauthenticated user redirected to login', async ({ visit }) => {
    const page = await visit('/grades')
    await page.waitForURL('/login')
    await page.locator('text=Connexion').isVisible()
  })
})
