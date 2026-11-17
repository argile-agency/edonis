import sanitizeHtml from 'sanitize-html'

// Teacher-authored HTML that a page injects with dangerouslySetInnerHTML:
// the library's default allow-list plus images. Scripts, event handlers and iframes are dropped.
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'] })
}
