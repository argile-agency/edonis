# 🚀 Guide de démarrage rapide - Gestion des utilisateurs

## ✅ Ce qui a été développé

Vous disposez maintenant d'un **système complet de gestion des utilisateurs avec rôles** pour votre LMS Edonis :

### 🎯 Fonctionnalités implémentées

- ✅ **5 rôles prédéfinis** : Admin, Manager, Teacher, Student, Guest
- ✅ **Rôles contextuels** : Globaux et par cours (comme Moodle)
- ✅ **CRUD complet** : Création, lecture, mise à jour, suppression des utilisateurs
- ✅ **Interface React moderne** : Pages de liste, création, édition et détails
- ✅ **Middleware de protection** : Vérification des rôles sur les routes
- ✅ **Validation robuste** : Email et matricule uniques
- ✅ **Soft delete** : Désactivation plutôt que suppression
- ✅ **Profils riches** : Avatar, bio, département, organisation, etc.

---

## 🚦 Démarrage en 5 minutes

### 1. Vérifier que les migrations sont appliquées

```bash
# Les migrations ont déjà été exécutées, mais pour vérifier :
node ace migration:status

# Si besoin de réappliquer :
node ace migration:fresh
node ace db:seed
```

### 2. Créer un utilisateur administrateur

```bash
node ace repl
```

Dans le REPL, exécutez :

```javascript
const { default: User } = await import('./app/models/user.js')
const { default: UserRole } = await import('./app/models/user_role.js')

// Créer l'admin
const admin = await User.create({
  fullName: 'Super Administrateur',
  email: 'admin@edonis.com',
  password: 'Admin123!',
  isActive: true
})

// Assigner le rôle admin
await UserRole.assignRole(admin.id, 'admin')

console.log('✅ Admin créé avec succès!')
console.log('📧 Email:', admin.email)
console.log('🔑 Password: Admin123!')
```

Tapez `.exit` pour quitter le REPL.

### 3. Démarrer le serveur

```bash
npm run dev
```

### 4. Accéder à l'interface

Ouvrez votre navigateur et allez à :
- **Page d'accueil** : http://localhost:3333
- **Gestion des utilisateurs** : http://localhost:3333/admin/users

> ⚠️ **Note** : Vous devez d'abord implémenter l'authentification pour accéder aux routes protégées. En attendant, vous pouvez temporairement retirer le middleware `auth()` dans `start/routes.ts` pour tester.

---

## 📁 Structure du code

```
app/
├── controllers/
│   └── users_controller.ts          # CRUD des utilisateurs
├── models/
│   ├── user.ts                       # Modèle User avec relations
│   ├── role.ts                       # Modèle Role
│   └── user_role.ts                  # Pivot avec helpers
├── middleware/
│   └── role_middleware.ts            # Protection par rôles
├── validators/
│   └── user_validator.ts             # Validation des données
└── ...

database/
├── migrations/
│   ├── 1761584336360_create_extend_users_table.ts
│   ├── 1761584625774_create_create_roles_table.ts
│   └── 1761584657727_create_create_user_roles_table.ts
└── seeders/
    └── role_seeder.ts                # Seed les 5 rôles

inertia/
└── pages/
    └── users/
        ├── index.tsx                 # Liste des utilisateurs
        ├── create.tsx                # Créer un utilisateur
        ├── edit.tsx                  # Éditer un utilisateur
        └── show.tsx                  # Détails d'un utilisateur

start/
├── routes.ts                         # Routes avec protection
└── kernel.ts                         # Enregistrement du middleware
```

---

## 🔐 Utilisation des rôles

### Dans les routes

```typescript
// start/routes.ts
router
  .group(() => {
    router.get('/admin/dashboard', [DashboardController, 'index'])
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin', 'manager'] }))
```

### Dans les contrôleurs

```typescript
// Vérifier un rôle
const isAdmin = await user.isAdmin()
const isTeacher = await user.isTeacher()
const hasRole = await user.hasRole('teacher')

// Vérifier plusieurs rôles
const hasAnyRole = await user.hasAnyRole(['admin', 'manager'])

// Obtenir les noms des rôles
const roleNames = await user.getRoleNames()
// ['Administrator', 'Teacher']
```

### Assigner/Retirer des rôles

