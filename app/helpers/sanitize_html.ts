import sanitizeHtml from 'sanitize-html'

const LENGTH = String.raw`\d{1,3}(?:\.\d+)?(?:px|em|rem|%)`
const COLOR = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/,
  /^[a-z]+$/i,
]
const SIZE = [new RegExp(`^${LENGTH}$`), /^auto$/]
// One to four non-negative lengths: negative margins could slide content over the interface
const BOX = [new RegExp(`^(?:(?:${LENGTH}|0|auto)\\s*){1,4}$`)]
const SIDES = ['', '-top', '-right', '-bottom', '-left']

// Typography and spacing only. Anything that takes content out of the flow or loads a resource
// (position, z-index, display, transform, url()) stays out: it would let a page cover the interface.
const STYLES: Record<string, RegExp[]> = {
  'color': COLOR,
  'background-color': COLOR,
  'text-align': [/^(?:left|right|center|justify)$/],
  'font-size': [new RegExp(`^${LENGTH}$`)],
  'font-weight': [/^(?:normal|bold|[1-9]00)$/],
  'font-style': [/^(?:normal|italic)$/],
  'text-decoration': [/^(?:none|underline|line-through)$/],
  'line-height': [/^\d(?:\.\d+)?$/, new RegExp(`^${LENGTH}$`)],
  'width': SIZE,
  'max-width': SIZE,
  'height': SIZE,
  'border': [/^\d{1,2}px (?:solid|dashed|dotted) (?:#[0-9a-f]{3,8}|[a-z]+)$/i],
  ...Object.fromEntries(SIDES.flatMap((s) => [`margin${s}`, `padding${s}`]).map((p) => [p, BOX])),
}

// Teacher-authored HTML that a page injects with dangerouslySetInnerHTML: the library's default
// allow-list plus images and the inline styles above. Scripts, event handlers, iframes and
// class (the app's own utility classes include fixed/inset-0/z-50) are dropped.
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['style', 'title', 'lang', 'dir'],
      'a': ['href', 'name', 'target', 'rel'],
      'td': ['colspan', 'rowspan'],
      'th': ['colspan', 'rowspan', 'scope'],
    },
    allowedStyles: { '*': STYLES },
  })
}
