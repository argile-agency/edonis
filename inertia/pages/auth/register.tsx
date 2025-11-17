import { Head, Link, useForm } from '@inertiajs/react'
import { FormEvent, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Checkbox } from '~/components/ui/checkbox'
import { Eye, EyeOff, BookOpen } from 'lucide-react'

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

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Logo et titre */}
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center">
              <BookOpen className="h-10 w-10 text-primary-foreground" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-gray-200">
              Edonis LMS
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Créez votre compte pour accéder aux cours
            </p>
          </div>

          {/* Formulaire */}
          <Card>
            <CardHeader>
              <CardTitle>Inscription</CardTitle>
              <CardDescription>Créez votre compte en quelques étapes</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {/* Nom complet */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nom complet</Label>
                  <Input
                    type="text"
                    id="fullName"
                    value={data.fullName}
                    onChange={(e) => setData('fullName', e.target.value)}
                    placeholder="Jean Dupont"
                    required
                  />
                  {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Adresse email</Label>
                  <Input
                    type="email"
                    id="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    placeholder="vous@example.com"
                    required
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                {/* Mot de passe */}
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={data.password}
                      onChange={(e) => setData('password', e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                {/* Confirmation mot de passe */}
                <div className="space-y-2">
                  <Label htmlFor="password_confirmation">Confirmer le mot de passe</Label>
                  <div className="relative">
                    <Input
                      type={showPasswordConfirmation ? 'text' : 'password'}
                      id="password_confirmation"
                      value={data.password_confirmation}
                      onChange={(e) => setData('password_confirmation', e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    >
                      {showPasswordConfirmation ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {errors.password_confirmation && (
                    <p className="text-sm text-destructive">{errors.password_confirmation}</p>
                  )}
                </div>

                {/* Conditions d'utilisation */}
                <div className="flex items-start space-x-2">
                  <Checkbox id="terms" required />
                  <Label
                    htmlFor="terms"
                    className="text-sm font-normal leading-relaxed cursor-pointer"
                  >
                    J'accepte les{' '}
                    <a href="#" className="text-primary hover:underline">
                      conditions d'utilisation
                    </a>{' '}
                    et la{' '}
                    <a href="#" className="text-primary hover:underline">
                      politique de confidentialité
                    </a>
                  </Label>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4">
                {/* Bouton d'inscription */}
                <Button type="submit" disabled={processing} className="w-full">
                  {processing ? 'Inscription en cours...' : 'Créer mon compte'}
                </Button>

                {/* Lien vers connexion */}
                <p className="text-sm text-center text-muted-foreground">
                  Vous avez déjà un compte ?{' '}
                  <Link href="/login" className="font-medium text-primary hover:underline">
                    Se connecter
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>

          {/* Lien vers accueil */}
          <div className="text-center">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
