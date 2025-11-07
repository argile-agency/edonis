import { Head, Link, useForm } from '@inertiajs/react'
import { FormEvent } from 'react'

interface Role {
  id: number
  name: string
  slug: string
  description: string
}

interface User {
  id: number
  fullName: string
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
  roleIds: number[]
}

interface Props {
  user: User
  roles: Role[]
}

export default function UsersEdit({ user, roles }: Props) {
  const { data, setData, put, processing, errors } = useForm({
    fullName: user.fullName || '',
    email: user.email || '',
    password: '',
    avatarUrl: user.avatarUrl || '',
    bio: user.bio || '',
    phone: user.phone || '',
    studentId: user.studentId || '',
    department: user.department || '',
    organization: user.organization || '',
    locale: user.locale || 'fr',
    timezone: user.timezone || 'Europe/Paris',
    isActive: user.isActive,
    roleIds: user.roleIds || [],
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    put(`/admin/users/${user.id}`)
  }

  const toggleRole = (roleId: number) => {
    if (data.roleIds.includes(roleId)) {
      setData('roleIds', data.roleIds.filter((id) => id !== roleId))
    } else {
      setData('roleIds', [...data.roleIds, roleId])
    }
  }

  return (
    <>
      <Head title={`Éditer ${user.fullName}`} />

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/admin/users"
              className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
            >
              ← Retour à la liste
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              Éditer l'utilisateur : {user.fullName}
            </h1>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            {/* Informations de base */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Informations de base
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    value={data.fullName}
                    onChange={(e) => setData('fullName', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Nouveau mot de passe (laisser vide pour ne pas changer)
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={data.phone}
                    onChange={(e) => setData('phone', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                </div>
              </div>
            </div>

            {/* Informations académiques */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Informations académiques
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">
                    Matricule
                  </label>
                  <input
                    type="text"
                    id="studentId"
                    value={data.studentId}
                    onChange={(e) => setData('studentId', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.studentId && (
                    <p className="mt-1 text-sm text-red-600">{errors.studentId}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                    Département
                  </label>
                  <input
                    type="text"
                    id="department"
                    value={data.department}
                    onChange={(e) => setData('department', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="organization" className="block text-sm font-medium text-gray-700">
                    Organisation
                  </label>
                  <input
                    type="text"
                    id="organization"
                    value={data.organization}
                    onChange={(e) => setData('organization', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Bio et avatar */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Profil</h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="avatarUrl" className="block text-sm font-medium text-gray-700">
                    URL de l'avatar
                  </label>
                  <input
                    type="url"
                    id="avatarUrl"
                    value={data.avatarUrl}
                    onChange={(e) => setData('avatarUrl', e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                    Biographie
                  </label>
                  <textarea
                    id="bio"
                    rows={4}
                    value={data.bio}
                    onChange={(e) => setData('bio', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Rôles */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Rôles</h2>

              <div className="space-y-2">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        id={`role-${role.id}`}
                        checked={data.roleIds.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor={`role-${role.id}`} className="font-medium text-gray-700">
                        {role.name}
                      </label>
                      <p className="text-gray-500">{role.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Préférences */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Préférences</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="locale" className="block text-sm font-medium text-gray-700">
                    Langue
                  </label>
                  <select
                    id="locale"
                    value={data.locale}
                    onChange={(e) => setData('locale', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
                    Fuseau horaire
                  </label>
                  <select
                    id="timezone"
                    value={data.timezone}
                    onChange={(e) => setData('timezone', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Europe/Paris">Europe/Paris</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Statut */}
            <div className="pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Statut</h2>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={data.isActive}
                  onChange={(e) => setData('isActive', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                  Compte actif
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Link
                href="/admin/users"
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Annuler
              </Link>
              <button
                type="submit"
                disabled={processing}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
              >
                {processing ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
