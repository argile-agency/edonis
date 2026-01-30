export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <p className="font-heading text-7xl font-bold text-primary leading-none mb-4">404</p>
        <h1 className="font-heading text-2xl font-semibold text-foreground mb-3">
          Page introuvable
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          La page que vous recherchez n'existe pas ou a été déplacée.
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
  )
}
