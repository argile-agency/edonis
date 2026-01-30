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
import { Shield, BookOpen } from 'lucide-react'

export default function TwoFactorChallenge() {
  const [useRecovery, setUseRecovery] = useState(false)

  const tokenForm = useForm({ token: '' })
  const recoveryForm = useForm({ recoveryCode: '' })

  const handleTokenSubmit = (e: FormEvent) => {
    e.preventDefault()
    tokenForm.post('/two-factor/challenge')
  }

  const handleRecoverySubmit = (e: FormEvent) => {
    e.preventDefault()
    recoveryForm.post('/two-factor/challenge/recovery')
  }

  return (
    <>
      <Head title="Vérification 2FA" />

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center">
              <BookOpen className="h-10 w-10 text-primary-foreground" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-gray-200">
              Edonis LMS
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">Vérification en deux étapes</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {useRecovery ? 'Code de récupération' : "Code d'authentification"}
              </CardTitle>
              <CardDescription>
                {useRecovery
                  ? "Entrez l'un de vos codes de récupération pour accéder à votre compte."
                  : "Entrez le code à 6 chiffres de votre application d'authentification."}
              </CardDescription>
            </CardHeader>

            {!useRecovery ? (
              <form onSubmit={handleTokenSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="token">Code de vérification</Label>
                    <Input
                      type="text"
                      id="token"
                      value={tokenForm.data.token}
                      onChange={(e) => tokenForm.setData('token', e.target.value)}
                      placeholder="000000"
                      maxLength={6}
                      pattern="[0-9]{6}"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                    />
                    {tokenForm.errors.token && (
                      <p className="text-sm text-destructive">{tokenForm.errors.token}</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <Button type="submit" disabled={tokenForm.processing} className="w-full">
                    {tokenForm.processing ? 'Vérification...' : 'Vérifier'}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setUseRecovery(true)}
                    className="text-sm"
                  >
                    Utiliser un code de récupération
                  </Button>
                </CardFooter>
              </form>
            ) : (
              <form onSubmit={handleRecoverySubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recoveryCode">Code de récupération</Label>
                    <Input
                      type="text"
                      id="recoveryCode"
                      value={recoveryForm.data.recoveryCode}
                      onChange={(e) => recoveryForm.setData('recoveryCode', e.target.value)}
                      placeholder="XXXX-XXXX"
                      required
                    />
                    {recoveryForm.errors.recoveryCode && (
                      <p className="text-sm text-destructive">{recoveryForm.errors.recoveryCode}</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <Button type="submit" disabled={recoveryForm.processing} className="w-full">
                    {recoveryForm.processing ? 'Vérification...' : 'Vérifier'}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setUseRecovery(false)}
                    className="text-sm"
                  >
                    Utiliser un code d'authentification
                  </Button>
                </CardFooter>
              </form>
            )}
          </Card>

          <div className="text-center">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              ← Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
