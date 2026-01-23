import { Head, Link } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { ChevronLeft, Shield, Lock, Eye, Database, UserCheck, Globe } from 'lucide-react'

export default function Privacy() {
  return (
    <>
      <Head title="Politique de confidentialité" />

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
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-4">Politique de confidentialité</h1>
            <p className="text-muted-foreground">
              Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <CardTitle>Introduction</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Edonis LMS s'engage à protéger la vie privée de ses utilisateurs. Cette politique de
                confidentialité décrit comment nous collectons, utilisons et protégeons vos
                informations personnelles lorsque vous utilisez notre plateforme d'apprentissage en
                ligne.
              </p>
              <p className="text-muted-foreground">
                En utilisant Edonis LMS, vous acceptez les pratiques décrites dans cette politique
                de confidentialité.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle>Informations que nous collectons</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Informations de compte</h3>
                <p className="text-sm text-muted-foreground">
                  Lorsque vous créez un compte, nous collectons votre nom, adresse e-mail, et
                  d'autres informations de profil que vous choisissez de fournir.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Données d'apprentissage</h3>
                <p className="text-sm text-muted-foreground">
                  Nous collectons des informations sur votre progression dans les cours, vos
                  résultats aux évaluations, et votre interaction avec le contenu pédagogique.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Informations techniques</h3>
                <p className="text-sm text-muted-foreground">
                  Nous collectons automatiquement certaines informations techniques telles que votre
                  adresse IP, type de navigateur, système d'exploitation, et données d'utilisation
                  de la plateforme.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                <CardTitle>Comment nous utilisons vos informations</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                  <span className="text-sm text-muted-foreground">
                    Fournir et améliorer nos services d'apprentissage en ligne
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                  <span className="text-sm text-muted-foreground">
                    Personnaliser votre expérience d'apprentissage et recommander du contenu
                    pertinent
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                  <span className="text-sm text-muted-foreground">
                    Communiquer avec vous concernant votre compte et les cours auxquels vous êtes
                    inscrit
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                  <span className="text-sm text-muted-foreground">
                    Analyser l'utilisation de la plateforme pour améliorer nos fonctionnalités
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                  <span className="text-sm text-muted-foreground">
                    Assurer la sécurité et prévenir les fraudes
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <CardTitle>Protection de vos données</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles
                appropriées pour protéger vos informations personnelles contre tout accès non
                autorisé, modification, divulgation ou destruction.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>Chiffrement SSL/TLS</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>Stockage sécurisé des données</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>Accès restreint aux données</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>Audits de sécurité réguliers</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle>Partage de vos informations</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Nous ne vendons pas vos informations personnelles. Nous pouvons partager vos
                informations dans les circonstances suivantes :
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                  <span className="text-sm text-muted-foreground">
                    Avec les instructeurs des cours auxquels vous êtes inscrit
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                  <span className="text-sm text-muted-foreground">
                    Avec votre institution éducative si vous utilisez Edonis LMS dans ce cadre
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                  <span className="text-sm text-muted-foreground">
                    Avec des prestataires de services qui nous aident à opérer la plateforme
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                  <span className="text-sm text-muted-foreground">
                    Si requis par la loi ou pour protéger nos droits légaux
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vos droits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Conformément au RGPD et aux lois applicables sur la protection des données, vous
                avez les droits suivants :
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">Droit d'accès</h4>
                  <p className="text-xs text-muted-foreground">
                    Accéder à vos données personnelles
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">Droit de rectification</h4>
                  <p className="text-xs text-muted-foreground">Corriger vos données inexactes</p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">Droit à l'effacement</h4>
                  <p className="text-xs text-muted-foreground">Supprimer vos données</p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">Droit à la portabilité</h4>
                  <p className="text-xs text-muted-foreground">Exporter vos données</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cookies et technologies similaires</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Nous utilisons des cookies et des technologies similaires pour améliorer votre
                expérience, analyser l'utilisation de la plateforme et personnaliser le contenu.
                Vous pouvez contrôler l'utilisation des cookies via les paramètres de votre
                navigateur.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modifications de cette politique</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Nous pouvons mettre à jour cette politique de confidentialité de temps à autre. Nous
                vous informerons de tout changement important en publiant la nouvelle politique sur
                cette page et en mettant à jour la date de "dernière mise à jour".
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nous contacter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Si vous avez des questions concernant cette politique de confidentialité ou nos
                pratiques en matière de données, veuillez nous contacter :
              </p>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Email :</strong> privacy@edonis.example.com
                </p>
                <p className="text-sm">
                  <strong>Adresse :</strong> Paris, France
                </p>
              </div>
              <div className="pt-4">
                <Link href="/contact">
                  <Button>Formulaire de contact</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
