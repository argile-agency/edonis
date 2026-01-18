/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

const UsersController = () => import('#controllers/users_controller')
const AuthController = () => import('#controllers/auth_controller')
const DashboardController = () => import('#controllers/dashboard_controller')
const HomeController = () => import('#controllers/home_controller')
const CoursesController = () => import('#controllers/courses_controller')
const EnrollmentsController = () => import('#controllers/enrollments_controller')
const CategoriesController = () => import('#controllers/categories_controller')
const EvaluationsController = () => import('#controllers/evaluations_controller')
const CourseContentsController = () => import('#controllers/course_contents_controller')
const PagesController = () => import('#controllers/pages_controller')
const GradesController = () => import('#controllers/grades_controller')

router.get('/', [HomeController, 'index']).as('home')

// Component Showcase (development)
router
  .get('/showcase', async ({ inertia }) => {
    return inertia.render('showcase')
  })
  .as('showcase')

/*
|--------------------------------------------------------------------------
| Routes des pages statiques
|--------------------------------------------------------------------------
| Pages publiques : About, Contact, Privacy
*/
router.get('/about', [PagesController, 'about']).as('about')
router.get('/contact', [PagesController, 'contact']).as('contact')
router.get('/privacy', [PagesController, 'privacy']).as('privacy')

/*
|--------------------------------------------------------------------------
| Route Dashboard
|--------------------------------------------------------------------------
| Tableau de bord principal après connexion
*/
router.get('/dashboard', [DashboardController, 'index']).as('dashboard').use(middleware.auth())

/*
|--------------------------------------------------------------------------
| Routes d'authentification
|--------------------------------------------------------------------------
| Routes publiques pour login, register, logout
*/
router
  .group(() => {
    // Login
    router.get('/login', [AuthController, 'showLogin']).as('login')
    router.post('/login', [AuthController, 'login'])

    // Register
    router.get('/register', [AuthController, 'showRegister']).as('register')
    router.post('/register', [AuthController, 'register'])
  })
  .use(middleware.guest())

// Logout (nécessite authentification)
router.post('/logout', [AuthController, 'logout']).as('logout').use(middleware.auth())

/*
|--------------------------------------------------------------------------
| Routes d'administration des utilisateurs
|--------------------------------------------------------------------------
| Routes protégées par authentification et rôles admin/manager
*/
router
  .group(() => {
    // Liste et recherche des utilisateurs
    router.get('/users', [UsersController, 'index']).as('users.index')

    // Créer un utilisateur
    router.get('/users/create', [UsersController, 'create']).as('users.create')
    router.post('/users', [UsersController, 'store']).as('users.store')

    // Voir un utilisateur
    router.get('/users/:id', [UsersController, 'show']).as('users.show')

    // Éditer un utilisateur
    router.get('/users/:id/edit', [UsersController, 'edit']).as('users.edit')
    router.put('/users/:id', [UsersController, 'update']).as('users.update')
    router.patch('/users/:id', [UsersController, 'update'])

    // Supprimer/Activer un utilisateur
    router.delete('/users/:id', [UsersController, 'destroy']).as('users.destroy')
    router.post('/users/:id/activate', [UsersController, 'activate']).as('users.activate')
    router.delete('/users/:id/force', [UsersController, 'forceDestroy']).as('users.forceDestroy')
  })
  .prefix('/admin')
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin'] }))

/*
|--------------------------------------------------------------------------
| Routes des évaluations
|--------------------------------------------------------------------------
| Routes pour gérer les évaluations à corriger (instructeurs)
*/
router
  .group(() => {
    router.get('/evaluations', [EvaluationsController, 'index']).as('evaluations.index')
  })
  .use(middleware.auth())

/*
|--------------------------------------------------------------------------
| Routes des notes (Grades/Gradebook)
|--------------------------------------------------------------------------
| Routes pour consulter les notes et carnets de notes
*/
router
  .group(() => {
    // Vue d'ensemble des notes pour l'étudiant
    router.get('/grades', [GradesController, 'index']).as('grades.index')

    // Carnet de notes d'un cours spécifique
    router.get('/grades/courses/:id', [GradesController, 'course']).as('grades.course')
  })
  .use(middleware.auth())

/*
|--------------------------------------------------------------------------
| Routes de gestion des cours
|--------------------------------------------------------------------------
| Routes pour les cours (CRUD + permissions)
*/

