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
  studentId: string | null
  department: string | null
  roles: Role[]
}

interface Props {
  user: User
}

export default function Dashboard({ user }: Props) {
  const hasRole = (slug: string) => user.roles.some((role) => role.slug === slug)
  const isAdmin = hasRole('admin')
  const isManager = hasRole('manager')
  const isTeacher = hasRole('teacher')
  const isStudent = hasRole('student')

  return (
    <>
      <Head title="Dashboard" />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                  {user.fullName?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Bienvenue, {user.fullName || 'Utilisateur'}
                  </h1>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
              </div>
              <Link
                href="/logout"
                method="post"
                as="button"
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
              >
                Déconnexion
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Rôles */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Vos rôles</h2>
            <div className="flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                >
                  {role.name}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Admin & Manager */}
              {(isAdmin || isManager) && (
                <Link
                  href="/admin/users"
                  className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition">
                      <svg
                        className="h-6 w-6 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Gérer les utilisateurs</h3>
                      <p className="text-sm text-gray-600">CRUD complet des utilisateurs</p>
                    </div>
                  </div>
                </Link>
              )}

              {/* Teacher */}
              {isTeacher && (
                <>
                  <div className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition">
                        <svg
                          className="h-6 w-6 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Mes cours</h3>
                        <p className="text-sm text-gray-600">Gérer mes cours (à venir)</p>
                      </div>
                    </div>
                  </div>

                  <div className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition">
                        <svg
                          className="h-6 w-6 text-purple-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Évaluations</h3>
                        <p className="text-sm text-gray-600">Corriger les devoirs (à venir)</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Student */}
              {isStudent && (
                <>
                  <div className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition">
                        <svg
                          className="h-6 w-6 text-indigo-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Mes cours</h3>
                        <p className="text-sm text-gray-600">Accéder à mes cours (à venir)</p>
                      </div>
                    </div>
                  </div>

                  <div className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center group-hover:bg-yellow-200 transition">
                        <svg
                          className="h-6 w-6 text-yellow-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Mes notes</h3>
                        <p className="text-sm text-gray-600">Consulter mes résultats (à venir)</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  Bienvenue sur Edonis LMS !
                </h3>
                <p className="text-sm text-blue-800">
                  Ce tableau de bord sera enrichi au fur et à mesure du développement. Les modules
                  de cours, évaluations et contenus pédagogiques seront bientôt disponibles.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
