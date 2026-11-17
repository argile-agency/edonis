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

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'www.youtube-nocookie.com',
  'youtu.be',
])

// Embed URL for a YouTube link, or null. The host is compared exactly: a substring test
// also accepts https://evil.example/youtube.com. Privacy-enhanced host, the only one CSP frameSrc allows.
export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  if (!isExternalUrl(url)) return null
  const { hostname, pathname, searchParams } = new URL(url)
  if (!YOUTUBE_HOSTS.has(hostname)) return null
  const id =
    hostname === 'youtu.be'
      ? pathname.slice(1)
      : (searchParams.get('v') ?? pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1])
  return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
}
