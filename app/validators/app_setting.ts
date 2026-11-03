import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import type { FieldContext } from '@vinejs/vine/types'

/**
 * Admin platform settings (/admin/settings): one validator per tab (D-11).
 * Fields not listed here (headerHtml, isActive, ...) are dropped by VineJS (D-10).
 * Every validator needs `{ meta: { appHost: request.host() ?? '' } }`.
 */
export const SETTINGS_TABS = ['appearance', 'home', 'access', 'contact'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

export const COLOR_MESSAGE = 'Saisissez une couleur au format #RRGGBB (ex. #5046E5).'
export const LINK_URL_MESSAGE = 'Saisissez une adresse commençant par https:// ou http://.'
export const IMAGE_URL_MESSAGE =
  "Saisissez un chemin commençant par / ou une adresse de ce site. Les images d'un autre domaine sont bloquées."

// Root-relative path; refuses `//host` and `/\host` (protocol-relative in browsers),
// whitespace and control characters.
// eslint-disable-next-line no-control-regex
const ROOT_PATH = /^\/(?![/\\])[^\s\u0000-\u001f\u007f]*$/

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** Images: root-relative path or same-host absolute URL (CSP imgSrc stays 'self', D-15). */
const imageUrl = vine.createRule((value: unknown, _options: undefined, field: FieldContext) => {
  if (typeof value !== 'string') return
  if (ROOT_PATH.test(value)) return
  const url = parseHttpUrl(value)
  if (url && url.host === field.meta.appHost) return
  field.report(IMAGE_URL_MESSAGE, 'imageUrl', field)
})

/** Links: http(s) absolute URL only (no javascript:, data:, mailto:), plus paths when allowed. */
const linkUrl = vine.createRule(
  (value: unknown, options: { allowPath: boolean }, field: FieldContext) => {
    if (typeof value !== 'string') return
    if (options.allowPath && ROOT_PATH.test(value)) return
    if (parseHttpUrl(value)) return
    field.report(LINK_URL_MESSAGE, 'linkUrl', field)
  }
)

const messagesProvider = new SimpleMessagesProvider({
  'required': 'Ce champ est obligatoire.',
  'maxLength': 'Ce champ ne doit pas dépasser {{ max }} caractères.',
  'primaryColor.regex': COLOR_MESSAGE,
  'email': 'Saisissez une adresse e-mail valide (ex. contact@exemple.org).',
  'linkUrl': LINK_URL_MESSAGE,
  'imageUrl': IMAGE_URL_MESSAGE,
  'boolean': 'Valeur invalide.',
})

const compile = vine.withMetaData<{ appHost: string }>().compile

const optionalImage = () =>
  vine.string().trim().maxLength(255).use(imageUrl()).optional().nullable()
const optionalSocial = () =>
  vine
    .string()
    .trim()
    .maxLength(255)
    .use(linkUrl({ allowPath: false }))
    .optional()
    .nullable()

const appearance = compile(
  vine.object({
    appName: vine.string().trim().maxLength(100),
    appLogoUrl: optionalImage(),
    appFaviconUrl: optionalImage(),
    primaryColor: vine
      .string()
      .trim()
      .regex(/^#[0-9a-f]{6}$/i)
      .toUpperCase(),
  })
)

const home = compile(
  vine.object({
    heroTitle: vine.string().trim().maxLength(150),
    heroSubtitle: vine.string().trim().maxLength(300).optional().nullable(),
    heroImageUrl: optionalImage(),
    announcementText: vine.string().trim().maxLength(280).optional().nullable(),
  })
)

const access = compile(
  vine.object({
    allowRegistration: vine.boolean(),
  })
)

const contact = compile(
  vine.object({
    contactEmail: vine.string().trim().maxLength(254).email().optional().nullable(),
    supportUrl: vine
      .string()
      .trim()
      .maxLength(255)
      .use(linkUrl({ allowPath: true }))
      .optional()
      .nullable(),
    socialLinks: vine
      .object({
        facebook: optionalSocial(),
        twitter: optionalSocial(),
        linkedin: optionalSocial(),
        github: optionalSocial(),
      })
      .optional()
      .nullable(),
  })
)

for (const validator of [appearance, home, access, contact]) {
  validator.messagesProvider = messagesProvider
}

export const appSettingValidators = { appearance, home, access, contact } satisfies Record<
  SettingsTab,
  unknown
>
