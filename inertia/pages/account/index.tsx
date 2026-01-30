import { Head, Link, useForm } from '@inertiajs/react'
import { FormEvent, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Download, Trash2, ArrowLeft, Info, ChevronDown } from 'lucide-react'
import AppHeader from '~/components/layout/app-header'

interface Props {
  user: any
  auth: { user: any }
  appSettings: any
  menus: any
}

export default function AccountIndex({ auth, appSettings, menus }: Props) {
  const [showDeleteForm, setShowDeleteForm] = useState(false)

  const exportForm = useForm({})
  const deleteForm = useForm({ password: '' })

  const handleExport = (e: FormEvent) => {
    e.preventDefault()
    // Use a regular form submission for file download
    window.location.href = '/user/account/export'
  }

  const handleDelete = (e: FormEvent) => {
    e.preventDefault()
    deleteForm.delete('/user/account')
  }

  return (
    <>
      <Head title="Mon compte" />
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

        <h1 className="text-2xl font-bold mb-6">Mon compte</h1>

        {/* Export section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exporter mes données
            </CardTitle>
            <CardDescription>
              Conformément au RGPD (article 20), vous pouvez télécharger une copie de toutes vos
              données personnelles stockées sur la plateforme.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Le fichier exporté contient vos données personnelles au format JSON.
              </AlertDescription>
            </Alert>
            <details className="mb-4 rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50">
                <ChevronDown className="h-4 w-4 transition-transform [[open]>&]:rotate-180" />
                Apercu des données exportées
              </summary>
              <div className="border-t px-4 py-3 text-sm text-muted-foreground space-y-2">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Profil</strong> — nom, email, bio, téléphone, adresse, organisation
                  </li>
                  <li>
                    <strong>Inscriptions</strong> — cours auxquels vous êtes inscrit, dates et
                    statuts
                  </li>
                  <li>
                    <strong>Soumissions</strong> — travaux rendus, notes et commentaires reçus
                  </li>
                  <li>
                    <strong>Progression</strong> — avancement dans les contenus de cours
                  </li>
                  <li>
                    <strong>Historique d'activité</strong> — 500 dernières actions (connexions,
                    modifications)
                  </li>
                </ul>
              </div>
            </details>
            <form onSubmit={handleExport}>
              <Button type="submit" variant="outline" disabled={exportForm.processing}>
                <Download className="mr-2 h-4 w-4" />
                {exportForm.processing ? 'Export en cours...' : 'Télécharger mes données'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Delete section */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Supprimer mon compte
            </CardTitle>
            <CardDescription>
              Conformément au RGPD (article 17 — droit à l'effacement), vous pouvez demander la
              suppression de votre compte. Cette action est irréversible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                La suppression de votre compte anonymisera toutes vos données personnelles. Vos
                soumissions et notes seront conservées à des fins d'intégrité académique mais ne
                seront plus associées à votre identité.
              </AlertDescription>
            </Alert>

            {!showDeleteForm ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer mon compte
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Votre compte sera anonymisé et vous ne pourrez
                      plus vous connecter. Vos données personnelles seront effacées.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setShowDeleteForm(true)}>
                      Je comprends, continuer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <form onSubmit={handleDelete} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="delete-password">
                    Entrez votre mot de passe pour confirmer la suppression
                  </Label>
                  <Input
                    type="password"
                    id="delete-password"
                    value={deleteForm.data.password}
                    onChange={(e) => deleteForm.setData('password', e.target.value)}
                    required
                  />
                  {deleteForm.errors.password && (
                    <p className="text-sm text-destructive">{deleteForm.errors.password}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowDeleteForm(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" variant="destructive" disabled={deleteForm.processing}>
                    {deleteForm.processing ? 'Suppression en cours...' : 'Supprimer définitivement'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
