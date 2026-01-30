import { Head, Link, useForm, router } from '@inertiajs/react'
import { FormEvent } from 'react'
import { FlashMessages } from '~/components/flash-toaster'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  ArrowLeft,
  Settings,
  Bell,
  MessageSquare,
  PenTool,
  Calendar,
  Database,
  Shield,
  Link2,
  Unlink,
} from 'lucide-react'

interface User {
  id: number
  locale: string
  timezone: string
  profileVisibility: string
}

interface SocialAccountData {
  id: number
  provider: string
  email: string | null
  name: string | null
  createdAt: string
}

interface Props {
  user: User
  socialAccounts?: SocialAccountData[]
}

const TIMEZONES = [
  'Europe/Paris',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Brussels',
  'Europe/Zurich',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Montreal',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Africa/Casablanca',
  'Africa/Tunis',
  'Africa/Dakar',
  'Pacific/Auckland',
  'Australia/Sydney',
]

function PlaceholderTab({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground/70">{description}</p>
      </CardContent>
    </Card>
  )
}

const PROVIDERS: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
}

export default function SettingsIndex({ user, socialAccounts = [] }: Props) {
  const { data, setData, put, processing } = useForm({
    locale: user.locale || 'fr',
    timezone: user.timezone || 'Europe/Paris',
    profileVisibility: user.profileVisibility || 'public',
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    put('/user/settings')
  }

  return (
    <>
      <Head title="Paramètres" />
      <FlashMessages />

      <div className="min-h-screen bg-background py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/dashboard">
              <Button variant="ghost" className="mb-4 gap-2">
                <ArrowLeft className="h-4 w-4" />
                Retour au tableau de bord
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Paramètres</h1>
            <p className="text-muted-foreground mt-1">
              Configurez vos préférences et personnalisez votre expérience
            </p>
          </div>

          <Tabs defaultValue="general">
            <TabsList className="mb-6 flex-wrap h-auto gap-1">
              <TabsTrigger value="general" className="gap-1.5">
                <Settings className="h-4 w-4" />
                Général
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-1.5">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="forum" className="gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Forum
              </TabsTrigger>
              <TabsTrigger value="editor" className="gap-1.5">
                <PenTool className="h-4 w-4" />
                Éditeur
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1.5">
                <Calendar className="h-4 w-4" />
                Calendrier
              </TabsTrigger>
              <TabsTrigger value="content-bank" className="gap-1.5">
                <Database className="h-4 w-4" />
                Banque de contenus
              </TabsTrigger>
            </TabsList>

            {/* General tab (functional) */}
            <TabsContent value="general">
              <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Préférences générales</CardTitle>
                    <CardDescription>
                      Langue, fuseau horaire et visibilité de votre profil
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="locale">Langue de l'interface</Label>
                        <Select
                          value={data.locale}
                          onValueChange={(value) => setData('locale', value)}
                        >
                          <SelectTrigger id="locale">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fr">Français</SelectItem>
                            <SelectItem value="en">English</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="timezone">Fuseau horaire</Label>
                        <Select
                          value={data.timezone}
                          onValueChange={(value) => setData('timezone', value)}
                        >
                          <SelectTrigger id="timezone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz} value={tz}>
                                {tz}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="profileVisibility">Visibilité du profil</Label>
                        <Select
                          value={data.profileVisibility}
                          onValueChange={(value) => setData('profileVisibility', value)}
                        >
                          <SelectTrigger id="profileVisibility">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">
                              Public — Visible par tous les utilisateurs
                            </SelectItem>
                            <SelectItem value="participants">
                              Participants — Visible par les participants de vos cours
                            </SelectItem>
                            <SelectItem value="private">
                              Privé — Visible uniquement par vous et les administrateurs
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Contrôle qui peut voir votre profil sur la plateforme
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                  <Link href="/dashboard">
                    <Button type="button" variant="outline">
                      Annuler
                    </Button>
                  </Link>
                  <Button type="submit" disabled={processing}>
                    {processing ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                  </Button>
                </div>
              </form>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Sécurité
                  </CardTitle>
                  <CardDescription>
                    Protégez votre compte avec la double authentification (2FA)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/user/two-factor">
                    <Button variant="outline">Configurer la double authentification</Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Comptes liés
                  </CardTitle>
                  <CardDescription>
                    Gérez les comptes sociaux connectés à votre profil
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {socialAccounts.length > 0 ? (
                    <div className="space-y-3">
                      {socialAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                              <span className="text-sm font-medium">
                                {(PROVIDERS[account.provider] || account.provider)[0]}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {PROVIDERS[account.provider] || account.provider}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {account.email || account.name || 'Connecté'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              router.delete(`/user/social-accounts/${account.id}`, {
                                preserveScroll: true,
                              })
                            }
                          >
                            <Unlink className="mr-2 h-4 w-4" />
                            Déconnecter
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun compte social connecté.</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <a href="/auth/google/redirect">
                      <Button variant="outline" size="sm">
                        Connecter Google
                      </Button>
                    </a>
                    <a href="/auth/github/redirect">
                      <Button variant="outline" size="sm">
                        Connecter GitHub
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications tab (placeholder) */}
            <TabsContent value="notifications">
              <PlaceholderTab
                icon={Bell}
                title="Préférences de notifications"
                description="Configurez vos préférences de notifications par catégorie (cours, devoirs, forum, messages, système) et par canal (web, email). Bientôt disponible."
              />
            </TabsContent>

            {/* Forum tab (placeholder) */}
            <TabsContent value="forum">
              <PlaceholderTab
                icon={MessageSquare}
                title="Préférences du forum"
                description="Configurez le suivi des discussions, le format d'affichage et les notifications du forum. Bientôt disponible."
              />
            </TabsContent>

            {/* Editor tab (placeholder) */}
            <TabsContent value="editor">
              <PlaceholderTab
                icon={PenTool}
                title="Préférences de l'éditeur"
                description="Choisissez votre éditeur de texte préféré et configurez ses options. Bientôt disponible."
              />
            </TabsContent>

            {/* Calendar tab (placeholder) */}
            <TabsContent value="calendar">
              <PlaceholderTab
                icon={Calendar}
                title="Préférences du calendrier"
                description="Configurez l'affichage du calendrier, les rappels et l'export iCal. Bientôt disponible."
              />
            </TabsContent>

            {/* Content bank tab (placeholder) */}
            <TabsContent value="content-bank">
              <PlaceholderTab
                icon={Database}
                title="Préférences de la banque de contenus"
                description="Gérez vos préférences pour la banque de contenus partagée. Bientôt disponible."
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}
