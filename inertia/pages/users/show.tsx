import { Head, Link } from '@inertiajs/react'

interface Role {
  id: number
  name: string
  slug: string
}

interface User {
  id: number
  fullName: string | null
  email: string
  avatarUrl: string | null
  bio: string | null
  phone: string | null
  studentId: string | null
  department: string | null
  organization: string | null
  locale: string
  timezone: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  roles: Role[]
}

interface UserRole {
  id: number
  userId: number
  roleId: number
  courseId: number | null
  createdAt: string
  role: Role
}

interface Props {
  user: User
  userRoles: UserRole[]
}

export default function UsersShow({ user, userRoles }: Props) {
  return (
    <>
      <Head title={`${user.fullName || user.email}`} />

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/admin/users"
              className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
            >
              ← Retour à la liste
            </Link>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName || user.email}
                    className="h-20 w-20 rounded-full"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-semibold">
                    {user.fullName?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {user.fullName || 'Utilisateur sans nom'}
                  </h1>
                  <p className="text-gray-600">{user.email}</p>
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
              </div>
              <Link
                href={`/admin/users/${user.id}/edit`}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                Éditer
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne principale */}
            <div className="lg:col-span-2 space-y-6">
              {/* Informations personnelles */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Informations personnelles
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Nom complet</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.fullName || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Téléphone</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.phone || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Matricule</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.studentId || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Département</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.department || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Organisation</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.organization || 'N/A'}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Biographie</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                      {user.bio || 'Aucune biographie'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Préférences */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Préférences</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Langue</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user.locale === 'fr' ? 'Français' : 'English'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Fuseau horaire</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.timezone}</dd>
                  </div>
                </dl>
              </div>

              {/* Activité */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Activité</h2>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Dernière connexion</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString('fr-FR')
                        : 'Jamais connecté'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Date de création</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(user.createdAt).toLocaleString('fr-FR')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Dernière modification</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(user.updatedAt).toLocaleString('fr-FR')}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Colonne latérale */}
            <div className="space-y-6">
              {/* Rôles globaux */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Rôles globaux</h2>
                <div className="space-y-2">
                  {userRoles.filter((ur) => !ur.courseId).length > 0 ? (
                    userRoles
                      .filter((ur) => !ur.courseId)
                      .map((userRole) => (
                        <div
                          key={userRole.id}
                          className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {userRole.role.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Assigné le {new Date(userRole.createdAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {userRole.role.slug}
                          </span>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-gray-500">Aucun rôle global assigné</p>
                  )}
                </div>
              </div>

              {/* Rôles contextuels (par cours) */}
              {userRoles.filter((ur) => ur.courseId).length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Rôles par cours</h2>
                  <div className="space-y-2">
                    {userRoles
                      .filter((ur) => ur.courseId)
                      .map((userRole) => (
                        <div
                          key={userRole.id}
                          className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {userRole.role.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Cours ID: {userRole.courseId}
                            </p>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {userRole.role.slug}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Actions rapides */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
                <div className="space-y-2">
                  <Link
                    href={`/admin/users/${user.id}/edit`}
                    className="block w-full px-4 py-2 text-center text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Éditer l'utilisateur
                  </Link>
                  {user.isActive ? (
                    <button
                      onClick={() => {
                        if (confirm('Êtes-vous sûr de vouloir désactiver cet utilisateur ?')) {
                          // Handle deactivation
                        }
                      }}
                      className="block w-full px-4 py-2 text-center text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                    >
                      Désactiver le compte
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        // Handle activation
                      }}
                      className="block w-full px-4 py-2 text-center text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                    >
                      Activer le compte
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
