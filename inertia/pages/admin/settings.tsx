import { Head, router, useForm } from '@inertiajs/react'
import { FormEvent, ReactNode, useState } from 'react'
import { toast } from 'sonner'
import { House, KeyRound, LifeBuoy, Palette, Trash2 } from 'lucide-react'
import AppHeader from '~/components/layout/app-header'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'

type Tab = 'appearance' | 'home' | 'access' | 'contact' | 'trash'

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
  trashRetentionDays: number
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
function describedBy(id: string, hasHelp: boolean, error?: string, helpId = `${id}-help`) {
  const ids = [hasHelp && helpId, error && `${id}-error`].filter(Boolean).join(' ')
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
  allowRegistration:
    "Lorsque cette option est désactivée, les liens « Inscription » sont masqués et la page d'inscription renvoie vers la connexion. Les comptes existants ne sont pas affectés ; les administrateurs peuvent toujours créer des comptes.",
  contactEmail: 'Affichée dans le pied de page.',
  supportUrl:
    'Lien « Aide et support » du pied de page. Adresse complète commençant par https:// ou http://, ou chemin commençant par /.',
  trashRetentionDays:
    "Nombre de jours, entre 1 et 365, pendant lesquels les éléments supprimés restent dans la corbeille de chaque cours avant leur suppression définitive. Une baisse s'applique aussi aux éléments déjà dans la corbeille : ceux qui dépassent la nouvelle durée seront supprimés à la prochaine purge.",
}

const SOCIAL_FIELDS = [
  {
    key: 'facebook',
    id: 'social-facebook',
    label: 'Facebook',
    placeholder: 'https://facebook.com/…',
  },
  { key: 'twitter', id: 'social-twitter', label: 'X (Twitter)', placeholder: 'https://x.com/…' },
  {
    key: 'linkedin',
    id: 'social-linkedin',
    label: 'LinkedIn',
    placeholder: 'https://linkedin.com/company/…',
  },
  { key: 'github', id: 'social-github', label: 'GitHub', placeholder: 'https://github.com/…' },
] as const

