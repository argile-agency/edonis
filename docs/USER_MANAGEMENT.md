# Gestion des Utilisateurs et Rôles - Edonis LMS

## Vue d'ensemble

Ce module implémente un système complet de gestion des utilisateurs avec rôles fixes et contextuels, inspiré de Moodle, pour le LMS Edonis.

## Architecture

### 1. Modèle de données

#### Tables créées

**`users` (étendue)**

- `id`: Clé primaire
- `full_name`: Nom complet
- `email`: Email unique
- `password`: Mot de passe hashé
- `avatar_url`: URL de l'avatar
- `bio`: Biographie
- `phone`: Téléphone
- `student_id`: Matricule unique
- `department`: Département
- `organization`: Organisation
- `locale`: Langue préférée (défaut: 'fr')
- `timezone`: Fuseau horaire (défaut: 'Europe/Paris')
- `is_active`: Statut du compte (soft delete)
- `last_login_at`: Dernière connexion
- `created_at`: Date de création
- `updated_at`: Date de mise à jour

**`roles`**

- `id`: Clé primaire
- `name`: Nom du rôle (ex: "Administrator")
- `slug`: Slug unique (ex: "admin")
- `description`: Description du rôle
- `permissions`: JSON des permissions
- `is_system`: Rôle système (non modifiable)
- `created_at`: Date de création
- `updated_at`: Date de mise à jour

**`user_roles` (pivot)**

- `id`: Clé primaire
- `user_id`: FK vers users
- `role_id`: FK vers roles
- `course_id`: FK vers courses (nullable pour rôles globaux)
- `created_at`: Date d'assignation
- `updated_at`: Date de mise à jour
- Contrainte unique: `(user_id, role_id, course_id)`

### 2. Rôles disponibles

#### 🔴 Administrator (admin)

- **Description**: Accès complet au système
- **Permissions**:
  - Gestion système complète
  - Gestion de tous les utilisateurs
  - Gestion de tous les cours
  - Accès aux rapports

#### 🟡 Manager (manager)

- **Description**: Gestion des cours et utilisateurs
- **Permissions**:
  - Création/modification/suppression de cours
  - Gestion des utilisateurs (création, modification)
  - Accès aux rapports
  - Pas d'accès à la configuration système

#### 🟢 Teacher (teacher)

- **Description**: Enseignant avec gestion de cours
- **Permissions**:
  - Création de cours
  - Modification de ses propres cours
  - Création/modification de contenu
  - Notation des étudiants de ses cours
  - Visualisation des étudiants

#### 🔵 Student (student)

- **Description**: Étudiant avec accès aux cours
- **Permissions**:
  - Accès aux cours auxquels il est inscrit
  - Visualisation du contenu
  - Soumission de devoirs
  - Visualisation de ses propres notes
  - Participation aux forums

#### ⚪ Guest (guest)

- **Description**: Accès lecture seule aux cours publics
- **Permissions**:
  - Lecture des cours publics
  - Visualisation du contenu public

### 3. Rôles contextuels

Le système supporte deux types d'assignation de rôles :

1. **Rôles globaux** (`course_id = null`):
   - Valables dans tout le système
   - Ex: Un administrateur global

2. **Rôles contextuels** (`course_id != null`):
   - Limités à un cours spécifique
   - Ex: Enseignant dans le cours "Mathématiques", mais étudiant dans le cours "Physique"

## API Backend

### Contrôleur: `UsersController`

#### Routes disponibles

| Méthode   | Route                       | Action         | Description                                 |
| --------- | --------------------------- | -------------- | ------------------------------------------- |
| GET       | `/admin/users`              | `index`        | Liste paginée des utilisateurs avec filtres |
| GET       | `/admin/users/create`       | `create`       | Formulaire de création                      |
| POST      | `/admin/users`              | `store`        | Créer un utilisateur                        |
| GET       | `/admin/users/:id`          | `show`         | Détails d'un utilisateur                    |
| GET       | `/admin/users/:id/edit`     | `edit`         | Formulaire d'édition                        |
| PUT/PATCH | `/admin/users/:id`          | `update`       | Mettre à jour un utilisateur                |
| DELETE    | `/admin/users/:id`          | `destroy`      | Désactiver un utilisateur (soft delete)     |
| POST      | `/admin/users/:id/activate` | `activate`     | Réactiver un utilisateur                    |
| DELETE    | `/admin/users/:id/force`    | `forceDestroy` | Supprimer définitivement                    |

