import { Head } from '@inertiajs/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Info } from 'lucide-react'
import AppHeader from '~/components/layout/app-header'

interface Stats {
  total: number
  pending: number
  graded: number
}

interface Props {
  auth: {
    user: any
  }
  appSettings: any
  menus: any
  pendingEvaluations: any[]
  stats: Stats
}

export default function EvaluationsIndex({ auth, appSettings, menus, pendingEvaluations, stats }: Props) {
  return (
    <>
      <Head title="Évaluations à corriger" />

      <div className="min-h-screen bg-background">
        <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Évaluations à corriger</h1>
            <p className="text-muted-foreground mt-2">
              Gérez et corrigez les devoirs et activités de vos étudiants
            </p>
          </div>

          {/* Statistiques */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">En attente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Corrigés</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.graded}</div>
              </CardContent>
            </Card>
          </div>

          {/* Placeholder pour les évaluations */}
          <Card>
            <CardHeader>
              <CardTitle>Activités à évaluer</CardTitle>
              <CardDescription>
                Liste des devoirs, quiz et travaux soumis par vos étudiants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Cette fonctionnalité sera développée prochainement. Elle permettra de visualiser
                  et corriger les travaux soumis par les étudiants dans vos différents cours.
                </AlertDescription>
              </Alert>

              {pendingEvaluations.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Aucune évaluation en attente pour le moment</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
