import { Head, router, useForm } from '@inertiajs/react'
import { FormEvent, ReactNode, useState } from 'react'
import { toast } from 'sonner'
import { House, KeyRound, LifeBuoy, Palette } from 'lucide-react'
import AppHeader from '~/components/layout/app-header'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'

type Tab = 'appearance' | 'home' | 'access' | 'contact'

interface Settings {
  appName: string
  appLogoUrl: string | null
  appFaviconUrl: string | null
  primaryColor: string
  heroTitle: string | null
  heroSubtitle: string | null
  heroImageUrl: string | null
  announcementText: string | null
  allowRegistration: boolean
  contactEmail: string | null
  supportUrl: string | null
  socialLinks: {
    facebook: string | null
    twitter: string | null
    linkedin: string | null
    github: string | null
  }
}

interface Props {
  settings: Settings
  activeTab: Tab
  auth: { user: any }
  appSettings: any
  menus: any
}

const ERROR_TOAST = 'Certains champs sont invalides. Corrigez-les puis enregistrez à nouveau.'

/** DOM id of the control for a form error key (`socialLinks.facebook` → `social-facebook`). */
function idFor(key: string) {
  return key.startsWith('socialLinks.') ? `social-${key.slice('socialLinks.'.length)}` : key
}

/** aria attributes tying a control to its help and error paragraphs. */
function describedBy(id: string, hasHelp: boolean, error?: string) {
  const ids = [hasHelp && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ')
  return { 'aria-invalid': !!error, 'aria-describedby': ids || undefined }
}

function Field({
  id,
  label,
  required,
  help,
  errorText,
  children,
}: {
  id: string
  label: string
  required?: boolean
  help?: ReactNode
  errorText?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-muted-foreground"> (obligatoire)</span>}
      </Label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
      {errorText && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errorText}
        </p>
      )}
    </div>
  )
}

function SubmitRow({ processing, label }: { processing: boolean; label: string }) {
  return (
    <div className="flex justify-end mt-6">
      <Button type="submit" disabled={processing} aria-busy={processing ? 'true' : undefined}>
        {processing ? 'Enregistrement…' : label}
      </Button>
    </div>
  )
}

const HELP = {
  appName: "Affiché dans l'en-tête et le pied de page.",
  appLogoUrl:
    "Chemin commençant par / (ex. /uploads/logo.png) ou adresse de ce site. Les images hébergées sur un autre domaine sont bloquées par la politique de sécurité. Laissez vide pour afficher l'icône par défaut.",
  appFaviconUrl:
    "Petite icône affichée dans l'onglet du navigateur. Chemin commençant par / ou adresse de ce site uniquement.",
  primaryColor:
    "Couleur de l'icône affichée dans l'en-tête lorsqu'aucun logo n'est défini. Format #RRGGBB.",
  heroTitle: 'Grand titre affiché aux visiteurs non connectés.',
  heroSubtitle: 'Phrase affichée sous le titre principal.',
  heroImageUrl:
    "Image affichée sous les boutons de la page d'accueil. Chemin commençant par / (ex. /uploads/accueil.jpg) ou adresse de ce site uniquement. Laissez vide pour ne pas afficher d'image.",
  announcementText:
    "Texte court affiché en haut de la page d'accueil, sans mise en forme. Si l'adresse de contact y figure, elle devient un lien cliquable. Laissez vide pour masquer le bandeau.",
}

