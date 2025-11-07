import { Head, Link, router } from '@inertiajs/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Search, UserPlus } from 'lucide-react'

interface Role {
  id: number
  name: string
  slug: string
}

interface User {
  id: number
  fullName: string | null
  email: string
  studentId: string | null
  department: string | null
  isActive: boolean
  createdAt: string
  roles: Role[]
}

interface PaginationMeta {
  total: number
  perPage: number
  currentPage: number
  lastPage: number
  firstPage: number
  firstPageUrl: string
  lastPageUrl: string
  nextPageUrl: string | null
  previousPageUrl: string | null
}

interface Props {
  users: {
    meta: PaginationMeta
    data: User[]
  }
}

export default function UsersIndex({ users }: Props) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.get(
      '/admin/users',
      { search, role: roleFilter, status: statusFilter },
      { preserveState: true }
    )
  }

  const handleDelete = (userId: number) => {
    if (confirm('Êtes-vous sûr de vouloir désactiver cet utilisateur ?')) {
      router.delete(`/admin/users/${userId}`)
    }
  }

  const handleActivate = (userId: number) => {
    router.post(`/admin/users/${userId}/activate`)
  }

  return (
    <>
      <Head title="Gestion des utilisateurs" />

      <div className="min-h-screen bg-background py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Gestion des utilisateurs</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Gérez les utilisateurs et leurs rôles dans le système
            </p>
          </div>

          {/* Actions et filtres */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Recherche et filtres</CardTitle>
              <CardDescription>Trouvez et filtrez les utilisateurs</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
                {/* Recherche */}
                <div className="flex-1 space-y-2">
                  <Label htmlFor="search">Rechercher</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      id="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Nom, email ou matricule..."
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Filtre par rôle */}
                <div className="flex-1 space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                  <Select
                    value={roleFilter || 'all'}
                    onValueChange={(value) => setRoleFilter(value === 'all' ? '' : value)}
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Tous les rôles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les rôles</SelectItem>
                      <SelectItem value="admin">Administrateur</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="teacher">Enseignant</SelectItem>
                      <SelectItem value="student">Étudiant</SelectItem>
                      <SelectItem value="guest">Invité</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtre par statut */}
                <div className="flex-1 space-y-2">
                  <Label htmlFor="status">Statut</Label>
                  <Select
                    value={statusFilter || 'all'}
                    onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Boutons d'action */}
                <div className="flex gap-2">
                  <Button type="submit">Filtrer</Button>
                  <Link href="/admin/users/create">
                    <Button variant="default" className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Nouveau
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Table des utilisateurs */}
          <Card>
            <CardHeader>
              <CardTitle>Utilisateurs</CardTitle>
              <CardDescription>
                {users.meta.total} utilisateur{users.meta.total > 1 ? 's' : ''} trouvé
                {users.meta.total > 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Rôles</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date création</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.data.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {user.fullName?.charAt(0)?.toUpperCase() ||
                                user.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.fullName || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.studentId || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Badge key={role.id} variant="secondary">
                              {role.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'destructive'}>
                          {user.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Link href={`/admin/users/${user.id}`}>
                            <Button variant="ghost" size="sm">
                              Voir
                            </Button>
                          </Link>
                          <Link href={`/admin/users/${user.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              Éditer
                            </Button>
                          </Link>
                          {user.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(user.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              Désactiver
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleActivate(user.id)}
                              className="text-green-600 hover:text-green-600"
                            >
                              Activer
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {users.meta.lastPage > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Affichage de{' '}
                    <span className="font-medium">
                      {(users.meta.currentPage - 1) * users.meta.perPage + 1}
                    </span>{' '}
                    à{' '}
                    <span className="font-medium">
                      {Math.min(users.meta.currentPage * users.meta.perPage, users.meta.total)}
                    </span>{' '}
                    sur <span className="font-medium">{users.meta.total}</span> résultats
                  </div>
                  <div className="flex gap-2">
                    {users.meta.previousPageUrl && (
                      <Link href={users.meta.previousPageUrl}>
                        <Button variant="outline" size="sm">
                          Précédent
                        </Button>
                      </Link>
                    )}
                    {users.meta.nextPageUrl && (
                      <Link href={users.meta.nextPageUrl}>
                        <Button variant="outline" size="sm">
                          Suivant
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
