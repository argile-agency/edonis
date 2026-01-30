import { Head, useForm, usePage } from '@inertiajs/react'
import { FormEvent, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Copy,
  CheckCircle,
  ArrowLeft,
  Download,
} from 'lucide-react'
import { Link } from '@inertiajs/react'
import AppHeader from '~/components/layout/app-header'

interface Props {
  twoFactorEnabled: boolean
  auth: { user: any }
  appSettings: any
  menus: any
}

export default function TwoFactorSetup({ twoFactorEnabled, auth, appSettings, menus }: Props) {
  const { props } = usePage<{
    flash: { success?: string; error?: string }
    two_factor_qr_code?: string
    two_factor_recovery_codes?: string[]
  }>()

  const qrCode = props.two_factor_qr_code
  const recoveryCodes = props.two_factor_recovery_codes
  const [copiedCodes, setCopiedCodes] = useState(false)

  const enableForm = useForm({})
  const confirmForm = useForm({ token: '' })
  const disableForm = useForm({ password: '' })

  const handleEnable = (e: FormEvent) => {
    e.preventDefault()
    enableForm.post('/user/two-factor/enable')
  }

  const handleConfirm = (e: FormEvent) => {
    e.preventDefault()
    confirmForm.post('/user/two-factor/confirm')
  }

  const handleDisable = (e: FormEvent) => {
    e.preventDefault()
    disableForm.post('/user/two-factor/disable')
  }

  const handleRegenerateCodes = () => {
    enableForm.post('/user/two-factor/recovery')
  }

  const copyRecoveryCodes = () => {
    if (recoveryCodes) {
      navigator.clipboard.writeText(recoveryCodes.join('\n'))
      setCopiedCodes(true)
      setTimeout(() => setCopiedCodes(false), 2000)
    }
  }

  const downloadRecoveryCodes = () => {
    if (!recoveryCodes) return
    const content = [
      'Edonis LMS — Codes de récupération 2FA',
      `Généré le : ${new Date().toLocaleDateString('fr-FR')}`,
      '',
      "Chaque code ne peut être utilisé qu'une seule fois.",
      'Conservez ce fichier en lieu sûr.',
      '',
      ...recoveryCodes,
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'edonis-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Head title="Double authentification" />
      <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

      <div className="container max-w-2xl py-8">
        <div className="mb-6">
          <Link
            href="/user/settings"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux paramètres
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6">Double authentification (2FA)</h1>

        {!twoFactorEnabled && !qrCode && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Activer la double authentification
              </CardTitle>
              <CardDescription>
                Ajoutez une couche de sécurité supplémentaire à votre compte en utilisant une
                application d'authentification (Google Authenticator, Authy, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEnable}>
                <Button type="submit" disabled={enableForm.processing}>
                  {enableForm.processing ? 'Activation...' : 'Activer la 2FA'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {!twoFactorEnabled && qrCode && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Scannez le QR code
              </CardTitle>
              <CardDescription>
                Scannez ce QR code avec votre application d'authentification, puis entrez le code à
                6 chiffres pour confirmer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <img src={qrCode} alt="QR Code 2FA" className="rounded-lg border" />
              </div>

              <form onSubmit={handleConfirm} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="token">Code de vérification</Label>
                  <Input
                    type="text"
                    id="token"
                    value={confirmForm.data.token}
                    onChange={(e) => confirmForm.setData('token', e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                  {confirmForm.errors.token && (
                    <p className="text-sm text-destructive">{confirmForm.errors.token}</p>
                  )}
                </div>
                <Button type="submit" disabled={confirmForm.processing}>
                  {confirmForm.processing ? 'Vérification...' : 'Confirmer et activer'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {twoFactorEnabled && (
          <>
            <Alert variant="success" className="mb-6">
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Double authentification activée</AlertTitle>
              <AlertDescription>
                Votre compte est protégé par la double authentification.
              </AlertDescription>
            </Alert>

            {recoveryCodes && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Codes de récupération</CardTitle>
                  <CardDescription>
                    Conservez ces codes en lieu sûr. Chaque code ne peut être utilisé qu'une seule
                    fois pour accéder à votre compte si vous perdez votre appareil.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-sm">
                    {recoveryCodes.map((code) => (
                      <div key={code}>{code}</div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={copyRecoveryCodes}>
                      {copiedCodes ? (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Copié !
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" />
                          Copier les codes
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadRecoveryCodes}>
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger (.txt)
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRegenerateCodes}>
                      Régénérer les codes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldOff className="h-5 w-5" />
                  Désactiver la double authentification
                </CardTitle>
                <CardDescription>
                  Entrez votre mot de passe pour désactiver la 2FA. Cela réduira la sécurité de
                  votre compte.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDisable} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="disable-password">Mot de passe actuel</Label>
                    <Input
                      type="password"
                      id="disable-password"
                      value={disableForm.data.password}
                      onChange={(e) => disableForm.setData('password', e.target.value)}
                      required
                    />
                    {disableForm.errors.password && (
                      <p className="text-sm text-destructive">{disableForm.errors.password}</p>
                    )}
                  </div>
                  <Button type="submit" variant="destructive" disabled={disableForm.processing}>
                    {disableForm.processing ? 'Désactivation...' : 'Désactiver la 2FA'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