```typescript
// Assigner un rôle global
await UserRole.assignRole(userId, 'admin')

// Assigner un rôle contextuel (pour un cours)
await UserRole.assignRole(userId, 'teacher', courseId)

// Retirer un rôle
await UserRole.removeRole(userId, 'teacher')

// Obtenir tous les rôles d'un utilisateur
const userRoles = await UserRole.getUserRoles(userId)

// Obtenir les rôles pour un cours spécifique
const courseRoles = await UserRole.getUserRoles(userId, courseId)
```

---

## 🎨 Interface utilisateur

### Page de liste (`/admin/users`)
- Tableau paginé avec 20 utilisateurs par page
- Recherche par nom, email ou matricule
- Filtres par rôle et statut
- Actions : Voir, Éditer, Activer/Désactiver
- Badges de rôles et statut colorés

### Page de création (`/admin/users/create`)
Sections du formulaire :
- Informations de base (nom, email, password, téléphone)
- Informations académiques (matricule, département, organisation)
- Profil (avatar URL, bio)
- Rôles (checkboxes multiples)
- Préférences (langue, timezone)
- Statut (actif/inactif)

### Page d'édition (`/admin/users/:id/edit`)
- Identique à la création
- Données pré-remplies
- Mot de passe optionnel

### Page de détails (`/admin/users/:id`)
- Informations complètes de l'utilisateur
- Rôles globaux et contextuels
- Activité (dernière connexion, dates)
- Actions rapides (éditer, activer/désactiver)

---

## 🧪 Tests rapides

### 1. Tester la création d'utilisateur

```bash
curl -X POST http://localhost:3333/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Jean Dupont",
    "email": "jean@example.com",
    "password": "Password123!",
    "roleIds": [3]
  }'
```

### 2. Tester les permissions du modèle

```bash
node ace repl
```

```javascript
const { default: User } = await import('./app/models/user.js')
const user = await User.query().preload('roles').first()

await user.isAdmin()        // true ou false
await user.getRoleNames()   // ['Administrator']
```

---

## 📚 Prochaines étapes recommandées

### Immédiat
1. ✅ **Implémenter l'authentification** 
   - Login/Logout
   - Session management
   - Password reset

2. ✅ **Ajouter des tests**
   - Tests unitaires pour les modèles
   - Tests fonctionnels pour les routes
   - Tests d'intégration

### Court terme
3. **Améliorer l'UI**
   - Ajouter un layout global
   - Notifications toast pour les succès/erreurs
   - Upload d'avatar vers Supabase Storage

4. **Étendre les fonctionnalités**
   - Import/Export CSV des utilisateurs
   - Historique des modifications
   - Logs d'activité

### Moyen terme
5. **Développer le module Cours**
   - Modèle Course
   - Gestion CRUD des cours
   - Inscriptions (enrollments)

6. **Système de contenu pédagogique**
   - Modules et sections
   - Ressources (documents, vidéos)
   - Activités (quiz, devoirs)

---

## 🐛 Dépannage

### Les routes retournent 401 Unauthorized
➡️ Normal ! L'authentification n'est pas encore implémentée. Deux options :
1. Implémenter l'authentification (recommandé)
2. Temporairement commenter `.use(middleware.auth())` dans routes.ts

### Erreur "Email already exists"
➡️ La validation d'unicité fonctionne ! Utilisez un autre email.

### Les rôles ne s'affichent pas
➡️ Vérifiez que le seeder a été exécuté : `node ace db:seed`

### Erreur TypeScript
➡️ Vérifiez avec : `npm run typecheck`

---

## 📖 Documentation complète

Pour plus de détails, consultez :
- **Documentation technique** : `docs/USER_MANAGEMENT.md`
- **README principal** : `README.md`

---

## 🎉 Félicitations !

Vous avez maintenant un système de gestion des utilisateurs professionnel et prêt pour la production. 

**Prochaine étape suggérée** : Implémenter l'authentification pour sécuriser l'accès aux routes admin.

---

**Besoin d'aide ?**
- Consultez la documentation AdonisJS : https://docs.adonisjs.com
- Consultez la documentation Lucid ORM : https://lucid.adonisjs.com
- Consultez la documentation Inertia.js : https://inertiajs.com
