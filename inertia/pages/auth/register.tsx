import { Head, Link, useForm } from '@inertiajs/react'
import { FormEvent, useState } from 'react'

export default function Register() {
  const { data, setData, post, processing, errors } = useForm({
    fullName: '',
    email: '',
    password: '',
    password_confirmation: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    post('/register')
  }

  return (
    <>
      <Head title="Inscription" />

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Logo et titre */}
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
              <svg
                className="h-10 w-10 text-white"
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
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Edonis LMS</h2>
            <p className="mt-2 text-sm text-gray-600">Créez votre compte pour accéder aux cours</p>
          </div>

          {/* Formulaire */}
          <form
            className="mt-8 space-y-6 bg-white rounded-xl shadow-xl p-8"
            onSubmit={handleSubmit}
          >
            <div className="space-y-4">
              {/* Nom complet */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                  Nom complet
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={data.fullName}
                  onChange={(e) => setData('fullName', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Jean Dupont"
                  required
                />
                {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Adresse email
                </label>
                <input
                  type="email"
                  id="email"
                  value={data.email}
                  onChange={(e) => setData('email', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="vous@example.com"
                  required
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              {/* Mot de passe */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Mot de passe
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Minimum 8 caractères</p>
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              </div>

              {/* Confirmation mot de passe */}
              <div>
                <label
                  htmlFor="password_confirmation"
                  className="block text-sm font-medium text-gray-700"
                >
                  Confirmer le mot de passe
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPasswordConfirmation ? 'text' : 'password'}
                    id="password_confirmation"
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswordConfirmation ? (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password_confirmation && (
                  <p className="mt-1 text-sm text-red-600">{errors.password_confirmation}</p>
                )}
              </div>
            </div>

            {/* Conditions d'utilisation */}
            <div className="flex items-start">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                required
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
                J'accepte les{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500">
                  conditions d'utilisation
                </a>{' '}
                et la{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500">
                  politique de confidentialité
                </a>
              </label>
            </div>

            {/* Bouton d'inscription */}
            <button
              type="submit"
              disabled={processing}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {processing ? 'Inscription en cours...' : 'Créer mon compte'}
            </button>

            {/* Lien vers connexion */}
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Vous avez déjà un compte ?{' '}
                <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                  Se connecter
                </Link>
              </p>
            </div>
          </form>

          {/* Lien vers accueil */}
          <div className="text-center">
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
              ← Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
