import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { ChevronLeft, Heart, Users, Target, Lightbulb } from 'lucide-react'

export default function About() {
  return (
    <>
      <Head title="À propos" />

      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">À propos d'Edonis LMS</h1>
            <p className="text-xl text-muted-foreground">
              Une plateforme d'apprentissage moderne et open-source
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle>Notre Mission</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Edonis LMS est né de la conviction que l'éducation en ligne doit être accessible,
                moderne et efficace. Notre mission est de fournir une plateforme d'apprentissage de
                qualité professionnelle qui répond aux besoins des institutions éducatives, des
                entreprises et des formateurs indépendants.
              </p>
              <p className="text-muted-foreground">
                Nous croyons en la puissance de l'open-source pour démocratiser l'accès à des outils
                d'apprentissage de haute qualité, tout en offrant la flexibilité nécessaire pour
                s'adapter aux besoins uniques de chaque organisation.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                <CardTitle>Nos Valeurs</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="font-semibold">Innovation</h3>
                  <p className="text-sm text-muted-foreground">
                    Nous intégrons les dernières technologies, y compris l'intelligence
                    artificielle, pour améliorer l'expérience d'apprentissage.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">Accessibilité</h3>
                  <p className="text-sm text-muted-foreground">
                    Une interface moderne et intuitive, accessible sur tous les appareils, pour
                    apprendre n'importe où, n'importe quand.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">Qualité</h3>
                  <p className="text-sm text-muted-foreground">
                    Un code TypeScript robuste, une architecture moderne et des tests complets pour
                    garantir la fiabilité.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">Communauté</h3>
                  <p className="text-sm text-muted-foreground">
                    Open-source sous licence Apache 2.0, nous encourageons la collaboration et les
                    contributions de la communauté.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Pour Qui ?</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Institutions Éducatives</h3>
                  <p className="text-sm text-muted-foreground">
                    Écoles, universités et centres de formation qui recherchent une solution
                    complète pour gérer leurs cours en ligne et hybrides.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Entreprises</h3>
                  <p className="text-sm text-muted-foreground">
                    Organisations qui souhaitent former leurs employés avec une plateforme moderne
                    et personnalisable.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Formateurs Indépendants</h3>
                  <p className="text-sm text-muted-foreground">
                    Experts et consultants qui veulent créer et vendre leurs formations en ligne
                    avec une solution professionnelle.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                <CardTitle>Technologies</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Edonis LMS est construit avec les technologies web les plus modernes :
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm">AdonisJS 6 (Backend TypeScript)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm">React 19 (Frontend)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm">Inertia.js (SPA sans API)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm">PostgreSQL (Base de données)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm">Tailwind CSS v4 (Styling)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm">TypeScript (Type Safety)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center pt-6">
            <p className="text-muted-foreground mb-4">
              Prêt à commencer votre parcours d'apprentissage ?
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/register">
                <Button size="lg">Créer un compte</Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" size="lg">
                  Nous contacter
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
