import { Head, Link } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import AppHeader from '~/components/layout/app-header'
import {
  BookOpen,
  GraduationCap,
  Users,
  TrendingUp,
  Calendar,
  Bell,
  Award,
  FileText,
  LayoutDashboard,
  PlusCircle,
} from 'lucide-react'

interface Role {
  id: number
  name: string
  slug: string
}

interface User {
  id: number
  fullName: string | null
  email: string
  roles: Role[]
}

interface AppSettings {
  appName: string
  appLogoUrl: string | null
  primaryColor: string
  welcomeMessage: string | null
  heroTitle: string | null
  heroSubtitle: string | null
  showPublicCourses: boolean
  allowRegistration: boolean
}

interface MenuItem {
  id: number
  label: string
  url: string
  icon: string | null
  children: MenuItem[]
}

interface DashboardData {
  enrolledCourses?: Array<{
    id: number
    code: string
    title: string
    progress: number
    lastAccess: string
    currentChapter: string
  }>
  upcomingDeadlines?: Array<{
    id: number
    title: string
    courseTitle: string
    dueDate: string
    daysRemaining: number
  }>
  stats?: {
    coursesCompleted: number
    hoursLearned: number
    averageGrade: number
    totalStudents?: number
    activeCourses?: number
    averageCompletion?: number
  }
  notifications?: Array<{
    id: number
    type: string
    title: string
    message: string
    icon: string
  }>
  myCourses?: Array<{
    id: number
    code: string
    title: string
    enrolledCount: number
    status: string
  }>
  pendingWork?: Array<{
    id: number
    title: string
    courseTitle: string
    submissionsCount: number
  }>
}

interface Props {
  auth: {
    user: User | null
  }
  appSettings: AppSettings | null
  menus: {
    header: MenuItem[]
    footer: MenuItem[]
    userMenu: MenuItem[]
  }
  dashboardData?: DashboardData
}

