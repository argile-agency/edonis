# 🔐 Guide d'authentification - Edonis LMS

## ✅ Problème résolu

L'erreur **"Cannot GET:/login"** est maintenant résolue ! Le système d'authentification complet a été implémenté.

---

## 🎯 Ce qui a été ajouté

### 1. **AuthController** (`app/controllers/auth_controller.ts`)
- ✅ `showLogin()` : Affiche la page de connexion
- ✅ `login()` : Traite la connexion
- ✅ `showRegister()` : Affiche la page d'inscription
- ✅ `register()` : Traite l'inscription (assigne automatiquement le rôle "Student")
- ✅ `logout()` : Déconnexion

### 2. **Validators** (`app/validators/auth_validator.ts`)
- ✅ `loginValidator` : Validation email + password
- ✅ `registerValidator` : Validation nom, email, password avec confirmation

### 3. **Routes d'authentification** (`start/routes.ts`)
```typescript
GET  /login      → Page de connexion
POST /login      → Traiter la connexion
GET  /register   → Page d'inscription
POST /register   → Traiter l'inscription
POST /logout     → Déconnexion
```

### 4. **Pages React**
- ✅ `inertia/pages/auth/login.tsx` : Interface de connexion moderne
- ✅ `inertia/pages/auth/register.tsx` : Interface d'inscription

---

## 🚀 Comment utiliser

### Démarrer le serveur

```bash
npm run dev
```

### Accéder aux pages

- **Page d'accueil** : http://localhost:3333
- **Connexion** : http://localhost:3333/login
- **Inscription** : http://localhost:3333/register
- **Gestion utilisateurs** : http://localhost:3333/admin/users (nécessite authentification)

---

## 👤 Créer le premier utilisateur admin

Vous avez **deux options** :

### Option 1 : Via l'inscription (devient Student par défaut)

1. Allez sur http://localhost:3333/register
2. Remplissez le formulaire
3. Vous serez automatiquement connecté avec le rôle "Student"
4. Pour devenir Admin, utilisez le REPL (voir Option 2)

### Option 2 : Via le REPL (créer directement un Admin)

```bash
node ace repl
```

Dans le REPL :

```javascript
const { default: User } = await import('./app/models/user.js')
const { default: UserRole } = await import('./app/models/user_role.js')

// Créer l'administrateur
const admin = await User.create({
  fullName: 'Administrateur Principal',
  email: 'admin@edonis.com',
  password: 'Admin123!',
  isActive: true
})

// Assigner le rôle admin
await UserRole.assignRole(admin.id, 'admin')

console.log('✅ Admin créé !')
console.log('📧 Email: admin@edonis.com')
console.log('🔑 Password: Admin123!')
```

Tapez `.exit` pour quitter.

---

## 🔄 Flux d'authentification

### Inscription
1. Utilisateur remplit le formulaire `/register`
2. Validation des données (nom, email unique, password min 8 caractères)
3. Création de l'utilisateur
4. Attribution automatique du rôle "Student"
5. Connexion automatique
6. Redirection vers `/admin/users`

### Connexion
1. Utilisateur remplit le formulaire `/login`
2. Vérification des credentials
3. Vérification que le compte est actif
4. Mise à jour de `last_login_at`
5. Connexion
6. Redirection vers `/admin/users`

### Déconnexion
1. Utilisateur clique sur "Déconnexion"
2. Session détruite
3. Redirection vers `/login`

---

## 🛡️ Protection des routes

Les routes d'administration sont automatiquement protégées :

```typescript
// Dans start/routes.ts
router
  .group(() => {
    router.get('/users', [UsersController, 'index'])
    // ... autres routes
  })
  .prefix('/admin')
  .use(middleware.auth())                          // ← Authentification requise
  .use(middleware.role({ roles: ['admin', 'manager'] })) // ← Rôles requis
```

### Comportement
- ❌ **Non connecté** → Redirection vers `/login`
- ❌ **Mauvais rôle** (ex: Student) → Erreur 403 Forbidden
- ✅ **Admin ou Manager** → Accès autorisé

---

## 🎨 Interface utilisateur

### Page de connexion (`/login`)
- Design moderne avec gradient bleu
- Formulaire simple : email + password
- Option "Se souvenir de moi"
- Lien "Mot de passe oublié" (à implémenter)
- Lien vers inscription
- Validation en temps réel

### Page d'inscription (`/register`)
- Formulaire complet : nom, email, password, confirmation
- Validation : minimum 8 caractères pour le password
- Checkbox conditions d'utilisation
- Lien vers connexion
- Inscription automatique du rôle "Student"

---

## 🔧 Personnalisation

### Changer le rôle par défaut lors de l'inscription

