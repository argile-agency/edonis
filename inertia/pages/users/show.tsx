import { Head, Link } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { ArrowLeft, Edit, UserX, UserCheck } from 'lucide-react'

interface Role {
  id: number
  name: string
  slug: string
}

interface User {
  id: number
  fullName: string | null
  email: string
  avatarUrl: string | null
  bio: string | null
  phone: string | null
  studentId: string | null
  department: string | null
  organization: string | null
  locale: string
  timezone: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  roles: Role[]
}

interface UserRole {
  id: number
  userId: number
  roleId: number
  courseId: number | null
  createdAt: string
  role: Role
}

interface Props {
  user: User
  userRoles: UserRole[]
}

export default function UsersShow({ user, userRoles }: Props) {
  return (
    <>
      <Head title={`${user.fullName || user.email}`} />

      <div className="min-h-screen bg-background py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/admin/users">
              <Button variant="ghost" className="mb-4 gap-2">
                <ArrowLeft className="h-4 w-4" />
                Retour à la liste
              </Button>
            </Link>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={user.fullName || user.email} />
                  )}
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {user.fullName?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-3xl font-bold">{user.fullName || 'Utilisateur sans nom'}</h1>
                  <p className="text-muted-foreground">{user.email}</p>
                  <div className="mt-2">
                    <Badge variant={user.isActive ? 'default' : 'destructive'}>
                      {user.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </div>
              </div>
              <Link href={`/admin/users/${user.id}/edit`}>
                <Button className="gap-2">
                  <Edit className="h-4 w-4" />
                  Éditer
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne principale */}
            <div className="lg:col-span-2 space-y-6">
              {/* Informations personnelles */}
              <Card>
                <CardHeader>
                  <CardTitle>Informations personnelles</CardTitle>
                  <CardDescription>Détails du profil utilisateur</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Nom complet</dt>
                      <dd className="mt-1 text-sm">{user.fullName || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                      <dd className="mt-1 text-sm">{user.email}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Téléphone</dt>
                      <dd className="mt-1 text-sm">{user.phone || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Matricule</dt>
                      <dd className="mt-1 text-sm">{user.studentId || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Département</dt>
                      <dd className="mt-1 text-sm">{user.department || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Organisation</dt>
                      <dd className="mt-1 text-sm">{user.organization || 'N/A'}</dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="text-sm font-medium text-muted-foreground">Biographie</dt>
                      <dd className="mt-1 text-sm whitespace-pre-wrap">
                        {user.bio || 'Aucune biographie'}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Préférences */}
              <Card>
                <CardHeader>
                  <CardTitle>Préférences</CardTitle>
                  <CardDescription>Paramètres de langue et fuseau horaire</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Langue</dt>
                      <dd className="mt-1 text-sm">
                        {user.locale === 'fr' ? 'Français' : 'English'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Fuseau horaire</dt>
                      <dd className="mt-1 text-sm">{user.timezone}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Activité */}
              <Card>
                <CardHeader>
                  <CardTitle>Activité</CardTitle>
                  <CardDescription>Historique de connexion et modifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">
                        Dernière connexion
                      </dt>
                      <dd className="mt-1 text-sm">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleString('fr-FR')
                          : 'Jamais connecté'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">
                        Date de création
                      </dt>
                      <dd className="mt-1 text-sm">
                        {new Date(user.createdAt).toLocaleString('fr-FR')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">
                        Dernière modification
                      </dt>
                      <dd className="mt-1 text-sm">
                        {new Date(user.updatedAt).toLocaleString('fr-FR')}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>

            {/* Colonne latérale */}
            <div className="space-y-6">
              {/* Rôles globaux */}
              <Card>
                <CardHeader>
                  <CardTitle>Rôles globaux</CardTitle>
                  <CardDescription>Rôles système de l'utilisateur</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {userRoles.filter((ur) => !ur.courseId).length > 0 ? (
                      userRoles
                        .filter((ur) => !ur.courseId)
                        .map((userRole) => (
                          <div
                            key={userRole.id}
                            className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border"
                          >
                            <div>
                              <p className="text-sm font-medium">{userRole.role.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Assigné le{' '}
                                {new Date(userRole.createdAt).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <Badge variant="secondary">{userRole.role.slug}</Badge>
                          </div>
                        ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucun rôle global assigné</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Rôles contextuels (par cours) */}
              {userRoles.filter((ur) => ur.courseId).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Rôles par cours</CardTitle>
                    <CardDescription>Rôles spécifiques à certains cours</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {userRoles
                        .filter((ur) => ur.courseId)
                        .map((userRole) => (
                          <div
                            key={userRole.id}
                            className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border"
                          >
                            <div>
                              <p className="text-sm font-medium">{userRole.role.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Cours ID: {userRole.courseId}
                              </p>
                            </div>
                            <Badge variant="secondary">{userRole.role.slug}</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions rapides */}
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                  <CardDescription>Gérer le compte utilisateur</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href={`/admin/users/${user.id}/edit`}>
                    <Button className="w-full gap-2" variant="default">
                      <Edit className="h-4 w-4" />
                      Éditer l'utilisateur
                    </Button>
                  </Link>
                  {user.isActive ? (
                    <Button
                      variant="destructive"
                      className="w-full gap-2"
                      onClick={() => {
                        if (confirm('Êtes-vous sûr de vouloir désactiver cet utilisateur ?')) {
                          // Handle deactivation
                        }
                      }}
                    >
                      <UserX className="h-4 w-4" />
                      Désactiver le compte
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      className="w-full gap-2"
                      onClick={() => {
                        // Handle activation
                      }}
                    >
                      <UserCheck className="h-4 w-4" />
                      Activer le compte
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
