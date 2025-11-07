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
