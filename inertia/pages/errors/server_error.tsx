interface ServerErrorProps {
  error: any
  debug?: boolean
}

export default function ServerError({ error, debug }: ServerErrorProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center max-w-lg w-full">
        <p className="font-heading text-7xl font-bold text-primary leading-none mb-4">
          {error?.status ?? 500}
        </p>
        <h1 className="font-heading text-2xl font-semibold text-foreground mb-3">
          Service temporairement indisponible
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Le service rencontre un problème temporaire. Veuillez réessayer dans quelques instants.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <a
            href="/"
            className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 btn-press"
          >
            Retour à l'accueil
          </a>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 btn-press"
          >
            Réessayer
          </button>
        </div>

        {debug && error && (
          <details className="mt-8 text-left rounded-lg border border-warning overflow-hidden">
            <summary className="px-4 py-3 font-semibold text-sm cursor-pointer bg-warning/10 text-warning-foreground">
              Détails de l'erreur (debug)
            </summary>
            <div className="p-4 text-sm space-y-3 bg-warning/10">
              {error.name && (
                <div>
                  <p className="font-semibold text-warning-foreground mb-1">Type</p>
                  <pre className="bg-background border border-border rounded-md p-2.5 overflow-x-auto whitespace-pre-wrap break-all text-xs font-mono text-foreground leading-relaxed">
                    {error.name}
                  </pre>
                </div>
              )}
              {error.message && (
                <div>
                  <p className="font-semibold text-warning-foreground mb-1">Message</p>
                  <pre className="bg-background border border-border rounded-md p-2.5 overflow-x-auto whitespace-pre-wrap break-all text-xs font-mono text-foreground leading-relaxed">
                    {error.message}
                  </pre>
                </div>
              )}
              {error.stack && (
                <div>
                  <p className="font-semibold text-warning-foreground mb-1">Stack trace</p>
                  <pre className="bg-background border border-border rounded-md p-2.5 overflow-x-auto whitespace-pre-wrap break-all text-xs font-mono text-foreground leading-relaxed">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
