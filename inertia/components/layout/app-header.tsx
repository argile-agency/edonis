import { useEffect, useRef, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import { FlashMessages } from '~/components/flash-toaster'
import { Button } from '~/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Separator } from '~/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
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
  Wrench,
  Bell,
  ChevronDown,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react'
import { ThemeToggle } from '~/components/theme-toggle'
import { TermsConsentBanner } from '~/components/terms-consent-banner'
import { isSafeImageSrc } from '~/lib/safe_url'
import { cn } from '~/lib/utils'
import { HeaderSearch } from '~/components/layout/header-search'
import { EditModeSwitch } from '~/components/layout/edit-mode-switch'

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
  allowRegistration?: boolean
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

// Future feature: focusable, announced as unavailable, never acts (no `disabled`, which would drop it from the tab order).
function PlaceholderButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-disabled="true"
          aria-label={label}
          onClick={(e) => e.preventDefault()}
          className="h-9 w-9 rounded-full opacity-50 cursor-not-allowed hover:bg-transparent"
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Bientôt disponible</TooltipContent>
    </Tooltip>
  )
}

export default function AppHeader({ user, appSettings, menus }: Props) {
  const settings = appSettings || {
    appName: 'Edonis LMS',
    primaryColor: '#5046E5',
    appLogoUrl: null,
  }

  const { courseEditing } = usePage<{ courseEditing?: { canEdit: boolean } }>().props
  const canEditCourse = courseEditing?.canEdit === true
  const isAdmin = !!user && user.roles.some((r) => r.slug === 'admin')
  const allowRegistration = !appSettings || Boolean(appSettings.allowRegistration)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(
    () =>
      router.on('navigate', () => {
        setMenuOpen(false)
        setSearchOpen(false)
      }),
    []
  )

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      // An open Radix menu or tooltip handles Escape first (capture phase) and marks it handled.
      if (e.key !== 'Escape' || e.defaultPrevented) return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

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
      <TooltipProvider delayDuration={300}>
        <div className="container mx-auto px-4 h-16 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            {isSafeImageSrc(settings.appLogoUrl) ? (
              <img src={settings.appLogoUrl} alt={settings.appName} className="h-8" />
            ) : (
              <GraduationCap
                className="h-8 w-8"
                style={{ color: settings.primaryColor }}
                aria-hidden="true"
              />
            )}
            {/* sr-only rather than hidden so the link keeps its accessible name */}
            <span
              className={cn(
                'text-lg font-bold',
                user && 'sr-only sm:not-sr-only lg:sr-only xl:not-sr-only'
              )}
            >
              {settings.appName}
            </span>
          </Link>

          <nav
            aria-label="Navigation principale"
            className={cn(
              'hidden lg:flex items-center gap-6 overflow-hidden',
              searchOpen && 'lg:hidden xl:flex'
            )}
          >
            {menus.header.map((item) => (
              <Link
                key={item.id}
                href={item.url}
                className="text-sm font-normal hover:text-primary transition"
              >
                {item.label}
              </Link>
            ))}
            {user && (
              <Button size="sm" asChild className="font-bold">
                <Link href="/dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Tableau de bord
                </Link>
              </Button>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            {user ? (
              <>
                {isAdmin && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="hidden lg:inline-flex h-9 w-9 rounded-full"
                      >
                        <Link href="/admin" aria-label="Administration du site">
                          <Wrench className="h-5 w-5" aria-hidden="true" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Administration du site</TooltipContent>
                  </Tooltip>
                )}
                <div className="hidden lg:flex">
                  <HeaderSearch variant="bar" onOpenChange={setSearchOpen} />
                </div>
                <ThemeToggle />
                <PlaceholderButton icon={Bell} label="Notifications (bientôt disponible)" />
                <PlaceholderButton icon={MessageSquare} label="Messages (bientôt disponible)" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="group flex items-center gap-1 rounded-full p-1 pr-2 hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {/* Name from sr-only text, initials hidden: an aria-label not containing the visible initials fails label-content-name-mismatch */}
                      <span className="sr-only">Menu du compte</span>
                      <Avatar size="sm" aria-hidden="true">
                        {user.avatarUrl && (
                          <AvatarImage src={user.avatarUrl} alt={getDisplayName(user)} />
                        )}
                        <AvatarFallback>{getInitials(user)}</AvatarFallback>
                      </Avatar>
                      <ChevronDown
                        className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                        aria-hidden="true"
                      />
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
                          <p className="text-sm font-bold leading-none">{getDisplayName(user)}</p>
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
                        <span className="text-muted-foreground">
                          Messages personnels (bientôt disponible)
                        </span>
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
                      {isAdmin && (
                        <DropdownMenuItem asChild>
                          <Link href="/admin" className="cursor-pointer">
                            <Wrench />
                            Administration du site
                          </Link>
                        </DropdownMenuItem>
                      )}
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
                {canEditCourse && (
                  <div className="hidden lg:flex items-center">
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    <EditModeSwitch id="edit-mode-switch" />
                  </div>
                )}
              </>
            ) : (
              <>
                <ThemeToggle />
                <Button variant="outline" size="sm" asChild className="font-bold">
                  <Link href="/login">Connexion</Link>
                </Button>
                {/* SQLite/MySQL may send 0/1; null settings keep the link. */}
                {allowRegistration && (
                  <Button size="sm" asChild className="hidden lg:inline-flex font-bold">
                    <Link href="/register">Inscription</Link>
                  </Button>
                )}
              </>
            )}
            <Button
              ref={menuButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        <div
          id="mobile-menu"
          className="lg:hidden border-t bg-[hsl(var(--background))]"
          hidden={!menuOpen}
        >
          <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
            {user && <HeaderSearch variant="panel" />}
            <nav aria-label="Navigation principale (mobile)" className="flex flex-col">
              {menus.header.map((item) => (
                <Link
                  key={item.id}
                  href={item.url}
                  className="py-2 text-sm font-normal hover:text-primary transition"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {user ? (
              <>
                <Button size="sm" asChild className="w-full sm:w-auto font-bold">
                  <Link href="/dashboard" className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    Tableau de bord
                  </Link>
                </Button>
                {(isAdmin || canEditCourse) && <Separator />}
                {isAdmin && (
                  <Link href="/admin" className="flex items-center gap-2 py-2 text-sm font-normal">
                    <Wrench className="h-4 w-4" aria-hidden="true" />
                    Administration du site
                  </Link>
                )}
                {canEditCourse && (
                  <div className="flex items-center justify-between py-2">
                    <EditModeSwitch id="edit-mode-switch-mobile" />
                  </div>
                )}
              </>
            ) : (
              allowRegistration && (
                <Button size="sm" asChild className="w-full font-bold">
                  <Link href="/register">Inscription</Link>
                </Button>
              )
            )}
          </div>
        </div>
      </TooltipProvider>
    </header>
  )
}