// Course creation (must come before /courses/:id to avoid route conflict)
router
  .group(() => {
    router.get('/courses/create', [CoursesController, 'create']).as('courses.create')
    router.post('/courses', [CoursesController, 'store']).as('courses.store')
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin', 'manager', 'teacher'] }))

// Public course browsing (authenticated users)
router
  .group(() => {
    router.get('/courses', [CoursesController, 'index']).as('courses.index')
    router.get('/courses/:id', [CoursesController, 'show']).as('courses.show')
  })
  .use(middleware.auth())

// Course management (managers, teachers and admins)
router
  .group(() => {
    router.get('/courses/:id/edit', [CoursesController, 'edit']).as('courses.edit')
    router.put('/courses/:id', [CoursesController, 'update']).as('courses.update')
    router.patch('/courses/:id', [CoursesController, 'update'])
    router.delete('/courses/:id', [CoursesController, 'destroy']).as('courses.destroy')

    // Course actions
    router.post('/courses/:id/publish', [CoursesController, 'publish']).as('courses.publish')
    router.post('/courses/:id/archive', [CoursesController, 'archive']).as('courses.archive')

    // Course permissions
    router
      .post('/courses/:id/permissions', [CoursesController, 'addPermission'])
      .as('courses.permissions.add')
    router
      .delete('/courses/:courseId/permissions/:permissionId', [
        CoursesController,
        'removePermission',
      ])
      .as('courses.permissions.remove')
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin', 'manager', 'teacher'] }))

/*
|--------------------------------------------------------------------------
| Routes de gestion du contenu des cours
|--------------------------------------------------------------------------
| Routes pour gérer les modules et le contenu (instructeurs et admins)
*/

// Course content viewing (students)
router
  .group(() => {
    router.get('/courses/:id/learn', [CourseContentsController, 'learn']).as('courses.learn')
    router.get('/courses/:id/outline', [CourseContentsController, 'outline']).as('courses.outline')
    router
      .get('/courses/:id/progress', [CourseContentsController, 'getCourseProgress'])
      .as('courses.progress')

    // Progress tracking
    router
      .post('/contents/:contentId/progress', [CourseContentsController, 'updateProgress'])
      .as('contents.progress.update')
    router
      .post('/contents/:contentId/complete', [CourseContentsController, 'markComplete'])
      .as('contents.complete')
  })
  .use(middleware.auth())

// Course content builder (instructors and admins)
router
  .group(() => {
    router.get('/courses/:id/builder', [CourseContentsController, 'builder']).as('courses.builder')

    // Module management
    router
      .post('/courses/:id/modules', [CourseContentsController, 'createModule'])
      .as('courses.modules.create')
    router
      .put('/modules/:moduleId', [CourseContentsController, 'updateModule'])
      .as('modules.update')
    router
      .delete('/modules/:moduleId', [CourseContentsController, 'deleteModule'])
      .as('modules.delete')
    router
      .post('/courses/:id/modules/reorder', [CourseContentsController, 'reorderModules'])
      .as('courses.modules.reorder')

    // Content management
    router
      .post('/modules/:moduleId/contents', [CourseContentsController, 'createContent'])
      .as('modules.contents.create')
    router
      .put('/contents/:contentId', [CourseContentsController, 'updateContent'])
      .as('contents.update')
    router
      .delete('/contents/:contentId', [CourseContentsController, 'deleteContent'])
      .as('contents.delete')
    router
      .post('/modules/:moduleId/contents/reorder', [CourseContentsController, 'reorderContents'])
      .as('modules.contents.reorder')
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin', 'manager', 'teacher'] }))

/*
|--------------------------------------------------------------------------
| Routes d'inscription aux cours (Enrollments)
|--------------------------------------------------------------------------
| Routes pour l'inscription des étudiants aux cours
*/
router
  .group(() => {
    // Page d'inscription à un cours
    router.get('/courses/:id/enroll', [EnrollmentsController, 'show']).as('enrollments.show')

    // Différentes méthodes d'inscription
    router
      .post('/courses/:id/enroll/key', [EnrollmentsController, 'enrollWithKey'])
      .as('enrollments.enroll-key')
    router
      .post('/courses/:id/enroll/self', [EnrollmentsController, 'enrollSelf'])
      .as('enrollments.enroll-self')
    router
      .post('/courses/:id/enroll/request', [EnrollmentsController, 'requestEnrollment'])
      .as('enrollments.request')

    // Désinscription
    router
      .delete('/enrollments/:enrollmentId', [EnrollmentsController, 'unenroll'])
      .as('enrollments.unenroll')
  })
  .use(middleware.auth())

// Inscription manuelle (managers/teachers/admin)
router
  .group(() => {
    router
      .post('/courses/:id/enroll/manual', [EnrollmentsController, 'enrollManual'])
      .as('enrollments.enroll-manual')
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin', 'manager', 'teacher'] }))

/*
|--------------------------------------------------------------------------
| Routes de gestion des méthodes d'inscription
|--------------------------------------------------------------------------
| Routes pour configurer les méthodes d'inscription par cours
*/
router
  .group(() => {
    // Gestion des méthodes d'inscription
    router
      .get('/courses/:id/enrollment-methods', [CoursesController, 'manageEnrollmentMethods'])
      .as('courses.enrollment-methods.index')
    router
      .post('/courses/:id/enrollment-methods', [CoursesController, 'createEnrollmentMethod'])
      .as('courses.enrollment-methods.create')
    router
      .put('/courses/:id/enrollment-methods/:methodId', [
        CoursesController,
        'updateEnrollmentMethod',
      ])
      .as('courses.enrollment-methods.update')
    router
      .delete('/courses/:id/enrollment-methods/:methodId', [
        CoursesController,
        'deleteEnrollmentMethod',
      ])
      .as('courses.enrollment-methods.delete')

    // Gestion des groupes
    router
      .get('/courses/:id/groups', [CoursesController, 'manageGroups'])
      .as('courses.groups.index')
    router
      .post('/courses/:id/groupings', [CoursesController, 'createGrouping'])
      .as('courses.groupings.create')
    router
      .post('/courses/:id/groups', [CoursesController, 'createGroup'])
      .as('courses.groups.create')
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin', 'manager', 'teacher'] }))

/*
|--------------------------------------------------------------------------
| Routes d'administration - Approbation des cours
|--------------------------------------------------------------------------
| Routes pour la file d'attente d'approbation des cours
*/
router
  .group(() => {
    router
      .get('/courses/approval-queue', [CoursesController, 'approvalQueue'])
      .as('admin.courses.approval-queue')
    router
      .post('/courses/:id/approve', [CoursesController, 'approveCourse'])
      .as('admin.courses.approve')
    router
      .post('/courses/:id/reject', [CoursesController, 'rejectCourse'])
      .as('admin.courses.reject')
  })
  .prefix('/admin')
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin'] }))

/*
|--------------------------------------------------------------------------
| Routes d'administration - Gestion des catégories
|--------------------------------------------------------------------------
| Routes pour gérer les catégories de cours (admin uniquement)
*/
router
  .group(() => {
    router.get('/categories', [CategoriesController, 'index']).as('admin.categories.index')
    router.get('/categories/create', [CategoriesController, 'create']).as('admin.categories.create')
    router.post('/categories', [CategoriesController, 'store']).as('admin.categories.store')
    router
      .get('/categories/:id/add-child', [CategoriesController, 'createChild'])
      .as('admin.categories.createChild')
    router.get('/categories/:id/edit', [CategoriesController, 'edit']).as('admin.categories.edit')
    router.put('/categories/:id', [CategoriesController, 'update']).as('admin.categories.update')
    router.patch('/categories/:id', [CategoriesController, 'update'])
    router
      .delete('/categories/:id', [CategoriesController, 'destroy'])
      .as('admin.categories.destroy')
    router
      .post('/categories/reorder', [CategoriesController, 'reorder'])
      .as('admin.categories.reorder')
  })
  .prefix('/admin')
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin'] }))

/*
|--------------------------------------------------------------------------
| Routes d'administration des cours
|--------------------------------------------------------------------------
*/
router
  .group(() => {
    // Liste des cours pour l'admin
    router.get('/courses', [CoursesController, 'adminIndex']).as('admin.courses.index')

    // Gestion des participants
    router
      .get('/courses/:id/participants', [CoursesController, 'showParticipants'])
      .as('admin.courses.participants')
    router
      .post('/courses/:id/participants', [CoursesController, 'addParticipant'])
      .as('admin.courses.participants.add')
    router
      .delete('/courses/:id/participants/:enrollmentId', [CoursesController, 'removeParticipant'])
      .as('admin.courses.participants.remove')

    // Paramètres du cours
    router
      .get('/courses/:id/settings', [CoursesController, 'showSettings'])
      .as('admin.courses.settings')
    router
      .put('/courses/:id/settings', [CoursesController, 'updateSettings'])
      .as('admin.courses.settings.update')

    // Actions sur les cours
    router
      .post('/courses/:id/archive', [CoursesController, 'archiveCourse'])
      .as('admin.courses.archive')
  })
  .prefix('/admin')
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin'] }))
