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

router.get('/', [HomeController, 'index']).as('home')

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
  .use(middleware.role({ roles: ['admin', 'manager'] }))

/*
|--------------------------------------------------------------------------
| Routes de gestion des cours
|--------------------------------------------------------------------------
| Routes pour les cours (CRUD + permissions)
*/

// Public course browsing (authenticated users)
router
  .group(() => {
    router.get('/courses', [CoursesController, 'index']).as('courses.index')
    router.get('/courses/:id', [CoursesController, 'show']).as('courses.show')
  })
  .use(middleware.auth())

// Course creation and management (instructors and admins)
router
  .group(() => {
    router.get('/courses/create', [CoursesController, 'create']).as('courses.create')
    router.post('/courses', [CoursesController, 'store']).as('courses.store')
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
  .use(middleware.role({ roles: ['admin', 'instructor'] }))

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

// Inscription manuelle (instructeurs/admin)
router
  .group(() => {
    router
      .post('/courses/:id/enroll/manual', [EnrollmentsController, 'enrollManual'])
      .as('enrollments.enroll-manual')
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin', 'instructor'] }))

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
  .use(middleware.role({ roles: ['admin', 'instructor'] }))

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
