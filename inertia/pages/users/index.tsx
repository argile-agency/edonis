import { Head, Link, router } from '@inertiajs/react'
import { useState } from 'react'

interface Role {
  id: number
  name: string
  slug: string
}

interface User {
  id: number
  fullName: string | null
  email: string
  studentId: string | null
  department: string | null
  isActive: boolean
  createdAt: string
  roles: Role[]
}

interface PaginationMeta {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
  firstPage: number
  firstPageUrl: string
  lastPageUrl: string
  nextPageUrl: string | null
  previousPageUrl: string | null
}

interface Props {
  users: {
    meta: PaginationMeta
    data: User[]
  }
}

export default function UsersIndex({ users }: Props) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.get(
      '/admin/users',
      { search, role: roleFilter, status: statusFilter },
      { preserveState: true }
    )
  }

  const handleDelete = (userId: number) => {
    if (confirm('Êtes-vous sûr de vouloir désactiver cet utilisateur ?')) {
      router.delete(`/admin/users/${userId}`)
    }
  }

  const handleActivate = (userId: number) => {
    router.post(`/admin/users/${userId}/activate`)
  }

  return (
    <>
      <Head title="Gestion des utilisateurs" />

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Gestion des utilisateurs</h1>
            <p className="mt-2 text-sm text-gray-600">
              Gérez les utilisateurs et leurs rôles dans le système
            </p>
          </div>

          {/* Actions et filtres */}
          <div className="mb-6 bg-white rounded-lg shadow p-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              {/* Recherche */}
              <form onSubmit={handleSearch} className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  Rechercher
                </label>
                <input
                  type="text"
                  id="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom, email ou matricule..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </form>

              {/* Filtre par rôle */}
              <div className="flex-1">
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Rôle
                </label>
                <select
                  id="role"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tous les rôles</option>
                  <option value="admin">Administrateur</option>
                  <option value="manager">Manager</option>
                  <option value="teacher">Enseignant</option>
                  <option value="student">Étudiant</option>
                  <option value="guest">Invité</option>
                </select>
              </div>

              {/* Filtre par statut */}
              <div className="flex-1">
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <select
                  id="status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tous</option>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>

              {/* Boutons d'action */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSearch}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  Filtrer
                </button>
                <Link
                  href="/admin/users/create"
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                >
                  Nouvel utilisateur
                </Link>
              </div>
            </div>
          </div>

          {/* Table des utilisateurs */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Matricule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rôles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date création
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.data.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                            {user.fullName?.charAt(0)?.toUpperCase() ||
                              user.email.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.fullName || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.studentId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <span
                            key={role.id}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {role.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Voir
                        </Link>
                        <Link
                          href={`/admin/users/${user.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Éditer
                        </Link>
                        {user.isActive ? (
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Désactiver
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(user.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Activer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {users.meta.lastPage > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  {users.meta.previousPageUrl && (
                    <Link
                      href={users.meta.previousPageUrl}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Précédent
                    </Link>
                  )}
                  {users.meta.nextPageUrl && (
                    <Link
                      href={users.meta.nextPageUrl}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Suivant
                    </Link>
                  )}
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Affichage de{' '}
                      <span className="font-medium">
                        {(users.meta.currentPage - 1) * users.meta.perPage + 1}
                      </span>{' '}
                      à{' '}
                      <span className="font-medium">
                        {Math.min(users.meta.currentPage * users.meta.perPage, users.meta.total)}
                      </span>{' '}
                      sur <span className="font-medium">{users.meta.total}</span> résultats
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      {users.meta.previousPageUrl && (
                        <Link
                          href={users.meta.previousPageUrl}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        >
                          Précédent
                        </Link>
                      )}
                      {users.meta.nextPageUrl && (
                        <Link
                          href={users.meta.nextPageUrl}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        >
                          Suivant
                        </Link>
                      )}
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
