import { Link, router } from '@inertiajs/react'
import { FlashMessages } from '~/components/flash-toaster'
import { Button } from '~/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  GraduationCap,
  LayoutDashboard,
  User,
  BarChart3,
  Calendar,
  MessageSquare,
  FolderOpen,
  FileText,
  Settings,
  Globe,
  Users,
  LogOut,
  UserCog,
} from 'lucide-react'
import { ThemeToggle } from '~/components/theme-toggle'
import { TermsConsentBanner } from '~/components/terms-consent-banner'

interface Role {
  id: number
  name: string
  slug: string
}

interface UserData {
  id: number
  fullName: string | null
  firstName: string | null
  lastName: string | null
  email: string
  avatarUrl: string | null
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
  user: UserData | null
  appSettings: AppSettings | null
  menus: {
    header: MenuItem[]
    footer: MenuItem[]
    userMenu: MenuItem[]
  }
}

function getInitials(user: UserData): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
  }
  if (user.fullName) {
    const parts = user.fullName.trim().split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return parts[0][0].toUpperCase()
  }
  return user.email[0].toUpperCase()
}

function getDisplayName(user: UserData): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`
  }
  return user.fullName || user.email
}

export default function AppHeader({ user, appSettings, menus }: Props) {
  const settings = appSettings || {
    appName: 'Edonis LMS',
    primaryColor: '#5046E5',
    appLogoUrl: null,
  }

  const handleLogout = () => {
    router.post('/logout')
  }

  return (
    <header
      className="border-b sticky top-0 z-50 shadow-sm"
      style={{ backgroundColor: 'hsl(var(--background))' }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:top-2 focus:left-2 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none"
      >
        Aller au contenu principal
      </a>
      <TermsConsentBanner />
      <FlashMessages />
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
          {user && (
            <Button size="sm" asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Tableau de bord
              </Link>
            </Button>
          )}
        </nav>

        {/* Auth buttons / User menu */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                    <Avatar size="sm">
                      {user.avatarUrl && (
                        <AvatarImage src={user.avatarUrl} alt={getDisplayName(user)} />
                      )}
                      <AvatarFallback>{getInitials(user)}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end">
                  {/* User identity header */}
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center gap-3">
                      <Avatar size="default">
                        {user.avatarUrl && (
                          <AvatarImage src={user.avatarUrl} alt={getDisplayName(user)} />
                        )}
                        <AvatarFallback>{getInitials(user)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{getDisplayName(user)}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Group 1: Personal pages */}
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/user/profile" className="cursor-pointer">
                        <User />
                        Profil
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/grades" className="cursor-pointer">
                        <BarChart3 />
                        Notes
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <Calendar />
                      <span className="text-muted-foreground">Calendrier</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <MessageSquare />
                      <span className="text-muted-foreground">Messages personnels</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <FolderOpen />
                      <span className="text-muted-foreground">Fichiers personnels</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <FileText />
                      <span className="text-muted-foreground">Rapports</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />

                  {/* Group 2: Settings */}
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/user/settings" className="cursor-pointer">
                        <Settings />
                        Paramètres
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/user/account" className="cursor-pointer">
                        <UserCog />
                        Mon compte
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Globe />
                        Langue
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem>Français</DropdownMenuItem>
                        <DropdownMenuItem>English</DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem disabled>
                      <Users />
                      <span className="text-muted-foreground">Prendre le rôle...</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />

                  {/* Group 3: Logout */}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive cursor-pointer"
                    onClick={handleLogout}
                  >
                    <LogOut />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