export default function AdminSettings({ settings, activeTab, auth, appSettings, menus }: Props) {
  const [tab, setTabState] = useState<Tab>(activeTab)

  // Declared at page level: Radix unmounts inactive TabsContent, so edits survive a tab switch.
  // They do not survive a save: a successful save of any tab remounts the page and re-initialises
  // all five forms from server props, dropping unsaved edits in the other tabs (accepted, WR-03).
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
  const trashForm = useForm({
    trashRetentionDays: settings.trashRetentionDays as number | null,
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
    (form: { put: (url: string, options: object) => void }, target: Tab, fieldOrder: string[]) =>
    (e: FormEvent) => {
      e.preventDefault()
      form.put(`/admin/settings/${target}`, {
        // 'errors': keep state (tab, input) on validation failure; remount on success so
        // all five forms re-initialise from fresh props (other tabs' unsaved edits are lost)
        // and the flash toast fires again.
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
  // Nested keys (socialLinks.facebook, …) come back flat from VineJS.
  const ce = contactForm.errors as Record<string, string | undefined>
  return (
    <>
      <Head title="Réglages de la plateforme" />
      <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Réglages de la plateforme</h1>
          <p className="text-muted-foreground mt-1">
            Modifiez l'apparence, la page d'accueil, l'accès, les coordonnées et la corbeille de la
            plateforme. Chaque onglet s'enregistre séparément.
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
            <TabsTrigger value="trash" className="gap-2">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Corbeille
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

          {/* Accès */}
          <TabsContent value="access">
            <form noValidate onSubmit={submit(accessForm, 'access', ['allowRegistration'])}>
              <Card>
                <CardHeader>
                  <CardTitle>Accès</CardTitle>
                  <CardDescription>Qui peut créer un compte sur la plateforme.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="allowRegistration"
                        checked={accessForm.data.allowRegistration}
                        onCheckedChange={(checked) =>
                          accessForm.setData('allowRegistration', checked)
                        }
                        aria-invalid={!!accessForm.errors.allowRegistration}
                        aria-describedby={
                          accessForm.errors.allowRegistration
                            ? 'allowRegistration-help allowRegistration-error'
                            : 'allowRegistration-help'
                        }
                      />
                      <Label htmlFor="allowRegistration">Autoriser les inscriptions</Label>
                    </div>
                    <p id="allowRegistration-help" className="text-sm text-muted-foreground">
                      {HELP.allowRegistration}
                    </p>
                    {accessForm.errors.allowRegistration && (
                      <p id="allowRegistration-error" className="text-sm text-destructive">
                        {accessForm.errors.allowRegistration}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
              <SubmitRow
                processing={accessForm.processing}
                label="Enregistrer les règles d'accès"
              />
            </form>
          </TabsContent>

          {/* Contact et support */}
          <TabsContent value="contact">
            <form
              noValidate
              onSubmit={submit(contactForm, 'contact', [
                'contactEmail',
                'supportUrl',
                ...SOCIAL_FIELDS.map((s) => `socialLinks.${s.key}`),
              ])}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Contact et support</CardTitle>
                  <CardDescription>Coordonnées et liens affichés en pied de page.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Field
                    id="contactEmail"
                    label="Adresse de contact"
                    help={HELP.contactEmail}
                    errorText={ce.contactEmail}
                  >
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="contact@exemple.org"
                      value={contactForm.data.contactEmail}
                      onChange={(e) => contactForm.setData('contactEmail', e.target.value)}
                      maxLength={254}
                      {...describedBy('contactEmail', true, ce.contactEmail)}
                    />
                  </Field>

                  <Field
                    id="supportUrl"
                    label="Page d'aide ou de support"
                    help={HELP.supportUrl}
                    errorText={ce.supportUrl}
                  >
                    <Input
                      id="supportUrl"
                      type="url"
                      placeholder="https://aide.exemple.org"
                      value={contactForm.data.supportUrl}
                      onChange={(e) => contactForm.setData('supportUrl', e.target.value)}
                      maxLength={255}
                      {...describedBy('supportUrl', true, ce.supportUrl)}
                    />
                  </Field>

                  <div className="space-y-4">
                    <p id="social-help" className="text-sm text-muted-foreground">
                      Réseaux sociaux : adresse complète commençant par https://. Laissez vide pour
                      masquer l'icône.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {SOCIAL_FIELDS.map(({ key, id, label, placeholder }) => {
                        const error = ce[`socialLinks.${key}`]
                        return (
                          <Field key={key} id={id} label={label} errorText={error}>
                            <Input
                              id={id}
                              type="url"
                              placeholder={placeholder}
                              value={contactForm.data.socialLinks[key]}
                              onChange={(e) =>
                                contactForm.setData('socialLinks', {
                                  ...contactForm.data.socialLinks,
                                  [key]: e.target.value,
                                })
                              }
                              maxLength={255}
                              {...describedBy(id, true, error, 'social-help')}
                            />
                          </Field>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <SubmitRow processing={contactForm.processing} label="Enregistrer les coordonnées" />
            </form>
          </TabsContent>

          {/* Corbeille */}
          <TabsContent value="trash">
            <form noValidate onSubmit={submit(trashForm, 'trash', ['trashRetentionDays'])}>
              <Card>
                <CardHeader>
                  <CardTitle>Corbeille</CardTitle>
                  <CardDescription>
                    Durée de conservation des sections et contenus supprimés dans les cours.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Rendered label: « Durée de conservation (obligatoire) » */}
                  <Field
                    id="trashRetentionDays"
                    label="Durée de conservation"
                    required
                    help={HELP.trashRetentionDays}
                    errorText={trashForm.errors.trashRetentionDays}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        id="trashRetentionDays"
                        type="number"
                        inputMode="numeric"
                        className="w-24"
                        min={1}
                        max={365}
                        step={1}
                        value={trashForm.data.trashRetentionDays ?? ''}
                        onChange={(e) =>
                          trashForm.setData(
                            'trashRetentionDays',
                            e.target.value === '' ? null : Number(e.target.value)
                          )
                        }
                        required
                        aria-required="true"
                        {...describedBy(
                          'trashRetentionDays',
                          true,
                          trashForm.errors.trashRetentionDays
                        )}
                      />
                      <span className="text-sm text-muted-foreground">jours</span>
                    </div>
                  </Field>
                </CardContent>
              </Card>
              <SubmitRow
                processing={trashForm.processing}
                label="Enregistrer la durée de conservation"
              />
            </form>
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
