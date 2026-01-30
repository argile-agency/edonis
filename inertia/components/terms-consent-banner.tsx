import { usePage, router, Link } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { FileText } from 'lucide-react'

export function TermsConsentBanner() {
  const { termsConsentRequired } = usePage<{ termsConsentRequired: boolean }>().props

  if (!termsConsentRequired) return null

  const handleAccept = () => {
    router.post('/user/account/accept-terms', {}, { preserveScroll: true })
  }

  return (
    <div role="alert" className="border-b bg-warning/10 px-4 py-3">
      <div className="container mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm">
            Nos conditions d'utilisation ont été mises à jour.{' '}
            <Link href="/privacy" className="font-medium underline hover:no-underline">
              Consulter les modifications
            </Link>
          </p>
        </div>
        <Button size="sm" onClick={handleAccept}>
          J'accepte les nouvelles conditions
        </Button>
      </div>
    </div>
  )
}
