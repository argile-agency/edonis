// Render guards for admin-set URLs (legacy rows never passed the validator). Pure, SSR-safe.

// Root-relative path: one leading slash, not followed by / or \ (protocol-relative), no spaces or control chars.
// eslint-disable-next-line no-control-regex
const ROOT_RELATIVE = /^\/(?![/\\])[^\s\u0000-\u001f\u007f]*$/

export function isExternalUrl(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    // No base: '//host' and relative paths throw instead of resolving.
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function isSafeLink(url: string | null | undefined): url is string {
  return !!url && (ROOT_RELATIVE.test(url) || isExternalUrl(url))
}

// CSP imgSrc is the backstop for foreign hosts; same-origin cannot be checked during SSR.
export function isSafeImageSrc(url: string | null | undefined): url is string {
  return isSafeLink(url)
}
