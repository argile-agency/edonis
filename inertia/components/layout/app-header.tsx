import { Link } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { GraduationCap, LayoutDashboard } from 'lucide-react'
import { ThemeToggle } from '~/components/theme-toggle'

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
}

interface MenuItem {
  id: number
  label: string
  url: string
  icon: string | null
  children: MenuItem[]
}

interface Props {
  user: User | null
  appSettings: AppSettings | null
  menus: {
    header: MenuItem[]
    footer: MenuItem[]
    userMenu: MenuItem[]
  }
}

export default function AppHeader({ user, appSettings, menus }: Props) {
  const settings = appSettings || {
    appName: 'Edonis LMS',
    primaryColor: '#5046E5',
    appLogoUrl: null,
  }

  return (
    <header
      className="border-b sticky top-0 z-50 shadow-sm"
      style={{ backgroundColor: 'hsl(var(--background))' }}
    >
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            {settings.appLogoUrl ? (
              <img src={settings.appLogoUrl} alt={settings.appName} className="h-8" />
            ) : (
              <GraduationCap className="h-8 w-8" style={{ color: settings.primaryColor }} />
            )}
            <h1 className="text-xl font-bold">{settings.appName}</h1>
          </Link>
          <ThemeToggle />
        </div>

        {/* Menu header */}
        <nav className="hidden md:flex items-center gap-6">
          {menus.header.map((item) => (
            <Link
              key={item.id}
              href={item.url}
              className="text-sm font-medium hover:text-primary transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Auth buttons / User menu */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground hidden lg:block">
                Bonjour, <span className="font-semibold">{user.fullName || user.email}</span>
              </span>
              <Button size="sm" asChild>
                <Link href="/dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Link
                href="/logout"
                method="post"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3"
              >
                Déconnexion
              </Link>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Connexion</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Inscription</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