Dans `app/controllers/auth_controller.ts`, ligne ~70 :

```typescript
// Assigner le rôle par défaut
await UserRole.assignRole(user.id, 'student') // ← Changez ici
```

Options : `'admin'`, `'manager'`, `'teacher'`, `'student'`, `'guest'`

### Redirection après connexion

Dans `app/controllers/auth_controller.ts`, ligne ~42 :

```typescript
return response.redirect().toRoute('users.index') // ← Changez la route
```

Exemples :
```typescript
return response.redirect().to('/')           // Page d'accueil
return response.redirect().toRoute('dashboard') // Dashboard
```

### Désactiver l'inscription publique

Dans `start/routes.ts`, commentez les routes register :

```typescript
// router.get('/register', [AuthController, 'showRegister']).as('register')
// router.post('/register', [AuthController, 'register'])
```

---

## 🧪 Tester l'authentification

### Test 1 : Inscription
```bash
curl -X POST http://localhost:3333/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "Password123!",
    "password_confirmation": "Password123!"
  }'
```

### Test 2 : Connexion
```bash
curl -X POST http://localhost:3333/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@edonis.com",
    "password": "Admin123!"
  }'
```

### Test 3 : Accès route protégée
```bash
# Sans authentification → Redirection /login
curl -I http://localhost:3333/admin/users
```

---

## 🐛 Résolution des problèmes courants

### Erreur : "Cannot GET:/login"
✅ **Résolu !** Les routes ont été créées.

### Erreur : "Email already exists"
➡️ L'email est déjà utilisé. Utilisez un autre email ou connectez-vous.

### Erreur : "Password must be at least 8 characters"
➡️ Le mot de passe doit contenir au moins 8 caractères.

### Je suis redirigé vers /login en boucle
➡️ Vérifiez :
1. Que vous êtes bien connecté
2. Que votre compte est actif (`is_active = true`)
3. Vos cookies de session

### Je reçois 403 Forbidden sur /admin/users
➡️ Votre utilisateur n'a pas le rôle requis. Vérifiez vos rôles :
```bash
node ace repl
```
```javascript
const { default: User } = await import('./app/models/user.js')
const user = await User.findBy('email', 'votre@email.com')
await user.load('roles' as any)
console.log(await user.getRoleNames())
```

---

## 📚 Prochaines étapes recommandées

### Immédiat
1. ✅ **Ajouter un bouton de déconnexion** dans le header
2. ✅ **Implémenter "Mot de passe oublié"**
3. ✅ **Afficher l'utilisateur connecté** dans la navbar

### Court terme
4. **Dashboard personnalisé** par rôle
5. **Confirmation d'email** lors de l'inscription
6. **Historique des connexions**

### Moyen terme
7. **Authentification OAuth** (Google, Microsoft)
8. **2FA (Two-Factor Authentication)**
9. **Sessions multiples** gestion

---

## 💡 Exemples d'utilisation dans les contrôleurs

### Récupérer l'utilisateur connecté

```typescript
async index({ auth, inertia }: HttpContext) {
  const user = auth.user!
  
  // Charger les rôles
  await user.load('roles' as any)
  
  return inertia.render('dashboard', {
    user: user.serialize(),
    isAdmin: await user.isAdmin(),
  })
}
```

### Vérifier les permissions

```typescript
async update({ auth, params, response }: HttpContext) {
  const user = auth.user!
  const isAdmin = await user.isAdmin()
  
  if (!isAdmin) {
    return response.forbidden({
      message: 'Accès non autorisé'
    })
  }
  
  // Logique de mise à jour...
}
```

### Rediriger selon le rôle

```typescript
async dashboard({ auth, response }: HttpContext) {
  const user = auth.user!
  
  if (await user.isAdmin()) {
    return response.redirect().toRoute('admin.dashboard')
  } else if (await user.isTeacher()) {
    return response.redirect().toRoute('teacher.dashboard')
  } else {
    return response.redirect().toRoute('student.dashboard')
  }
}
```

---

## 🎉 Félicitations !

Votre système d'authentification est maintenant **complètement fonctionnel** ! 

Vous pouvez :
- ✅ Vous inscrire
- ✅ Vous connecter
- ✅ Vous déconnecter
- ✅ Accéder aux routes protégées selon vos rôles
- ✅ Gérer les utilisateurs (si Admin/Manager)

---

## 📖 Ressources

- **Documentation AdonisJS Auth** : https://docs.adonisjs.com/guides/authentication
- **Guide principal** : `QUICKSTART.md`
- **Documentation technique** : `docs/USER_MANAGEMENT.md`

**Prochaine étape suggérée** : Créer un layout global avec navbar et afficher l'utilisateur connecté ! 🚀
