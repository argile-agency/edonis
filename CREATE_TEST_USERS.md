# 👤 Créer les utilisateurs de test

## Méthode rapide via REPL

```bash
node ace repl
```

Puis copiez-collez le code suivant :

```javascript
const { default: User } = await import('./app/models/user.js')
const { default: UserRole } = await import('./app/models/user_role.js')

// 1. ADMINISTRATEUR
const admin = await User.firstOrCreate(
  { email: 'admin@edonis.com' },
  {
    fullName: 'Administrateur Principal',
    email: 'admin@edonis.com',
    password: 'Admin123!',
    isActive: true,
  }
)
await UserRole.assignRole(admin.id, 'admin')

// 2. MANAGER
const manager = await User.firstOrCreate(
  { email: 'manager@edonis.com' },
  {
    fullName: 'Manager LMS',
    email: 'manager@edonis.com',
    password: 'Manager123!',
    isActive: true,
  }
)
await UserRole.assignRole(manager.id, 'manager')

// 3. ENSEIGNANT
const teacher = await User.firstOrCreate(
  { email: 'teacher@edonis.com' },
  {
    fullName: 'Professeur Martin',
    email: 'teacher@edonis.com',
    password: 'Teacher123!',
    department: 'Informatique',
    isActive: true,
  }
)
await UserRole.assignRole(teacher.id, 'teacher')

// 4. ÉTUDIANT
const student = await User.firstOrCreate(
  { email: 'student@edonis.com' },
  {
    fullName: 'Étudiant Dupont',
    email: 'student@edonis.com',
    password: 'Student123!',
    studentId: 'STU-2024-001',
    department: 'Informatique',
    isActive: true,
  }
)
await UserRole.assignRole(student.id, 'student')

console.log('✅ Utilisateurs de test créés avec succès!')
console.log('')
console.log('👤 Comptes disponibles:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🔴 Admin:    admin@edonis.com / Admin123!')
console.log('🟡 Manager:  manager@edonis.com / Manager123!')
console.log('🟢 Teacher:  teacher@edonis.com / Teacher123!')
console.log('🔵 Student:  student@edonis.com / Student123!')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
```

Tapez `.exit` pour quitter le REPL.

---

## Les 4 comptes de test

| Rôle           | Email              | Mot de passe | Accès                        |
| -------------- | ------------------ | ------------ | ---------------------------- |
| 🔴 **Admin**   | admin@edonis.com   | Admin123!    | Tout le système              |
| 🟡 **Manager** | manager@edonis.com | Manager123!  | Gestion utilisateurs + cours |
| 🟢 **Teacher** | teacher@edonis.com | Teacher123!  | Ses cours uniquement         |
| 🔵 **Student** | student@edonis.com | Student123!  | Cours inscrits               |

---

## Tester la connexion

1. Démarrez le serveur :

```bash
npm run dev
```

2. Allez sur http://localhost:3333/login

3. Connectez-vous avec l'un des comptes ci-dessus

4. Vous serez redirigé vers `/dashboard`

---

## Ce que vous verrez

### En tant qu'Admin ou Manager

- Dashboard avec carte "Gérer les utilisateurs"
- Accès à `/admin/users` pour le CRUD complet

### En tant que Teacher

- Dashboard avec cartes "Mes cours" et "Évaluations"
- (Fonctionnalités à venir)

### En tant que Student

- Dashboard avec cartes "Mes cours" et "Mes notes"
- (Fonctionnalités à venir)

---

## ✅ Problèmes résolus

1. ✅ **"Cannot GET:/login"** → Routes d'authentification créées
2. ✅ **Permissions refusées** → Redirection vers `/dashboard` au lieu de `/admin/users`
3. ✅ **Utilisateurs de test** → Script REPL fourni ci-dessus

Bon développement ! 🚀
