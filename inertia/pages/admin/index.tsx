import { Head, Link } from '@inertiajs/react'
import { BookOpen, SlidersHorizontal, Users } from 'lucide-react'
import AppLayout from '~/components/layout/app-layout'
import { Separator } from '~/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'

interface Props {
  auth: { user: any }
  appSettings: any
  menus: any
}

type HubTab = 'general' | 'users' | 'courses'

// Keep in sync with HUB_URLS in tests/functional/admin_hub.spec.ts.
const SECTIONS: { tab: HubTab; heading: string; links: { label: string; href: string }[] }[] = [
  {
    tab: 'general',
    heading: 'Réglages de la plateforme',
    links: [
      { label: 'Apparence', href: '/admin/settings?tab=appearance' },
      { label: "Page d'accueil", href: '/admin/settings?tab=home' },
      { label: 'Accès', href: '/admin/settings?tab=access' },
      { label: 'Contact et support', href: '/admin/settings?tab=contact' },
      { label: 'Corbeille', href: '/admin/settings?tab=trash' },
    ],
  },
  {
    tab: 'general',
    heading: 'Sécurité',
    links: [{ label: "Journal d'audit", href: '/admin/audit-logs' }],
  },
  {
    tab: 'users',
    heading: 'Comptes',
    links: [
      { label: 'Liste des utilisateurs', href: '/admin/users' },
      { label: 'Créer un utilisateur', href: '/admin/users/create' },
    ],
  },
  {
    tab: 'courses',
    heading: 'Gestion des cours',
    links: [
      { label: 'Tous les cours', href: '/admin/courses' },
      { label: "File d'approbation", href: '/admin/courses/approval-queue' },
      { label: 'Créer un cours', href: '/courses/create' },
    ],
  },
  {
    tab: 'courses',
    heading: 'Catégories',
    links: [
      { label: 'Catégories de cours', href: '/admin/categories' },
      { label: 'Créer une catégorie', href: '/admin/categories/create' },
    ],
  },
]

const TABS = [
  { value: 'general', label: 'Général', Icon: SlidersHorizontal },
  { value: 'users', label: 'Utilisateurs', Icon: Users },
  { value: 'courses', label: 'Cours', Icon: BookOpen },
] as const

export default function AdminIndex({ auth, appSettings, menus }: Props) {
  return (
    <>
      <Head title="Administration du site" />
      <AppLayout user={auth.user} appSettings={appSettings} menus={menus} width="narrow">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Administration du site</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Accédez à toutes les pages de gestion de la plateforme.
          </p>
        </div>

        <Tabs defaultValue="general">
          <TabsList className="mb-6 flex-wrap h-auto gap-1" aria-label="Domaines d'administration">
            {TABS.map(({ value, label, Icon }) => (
              <TabsTrigger key={value} value={value} className="gap-2 font-normal">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map(({ value }) => (
            <TabsContent key={value} value={value}>
              {SECTIONS.filter((section) => section.tab === value).map((section, index) => {
                const id = `admin-${value}-${index}`
                return (
                  <section key={id} aria-labelledby={id}>
                    {index > 0 && <Separator />}
                    <div className="grid gap-4 py-6 md:grid-cols-[12rem_1fr]">
                      <h2 id={id} className="text-lg font-bold">
                        {section.heading}
                      </h2>
                      <ul className="flex flex-col gap-2">
                        {section.links.map((link) => (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              className="text-sm font-normal text-primary underline-offset-4 hover:underline"
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                )
              })}
            </TabsContent>
          ))}
        </Tabs>
      </AppLayout>
    </>
  )
}
