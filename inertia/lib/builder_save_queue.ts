import { useEffect, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { createSaveQueue, type SaveError, type SaveOp, type SaveQueueState } from './save_queue'

/** CSRF token from the XSRF-TOKEN cookie set by Shield, for fetch() calls */
export function xsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}

function saveError(
  kind: SaveError['kind'],
  status: number | null,
  message: string,
  body: unknown = null
): SaveError {
  return { kind, status, message, body }
}

/**
 * JSON request for builder saves. Resolves only on a 2xx JSON response; every
 * other outcome (CSRF redirect, expired session, HTML error page, network
 * failure) throws a SaveError, so it can never be mistaken for a saved change.
 */
export async function sendJson<T>(
  method: 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: unknown
): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      // Shield answers a CSRF failure with a 302: never follow it to a 200 HTML page.
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-XSRF-TOKEN': xsrfToken(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw saveError('error', null, 'Connexion perdue.')
  }

  if (res.type === 'opaqueredirect') {
    throw saveError(
      'session',
      null,
      'Session expirée ou jeton de sécurité invalide : rechargez la page.'
    )
  }

  const isJson = (res.headers.get('content-type') ?? '').includes('application/json')
  let data: any = null
  if (isJson) {
    try {
      data = await res.json()
    } catch {
      throw saveError('error', res.status, `Erreur du serveur (${res.status}).`)
    }
  }

  if (res.status === 401) {
    throw saveError(
      'session',
      401,
      'Session expirée ou jeton de sécurité invalide : rechargez la page.',
      data
    )
  }
  if (res.status === 403) throw saveError('forbidden', 403, 'Action non autorisée.', data)
  if (res.status === 409) {
    throw saveError('conflict', 409, data?.message ?? 'Conflit de modification.', data)
  }
  if (res.status === 422) {
    const message = data?.message ?? data?.errors?.[0]?.message ?? 'Données invalides.'
    throw saveError('validation', 422, message, data)
  }
  if (!res.ok || !isJson) {
    throw saveError('error', res.status, `Erreur du serveur (${res.status}).`, data)
  }
  return data as T
}

const LEAVE_PROMPT = 'Des modifications sont en cours d’enregistrement. Quitter quand même ?'

/**
 * React wrapper around the serial save queue. While saves are pending it
 * guards against leaving the page: browser unload, and Inertia GET visits to
 * another URL (posts and same-URL reloads are let through).
 */
export function useSaveQueue(): SaveQueueState & {
  enqueue(op: SaveOp): void
  retry(): void
  dismiss(): void
} {
  const [state, setState] = useState<SaveQueueState>({
    status: 'idle',
    error: null,
    pending: 0,
    failedCount: 0,
  })
  const queueRef = useRef<ReturnType<typeof createSaveQueue> | null>(null)
  if (!queueRef.current) queueRef.current = createSaveQueue(setState)
  const queue = queueRef.current

  const busy = state.pending > 0
  useEffect(() => {
    if (!busy) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    // Inertia 2.3.29: returning false from a 'before' listener calls preventDefault() and cancels the visit.
    const removeBefore = router.on('before', (event) => {
      const { method, url, prefetch } = event.detail.visit
      // router.prefetch() (Link hover) also fires 'before': never prompt for it.
      if (method !== 'get' || prefetch) return
      if (url.pathname + url.search === window.location.pathname + window.location.search) return
      if (!window.confirm(LEAVE_PROMPT)) return false
    })

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      removeBefore()
    }
  }, [busy])

  return { ...state, enqueue: queue.enqueue, retry: queue.retry, dismiss: queue.dismiss }
}