export default function Home({ auth, appSettings, menus, dashboardData }: Props) {
  const user = auth.user
  const settings = appSettings || {
    appName: 'Edonis LMS',
    primaryColor: '#5046E5',
    welcomeMessage: 'Bienvenue sur notre plateforme',
    heroTitle: 'Apprenez à votre rythme',
    heroSubtitle: 'Découvrez nos cours en ligne',
    showPublicCourses: true,
    allowRegistration: true,
  }

  // Déterminer le rôle principal de l'utilisateur
  const isStudent = user?.roles?.some((r) => r.slug === 'student')
  const isInstructor = user?.roles?.some((r) => ['manager', 'teacher'].includes(r.slug))
  const isAdmin = user?.roles?.some((r) => r.slug === 'admin')

  return (
    <>
      <Head title="Accueil" />

      <div className="min-h-screen bg-background">
        {/* Header avec menu dynamique */}
        <AppHeader user={user} appSettings={appSettings} menus={menus} />

        {/* Contenu principal basé sur le rôle */}
        {!user && <PublicHomePage settings={settings} />}
        {user && isStudent && <StudentHomePage user={user} data={dashboardData} />}
        {user && isInstructor && <InstructorHomePage user={user} data={dashboardData} />}
        {user && isAdmin && !isStudent && !isInstructor && <AdminHomePage user={user} />}

        {/* Footer avec menu dynamique */}
        <footer className="border-t bg-muted/50 mt-20">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex gap-6">
                {menus.footer.map((item) => (
                  <Link
                    key={item.id}
                    href={item.url}
                    className="text-sm text-muted-foreground hover:text-foreground transition"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                © 2024 {settings.appName}. Tous droits réservés.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

// Page d'accueil pour visiteurs non connectés
function PublicHomePage({ settings }: { settings: any }) {
  return (
    <div className="container mx-auto px-4">
      {/* Hero Section */}
      <section className="py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">{settings.heroTitle}</h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          {settings.heroSubtitle}
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/register">
            <Button size="lg">Commencer maintenant</Button>
          </Link>
          <Link href="/courses">
            <Button size="lg" variant="outline">
              Explorer les cours
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Pourquoi nous choisir ?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Cours de qualité</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Accédez à des cours créés par des experts dans leur domaine
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Certificats</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Obtenez des certificats reconnus après avoir complété vos cours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Communauté</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Rejoignez une communauté d'apprenants passionnés
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

// Dashboard étudiant
function StudentHomePage({ user, data }: { user: User; data?: DashboardData }) {
  const courses = data?.enrolledCourses || []
  const deadlines = data?.upcomingDeadlines || []
  const stats = data?.stats || { coursesCompleted: 0, hoursLearned: 0, averageGrade: 0 }
  const notifications = data?.notifications || []

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bonjour, {user.fullName || user.email} 👋</h1>
        <p className="text-muted-foreground">Voici un aperçu de votre progression</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Mes cours en cours */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Mes cours en cours
            </CardTitle>
            <CardDescription>Continuez là où vous vous êtes arrêté</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {courses.length > 0 ? (
                courses.slice(0, 3).map((course) => (
                  <Link key={course.id} href={`/courses/${course.id}`} className="block">
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition cursor-pointer">
                      <div>
                        <h3 className="font-semibold">{course.title}</h3>
                        <p className="text-sm text-muted-foreground">{course.currentChapter}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{course.progress}% complété</Badge>
                        <div className="w-32 h-2 bg-muted rounded-full mt-2">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${course.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Vous n'êtes inscrit à aucun cours pour le moment
                </p>
              )}
              <Link href="/courses">
                <Button variant="outline" className="w-full my-2">
                  {courses.length > 0 ? 'Voir tous mes cours' : 'Découvrir les cours'}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Prochaines échéances */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Prochaines échéances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deadlines.length > 0 ? (
                deadlines.map((deadline) => (
                  <div key={deadline.id} className="p-3 bg-muted rounded-lg">
                    <p className="font-medium text-sm">{deadline.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Dans {deadline.daysRemaining} jour{deadline.daysRemaining > 1 ? 's' : ''}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune échéance à venir
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statistiques */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Vos statistiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Cours complétés</span>
                  <span className="text-sm font-bold">{stats.coursesCompleted}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Heures d'apprentissage</span>
                  <span className="text-sm font-bold">{stats.hoursLearned}h</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Moyenne générale</span>
                  <span className="text-sm font-bold">{stats.averageGrade}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div key={notif.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    {notif.icon === 'FileText' && (
                      <FileText className="h-5 w-5 mt-0.5 text-primary" />
                    )}
                    {notif.icon === 'Award' && <Award className="h-5 w-5 mt-0.5 text-primary" />}
                    <div>
                      <p className="text-sm font-medium">{notif.title}</p>
                      <p className="text-xs text-muted-foreground">{notif.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune notification
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Dashboard instructeur
function InstructorHomePage({ user, data }: { user: User; data?: DashboardData }) {
  const myCourses = data?.myCourses || []
  const pendingWork = data?.pendingWork || []
  const stats = data?.stats || { totalStudents: 0, activeCourses: 0, averageCompletion: 0 }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Tableau de bord instructeur</h1>
        <p className="text-muted-foreground">Gérez vos cours et étudiants</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Mes cours */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Mes cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myCourses.length > 0 ? (
                myCourses.map((course) => (
                  <Link key={course.id} href={`/courses/${course.id}`} className="block">
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition cursor-pointer">
                      <div>
                        <h3 className="font-semibold">{course.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {course.enrolledCount} étudiant{course.enrolledCount > 1 ? 's' : ''}{' '}
                          inscrit{course.enrolledCount > 1 ? 's' : ''}
                        </p>
                      </div>
                      <Badge>{course.status}</Badge>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Vous n'avez aucun cours pour le moment
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* À corriger */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Travaux à corriger
              {pendingWork.length > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {pendingWork.reduce((sum, work) => sum + work.submissionsCount, 0)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingWork.length > 0 ? (
                pendingWork.map((work) => (
                  <div key={work.id} className="p-3 bg-muted rounded-lg">
                    <p className="font-medium text-sm">{work.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {work.submissionsCount} soumission{work.submissionsCount > 1 ? 's' : ''} en
                      attente
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun travail à corriger
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statistiques */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Statistiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Total étudiants</span>
                  <span className="text-sm font-bold">{stats.totalStudents}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Cours actifs</span>
                  <span className="text-sm font-bold">{stats.activeCourses}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Taux de complétion moyen</span>
                  <span className="text-sm font-bold">{stats.averageCompletion}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Page d'accueil admin - simple et accueillante
function AdminHomePage({ user }: { user: User }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bienvenue, {user.fullName || user.email}</h1>
        <p className="text-muted-foreground">
          Accédez rapidement aux fonctionnalités d'administration
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/dashboard">
          <Card className="hover:shadow-lg transition cursor-pointer h-full">
            <CardHeader>
              <LayoutDashboard className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Tableau de bord</CardTitle>
              <CardDescription>Vue d'ensemble et statistiques</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="hover:shadow-lg transition cursor-pointer h-full">
            <CardHeader>
              <Users className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Utilisateurs</CardTitle>
              <CardDescription>Gérer les utilisateurs et rôles</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/courses">
          <Card className="hover:shadow-lg transition cursor-pointer h-full">
            <CardHeader>
              <BookOpen className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Cours</CardTitle>
              <CardDescription>Gérer les cours et contenus</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
