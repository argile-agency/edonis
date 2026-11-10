import { Link } from '@inertiajs/react'
import { Mail, Facebook, Twitter, Linkedin, Github } from 'lucide-react'
import { isExternalUrl, isSafeLink } from '~/lib/safe_url'

interface FooterSettings {
  appName: string
  contactEmail?: string | null
  supportUrl?: string | null
  socialLinks?: Record<string, string | null> | null
}

interface MenuItem {
  id: number
  label: string
  url: string
}

interface Props {
  appSettings: FooterSettings | null
  menus: { footer: MenuItem[] }
}

const SOCIAL_LINKS = [
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'twitter', label: 'X', Icon: Twitter },
  { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { key: 'github', label: 'GitHub', Icon: Github },
] as const

/** Site footer: footer menu, contact block from the platform settings, copyright. */
export default function AppFooter({ appSettings, menus }: Props) {
  const appName = appSettings?.appName || 'Edonis LMS'
  const contactEmail = appSettings?.contactEmail?.trim()
  const supportUrl = isSafeLink(appSettings?.supportUrl) ? appSettings!.supportUrl : null
  // Defence in depth: the model consume parses socialLinks, but never iterate a raw JSON string.
  const socialSource = typeof appSettings?.socialLinks === 'object' ? appSettings.socialLinks : null
  const socials = SOCIAL_LINKS.flatMap((s) => {
    const url = socialSource?.[s.key]
    return isSafeLink(url) && url.startsWith('http') ? [{ ...s, url }] : []
  })
  const hasContact = Boolean(contactEmail || supportUrl || socials.length)

  return (
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
          {hasContact && (
            <div className="flex items-center gap-4">
              {contactEmail && (
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <a
                    href={'mailto:' + contactEmail}
                    className="text-sm text-muted-foreground hover:text-foreground transition"
                  >
                    {contactEmail}
                  </a>
                </span>
              )}
              {/* Plain anchor: a path may be a static file, which an Inertia visit cannot open. */}
              {supportUrl && (
                <a
                  href={supportUrl}
                  {...(isExternalUrl(supportUrl) && {
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  })}
                  className="text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Aide et support
                </a>
              )}
              {socials.map(({ key, label, Icon, url }) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${appName} sur ${label}`}
                  className="p-2 -m-2 text-muted-foreground hover:text-foreground transition"
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </a>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {appName}. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  )
}
