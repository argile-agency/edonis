import { Head, Link } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Users, BookOpen, ClipboardList, Award, Info } from 'lucide-react'
import AppHeader from '~/components/layout/app-header'

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

interface AppSettings {
  appName: string
  appLogoUrl: string | null
  primaryColor: string
}

interface MenuItem {
  id: number
  label: string
  url: string
  icon: string | null
  children: MenuItem[]
}

interface Props {
  user: User
  auth: {
    user: User | null
  }
  appSettings: AppSettings | null
  menus: {
    header: MenuItem[]
    footer: MenuItem[]
    userMenu: MenuItem[]
  }
}

export default function Dashboard({ user, auth, appSettings, menus }: Props) {
  const hasRole = (slug: string) => user.roles.some((role) => role.slug === slug)
  const isAdmin = hasRole('admin')
  const isManager = hasRole('manager')
  const isTeacher = hasRole('teacher')
  const isStudent = hasRole('student')

  return (
    <>
      <Head title="Dashboard" />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

        {/* User Info Section */}
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {user.fullName?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">Bienvenue, {user.fullName || 'Utilisateur'}</h1>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Info Box */}
          <Card className="border-primary/50 bg-primary/5 mb-8">
            <CardHeader>
              <div className="flex items-start gap-4">
                <Info className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <CardTitle className="text-base mb-2">Bienvenue sur Edonis LMS !</CardTitle>
                  <CardDescription>
                    Ce tableau de bord sera enrichi au fur et à mesure du développement. Les modules
                    de cours, évaluations et contenus pédagogiques seront bientôt disponibles.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Rôles */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Vos rôles</CardTitle>
              <CardDescription>Les rôles associés à votre compte</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <Badge key={role.id} variant="default">
                    {role.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Actions rapides</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Admin Only */}
              {isAdmin && (
                <>
                  <Link href="/admin/users">
                    <Card className="hover:shadow-md transition cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Users className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Gérer les utilisateurs</CardTitle>
                            <CardDescription>CRUD complet des utilisateurs</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>

                  <Link href="/admin/courses">
                    <Card className="hover:shadow-md transition cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Gérer les cours</CardTitle>
                            <CardDescription>
                              Administration des cours et catégories
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                </>
              )}

              {/* Manager */}
              {isManager && (
                <>
                  <Link href="/courses">
                    <Card className="hover:shadow-md transition cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Superviser les cours</CardTitle>
                            <CardDescription>Voir les cours de la filière</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>

                  <Link href="/evaluations">
                    <Card className="hover:shadow-md transition cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                            <ClipboardList className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Évaluations</CardTitle>
                            <CardDescription>Superviser les évaluations</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                </>
              )}

              {/* Teacher */}
              {isTeacher && (
                <>
                  <Link href="/courses/create">
                    <Card className="hover:shadow-md transition cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Créer un cours</CardTitle>
                            <CardDescription>Nouveau cours</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>

                  <Link href="/courses">
                    <Card className="hover:shadow-md transition cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Mes cours</CardTitle>
                            <CardDescription>Gérer mes cours</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>

                  <Link href="/evaluations">
                    <Card className="hover:shadow-md transition cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                            <ClipboardList className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Évaluations</CardTitle>
                            <CardDescription>Corriger les devoirs</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                </>
              )}

              {/* Student */}
              {isStudent && (
                <>
                  <Link href="/courses">
                    <Card className="hover:shadow-md transition cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Mes cours</CardTitle>
                            <CardDescription>Accéder à mes cours (à venir)</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>

                  <Link href="/grades">
                    <Card className="hover:shadow-md transition cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                            <Award className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Mes notes</CardTitle>
                            <CardDescription>Consulter mes résultats (à venir)</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
