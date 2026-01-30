import { usePage } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface FlashData {
  success?: string
  error?: string
}

/**
 * Listens to Inertia flash messages and triggers sonner toasts.
 * Includes an aria-live region for screen reader announcements.
 * Must be rendered INSIDE the Inertia <App> tree (i.e., inside a page or layout).
 */
export function FlashMessages() {
  const { flash } = usePage<{ flash: FlashData }>().props
  const [liveMessage, setLiveMessage] = useState('')

  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success)
      setLiveMessage(flash.success)
    }
    if (flash?.error) {
      toast.error(flash.error)
      setLiveMessage(flash.error)
    }
  }, [flash?.success, flash?.error])

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {liveMessage}
    </div>
  )
}
