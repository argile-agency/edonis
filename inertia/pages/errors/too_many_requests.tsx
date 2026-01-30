import { Head } from '@inertiajs/react'
import { Clock } from 'lucide-react'

interface Props {
  error: any
  retryAfter?: number
}

export default function TooManyRequests({ retryAfter }: Props) {
  return (
    <>
      <Head title="Trop de tentatives" />
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
            <Clock className="h-8 w-8 text-warning" />
          </div>
          <p className="font-heading text-7xl font-bold text-primary leading-none mb-4">429</p>
          <h1 className="font-heading text-2xl font-semibold text-foreground mb-3">
            Trop de tentatives
          </h1>
          <p className="text-muted-foreground leading-relaxed mb-8">
            Vous avez effectué trop de requêtes en peu de temps. Veuillez patienter
            {retryAfter ? ` ${Math.ceil(retryAfter / 60)} minute(s)` : ' quelques instants'} avant
            de réessayer.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a
              href="/"
              className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 btn-press"
            >
              Retour à l'accueil
            </a>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 btn-press"
            >
              Page précédente
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