#### Filtres disponibles (GET `/admin/users`)

- `search`: Recherche par nom, email ou matricule
- `role`: Filtrer par rôle (admin, manager, teacher, student, guest)
- `status`: Filtrer par statut (active, inactive)
- `page`: Pagination
- `limit`: Nombre d'éléments par page (défaut: 20)

### Validation

Deux validators principaux :

**`createUserValidator`**

- Tous les champs requis pour création
- Validation unicité email et studentId
- Mot de passe minimum 8 caractères

**`updateUserValidator`**

- Champs optionnels sauf constraints d'unicité
- Mot de passe optionnel (vide = pas de changement)

### Modèles

#### `User` (app/models/user.ts)

**Relations:**

- `roles`: ManyToMany avec Role via user_roles

**Méthodes utiles:**

```typescript
await user.hasRole('admin') // Vérifie si l'utilisateur a le rôle
await user.hasAnyRole(['admin', 'manager']) // Vérifie plusieurs rôles
await user.isAdmin() // Raccourci pour hasRole('admin')
await user.isTeacher()
await user.isStudent()
await user.getRoleNames() // Retourne ['Administrator', 'Manager']
await user.updateLastLogin() // Met à jour last_login_at
```

#### `Role` (app/models/role.ts)

**Méthodes utiles:**

```typescript
await Role.findBySlug('admin')
role.hasPermission('users.create') // Vérifie une permission
```

#### `UserRole` (app/models/user_role.ts)

**Méthodes statiques:**

```typescript
// Assigner un rôle global
await UserRole.assignRole(userId, 'admin')

// Assigner un rôle contextuel à un cours
await UserRole.assignRole(userId, 'teacher', courseId)

// Retirer un rôle
await UserRole.removeRole(userId, 'teacher')

// Obtenir tous les rôles d'un utilisateur
await UserRole.getUserRoles(userId)

// Obtenir les rôles d'un utilisateur pour un cours spécifique
await UserRole.getUserRoles(userId, courseId)
```

### Middleware

#### `RoleMiddleware` (app/middleware/role_middleware.ts)

Protège les routes en vérifiant les rôles :

```typescript
// Dans start/routes.ts
router
  .group(() => {
    router.get('/admin/users', [UsersController, 'index'])
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin', 'manager'] }))
```

## Interface utilisateur (React)

### Pages créées

#### 1. `/admin/users` - Liste des utilisateurs

**Fichier**: `inertia/pages/users/index.tsx`

**Fonctionnalités:**

- Tableau paginé des utilisateurs
- Recherche en temps réel
- Filtres par rôle et statut
- Badges visuels pour rôles et statut
- Actions rapides (Voir, Éditer, Activer/Désactiver)

#### 2. `/admin/users/create` - Créer un utilisateur

**Fichier**: `inertia/pages/users/create.tsx`

**Sections:**

- Informations de base (nom, email, mot de passe, téléphone)
- Informations académiques (matricule, département, organisation)
- Profil (avatar, bio)
- Assignation de rôles avec checkboxes
- Préférences (langue, timezone)
- Statut actif/inactif

#### 3. `/admin/users/:id/edit` - Éditer un utilisateur

**Fichier**: `inertia/pages/users/edit.tsx`

Similaire à la création mais avec :

- Données pré-remplies
- Mot de passe optionnel
- Modification des rôles existants

#### 4. `/admin/users/:id` - Détails d'un utilisateur

**Fichier**: `inertia/pages/users/show.tsx`

**Vue d'ensemble complète:**

- Informations personnelles
- Préférences
- Activité (dernière connexion, dates)
- Rôles globaux et contextuels
- Actions rapides

## Utilisation

### 1. Initialiser la base de données