export default function AdminSettings({ settings, activeTab, auth, appSettings, menus }: Props) {
  const [tab, setTabState] = useState<Tab>(activeTab)

  // Declared at page level: Radix unmounts inactive TabsContent, so edits survive a tab switch.
  const appearanceForm = useForm({
    appName: settings.appName ?? '',
    appLogoUrl: settings.appLogoUrl ?? '',
    appFaviconUrl: settings.appFaviconUrl ?? '',
    primaryColor: settings.primaryColor ?? '',
  })
  const homeForm = useForm({
    heroTitle: settings.heroTitle ?? '',
    heroSubtitle: settings.heroSubtitle ?? '',
    heroImageUrl: settings.heroImageUrl ?? '',
    announcementText: settings.announcementText ?? '',
  })
  const accessForm = useForm({
    allowRegistration: settings.allowRegistration,
  })
  const contactForm = useForm({
    contactEmail: settings.contactEmail ?? '',
    supportUrl: settings.supportUrl ?? '',
    socialLinks: {
      facebook: settings.socialLinks?.facebook ?? '',
      twitter: settings.socialLinks?.twitter ?? '',
      linkedin: settings.socialLinks?.linkedin ?? '',
      github: settings.socialLinks?.github ?? '',
    },
  })

  const [logoBroken, setLogoBroken] = useState(false)

  // Keep ?tab= in the URL so VineJS's redirect-back (Referer) lands on the same tab.
  const setTab = (value: string) => {
    setTabState(value as Tab)
    router.replace({
      url: `/admin/settings?tab=${value}`,
      preserveState: true,
      preserveScroll: true,
    })
  }

  const submit =
    (
      form: { put: (url: string, options: object) => void },
      target: Tab,
      fieldOrder: string[]
    ) =>
    (e: FormEvent) => {
      e.preventDefault()
      form.put(`/admin/settings/${target}`, {
        // 'errors': keep state (tab, input) on validation failure; remount on success so
        // forms re-initialise from fresh props and the flash toast fires again.
        preserveState: 'errors',
        preserveScroll: true,
        onError: (errors: Record<string, string>) => {
          toast.error(ERROR_TOAST)
          const first = fieldOrder.find((key) => errors[key]) ?? Object.keys(errors)[0]
          if (first) document.getElementById(idFor(first))?.focus()
        },
      })
    }

  const ae = appearanceForm.errors
  const he = homeForm.errors

  return (
    <>
      <Head title="Réglages de la plateforme" />
      <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Réglages de la plateforme</h1>
          <p className="text-muted-foreground mt-1">
            Modifiez l'apparence, la page d'accueil, l'accès et les coordonnées de la plateforme.
            Chaque onglet s'enregistre séparément.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 flex-wrap h-auto gap-1" aria-label="Sections des réglages">
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" aria-hidden="true" />
              Apparence
            </TabsTrigger>
            <TabsTrigger value="home" className="gap-2">
              <House className="h-4 w-4" aria-hidden="true" />
              Page d'accueil
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-2">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Accès
            </TabsTrigger>
            <TabsTrigger value="contact" className="gap-2">
              <LifeBuoy className="h-4 w-4" aria-hidden="true" />
              Contact et support
            </TabsTrigger>
          </TabsList>

          {/* Apparence */}
          <TabsContent value="appearance">
            <form
              noValidate
              onSubmit={submit(appearanceForm, 'appearance', [
                'appName',
                'appLogoUrl',
                'appFaviconUrl',
                'primaryColor',
              ])}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Apparence</CardTitle>
                  <CardDescription>
                    Nom, logo, icône d'onglet et couleur de la plateforme.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Field
                    id="appName"
                    label="Nom de la plateforme"
                    required
                    help={HELP.appName}
                    errorText={ae.appName}
                  >
                    <Input
                      id="appName"
                      value={appearanceForm.data.appName}
                      onChange={(e) => appearanceForm.setData('appName', e.target.value)}
                      maxLength={100}
                      required
                      aria-required="true"
                      {...describedBy('appName', true, ae.appName)}
                    />
                  </Field>

                  <Field
                    id="appLogoUrl"
                    label="Logo (adresse de l'image)"
                    help={HELP.appLogoUrl}
                    errorText={ae.appLogoUrl}
                  >
                    <Input
                      id="appLogoUrl"
                      type="text"
                      placeholder="/uploads/logo.png"
                      value={appearanceForm.data.appLogoUrl}
                      onChange={(e) => {
                        setLogoBroken(false)
                        appearanceForm.setData('appLogoUrl', e.target.value)
                      }}
                      maxLength={255}
                      {...describedBy('appLogoUrl', true, ae.appLogoUrl)}
                    />
                    {appearanceForm.data.appLogoUrl.trim() !== '' &&
                      (logoBroken ? (
                        <p className="text-sm text-muted-foreground">
                          Image introuvable à cette adresse.
                        </p>
                      ) : (
                        <img
                          src={appearanceForm.data.appLogoUrl}
                          alt="Aperçu du logo"
                          className="h-8"
                          onError={() => setLogoBroken(true)}
                        />
                      ))}
                  </Field>

                  <Field
                    id="appFaviconUrl"
                    label="Icône d'onglet (favicon)"
                    help={HELP.appFaviconUrl}
                    errorText={ae.appFaviconUrl}
                  >
                    <Input
                      id="appFaviconUrl"
                      type="text"
                      placeholder="/favicon.ico"
                      value={appearanceForm.data.appFaviconUrl}
                      onChange={(e) => appearanceForm.setData('appFaviconUrl', e.target.value)}
                      maxLength={255}
                      {...describedBy('appFaviconUrl', true, ae.appFaviconUrl)}
                    />
                  </Field>

                  <Field
                    id="primaryColor"
                    label="Couleur principale"
                    required
                    help={HELP.primaryColor}
                    errorText={ae.primaryColor}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-12 shrink-0">
                        <Input
                          type="color"
                          className="w-12 h-9 p-1"
                          aria-label="Choisir la couleur principale"
                          value={
                            /^#[0-9a-f]{6}$/i.test(appearanceForm.data.primaryColor)
                              ? appearanceForm.data.primaryColor
                              : '#000000'
                          }
                          onChange={(e) => appearanceForm.setData('primaryColor', e.target.value)}
                        />
                      </div>
                      <div className="w-32 shrink-0">
                        <Input
                          id="primaryColor"
                          type="text"
                          className="w-32 font-mono"
                          placeholder="#5046E5"
                          value={appearanceForm.data.primaryColor}
                          onChange={(e) => appearanceForm.setData('primaryColor', e.target.value)}
                          maxLength={7}
                          required
                          aria-required="true"
                          {...describedBy('primaryColor', true, ae.primaryColor)}
                        />
                      </div>
                    </div>
                  </Field>
                </CardContent>
              </Card>
              <SubmitRow processing={appearanceForm.processing} label="Enregistrer l'apparence" />
            </form>
          </TabsContent>

          {/* Page d'accueil */}
          <TabsContent value="home">
            <form
              noValidate
              onSubmit={submit(homeForm, 'home', [
                'heroTitle',
                'heroSubtitle',
                'heroImageUrl',
                'announcementText',
              ])}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Page d'accueil</CardTitle>
                  <CardDescription>
                    Textes et image affichés aux visiteurs sur la page d'accueil.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Field
                    id="heroTitle"
                    label="Titre principal"
                    required
                    help={HELP.heroTitle}
                    errorText={he.heroTitle}
                  >
                    <Input
                      id="heroTitle"
                      value={homeForm.data.heroTitle}
                      onChange={(e) => homeForm.setData('heroTitle', e.target.value)}
                      maxLength={150}
                      required
                      aria-required="true"
                      {...describedBy('heroTitle', true, he.heroTitle)}
                    />
                  </Field>

                  <Field
                    id="heroSubtitle"
                    label="Sous-titre"
                    help={HELP.heroSubtitle}
                    errorText={he.heroSubtitle}
                  >
                    <Textarea
                      id="heroSubtitle"
                      rows={3}
                      value={homeForm.data.heroSubtitle}
                      onChange={(e) => homeForm.setData('heroSubtitle', e.target.value)}
                      maxLength={300}
                      {...describedBy('heroSubtitle', true, he.heroSubtitle)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {homeForm.data.heroSubtitle.length} / 300 caractères
                    </p>
                  </Field>

                  <Field
                    id="heroImageUrl"
                    label="Image d'accueil (adresse)"
                    help={HELP.heroImageUrl}
                    errorText={he.heroImageUrl}
                  >
                    <Input
                      id="heroImageUrl"
                      type="text"
                      value={homeForm.data.heroImageUrl}
                      onChange={(e) => homeForm.setData('heroImageUrl', e.target.value)}
                      maxLength={255}
                      {...describedBy('heroImageUrl', true, he.heroImageUrl)}
                    />
                  </Field>

                  <Field
                    id="announcementText"
                    label="Bandeau d'annonce"
                    help={HELP.announcementText}
                    errorText={he.announcementText}
                  >
                    <Textarea
                      id="announcementText"
                      rows={2}
                      value={homeForm.data.announcementText}
                      onChange={(e) => homeForm.setData('announcementText', e.target.value)}
                      maxLength={280}
                      {...describedBy('announcementText', true, he.announcementText)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {homeForm.data.announcementText.length} / 280 caractères
                    </p>
                  </Field>
                </CardContent>
              </Card>
              <SubmitRow processing={homeForm.processing} label="Enregistrer la page d'accueil" />
            </form>
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
