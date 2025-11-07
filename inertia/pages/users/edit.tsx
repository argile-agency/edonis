import { Head, Link, useForm } from '@inertiajs/react'
import { FormEvent } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { ArrowLeft } from 'lucide-react'

interface Role {
  id: number
  name: string
  slug: string
  description: string
}

interface User {
  id: number
  fullName: string
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
  roleIds: number[]
}

interface Props {
  user: User
  roles: Role[]
}

export default function UsersEdit({ user, roles }: Props) {
  const { data, setData, put, processing, errors } = useForm({
    fullName: user.fullName || '',
    email: user.email || '',
    password: '',
    avatarUrl: user.avatarUrl || '',
    bio: user.bio || '',
    phone: user.phone || '',
    studentId: user.studentId || '',
    department: user.department || '',
    organization: user.organization || '',
    locale: user.locale || 'fr',
    timezone: user.timezone || 'Europe/Paris',
    isActive: user.isActive,
    roleIds: user.roleIds || [],
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    put(`/admin/users/${user.id}`)
  }

  const toggleRole = (roleId: number) => {
    if (data.roleIds.includes(roleId)) {
      setData(
        'roleIds',
        data.roleIds.filter((id) => id !== roleId)
      )
    } else {
      setData('roleIds', [...data.roleIds, roleId])
    }
  }

  return (
    <>
      <Head title={`Éditer ${user.fullName}`} />

      <div className="min-h-screen bg-background py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/admin/users">
              <Button variant="ghost" className="mb-4 gap-2">
                <ArrowLeft className="h-4 w-4" />
                Retour à la liste
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Éditer l'utilisateur : {user.fullName}</h1>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informations de base */}
            <Card>
              <CardHeader>
                <CardTitle>Informations de base</CardTitle>
                <CardDescription>Les informations essentielles de l'utilisateur</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nom complet *</Label>
                    <Input
                      type="text"
                      id="fullName"
                      value={data.fullName}
                      onChange={(e) => setData('fullName', e.target.value)}
                    />
                    {errors.fullName && (
                      <p className="text-sm text-destructive">{errors.fullName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      type="email"
                      id="email"
                      value={data.email}
                      onChange={(e) => setData('email', e.target.value)}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="password">
                      Nouveau mot de passe (laisser vide pour ne pas changer)
                    </Label>
                    <Input
                      type="password"
                      id="password"
                      value={data.password}
                      onChange={(e) => setData('password', e.target.value)}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      type="tel"
                      id="phone"
                      value={data.phone}
                      onChange={(e) => setData('phone', e.target.value)}
                    />
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informations académiques */}
            <Card>
              <CardHeader>
                <CardTitle>Informations académiques</CardTitle>
                <CardDescription>Matricule, département et organisation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="studentId">Matricule</Label>
                    <Input
                      type="text"
                      id="studentId"
                      value={data.studentId}
                      onChange={(e) => setData('studentId', e.target.value)}
                    />
                    {errors.studentId && (
                      <p className="text-sm text-destructive">{errors.studentId}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Département</Label>
                    <Input
                      type="text"
                      id="department"
                      value={data.department}
                      onChange={(e) => setData('department', e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="organization">Organisation</Label>
                    <Input
                      type="text"
                      id="organization"
                      value={data.organization}
                      onChange={(e) => setData('organization', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bio et avatar */}
            <Card>
              <CardHeader>
                <CardTitle>Profil</CardTitle>
                <CardDescription>Avatar et biographie de l'utilisateur</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="avatarUrl">URL de l'avatar</Label>
                  <Input
                    type="url"
                    id="avatarUrl"
                    value={data.avatarUrl}
                    onChange={(e) => setData('avatarUrl', e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Biographie</Label>
                  <Textarea
                    id="bio"
                    rows={4}
                    value={data.bio}
                    onChange={(e) => setData('bio', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Rôles */}
            <Card>
              <CardHeader>
                <CardTitle>Rôles</CardTitle>
                <CardDescription>Gérez les rôles de l'utilisateur</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-start space-x-3">
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={data.roleIds.includes(role.id)}
                      onCheckedChange={() => toggleRole(role.id)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor={`role-${role.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {role.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Préférences */}
            <Card>
              <CardHeader>
                <CardTitle>Préférences</CardTitle>
                <CardDescription>Langue et fuseau horaire</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="locale">Langue</Label>
                    <Select value={data.locale} onValueChange={(value) => setData('locale', value)}>
                      <SelectTrigger id="locale">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Fuseau horaire</Label>
                    <Select
                      value={data.timezone}
                      onValueChange={(value) => setData('timezone', value)}
                    >
                      <SelectTrigger id="timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                        <SelectItem value="America/New_York">America/New_York</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statut */}
            <Card>
              <CardHeader>
                <CardTitle>Statut</CardTitle>
                <CardDescription>Activer ou désactiver le compte</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={data.isActive}
                    onCheckedChange={(checked) => setData('isActive', checked as boolean)}
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    Compte actif
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Link href="/admin/users">
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </Link>
              <Button type="submit" disabled={processing}>
                {processing ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