```bash
# Exécuter les migrations
node ace migration:run

# Seeder les rôles par défaut
node ace db:seed
```

### 2. Créer un utilisateur administrateur

```bash
node ace repl
```

```javascript
const User = await import('#models/user')
const UserRole = await import('#models/user_role')

// Créer l'utilisateur
const admin = await User.default.create({
  fullName: 'Super Admin',
  email: 'admin@edonis.com',
  password: 'SecurePassword123!',
  isActive: true,
})

// Assigner le rôle admin
await UserRole.default.assignRole(admin.id, 'admin')
```

### 3. Protéger une route

```typescript
// start/routes.ts
router
  .group(() => {
    // Routes accessibles uniquement par admin et manager
    router.get('/admin/dashboard', [DashboardController, 'index'])
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin', 'manager'] }))
```

### 4. Vérifier les permissions dans un contrôleur

```typescript
// app/controllers/courses_controller.ts
async update({ auth, params, request }: HttpContext) {
  const course = await Course.findOrFail(params.id)
  const user = auth.user!

  // Vérifier si l'utilisateur est admin ou propriétaire du cours
  const isAdmin = await user.isAdmin()
  const isOwner = course.userId === user.id

  if (!isAdmin && !isOwner) {
    return response.forbidden({
      message: 'Vous ne pouvez pas modifier ce cours'
    })
  }

  // Mise à jour...
}
```

## Sécurité

### Bonnes pratiques implémentées

1. **Authentification requise**: Toutes les routes d'administration nécessitent authentification
2. **RBAC**: Vérification des rôles via middleware
3. **Soft delete**: Les utilisateurs sont désactivés, pas supprimés
4. **Validation stricte**: Email unique, mot de passe fort, etc.
5. **Protection CSRF**: Activée par défaut avec @adonisjs/shield
6. **Hash des mots de passe**: Utilisation de Scrypt via AdonisJS

## Tests recommandés

### Tests unitaires à créer

```typescript
// tests/unit/models/user.spec.ts
test('user can have multiple roles', async () => {
  const user = await UserFactory.create()
  await UserRole.assignRole(user.id, 'admin')
  await UserRole.assignRole(user.id, 'teacher')

  await user.load('roles')
  assert.equal(user.roles.length, 2)
})

test('user can check if has role', async () => {
  const user = await UserFactory.create()
  await UserRole.assignRole(user.id, 'admin')

  assert.isTrue(await user.hasRole('admin'))
  assert.isFalse(await user.hasRole('teacher'))
})
```

### Tests fonctionnels à créer

```typescript
// tests/functional/users/list.spec.ts
test('admin can view users list', async ({ client }) => {
  const admin = await UserFactory.with('roles', 1, (role) => {
    role.merge({ slug: 'admin' })
  }).create()

  const response = await client.get('/admin/users').loginAs(admin)

  response.assertStatus(200)
  response.assertInertiaComponent('users/index')
})

test('student cannot access users list', async ({ client }) => {
  const student = await UserFactory.with('roles', 1, (role) => {
    role.merge({ slug: 'student' })
  }).create()

  const response = await client.get('/admin/users').loginAs(student)

  response.assertStatus(403)
})
```

## Améliorations futures

### Phase 2

- [ ] Import/Export CSV des utilisateurs
- [ ] Réinitialisation de mot de passe par email
- [ ] Historique des modifications utilisateur
- [ ] Gestion des groupes d'utilisateurs
- [ ] Avatar upload vers Supabase Storage

### Phase 3

- [ ] Authentification OAuth (Google, Microsoft)
- [ ] Authentification à deux facteurs (2FA)
- [ ] Logs d'audit détaillés
- [ ] API REST publique pour intégrations
- [ ] Notifications email pour événements utilisateur

## Support

Pour toute question ou problème, consulter :

- Documentation AdonisJS: https://docs.adonisjs.com
- Documentation Lucid ORM: https://lucid.adonisjs.com
- README principal du projet

---

**Développé pour Edonis LMS** - Système de gestion de l'apprentissage moderne basé sur AdonisJS 6
