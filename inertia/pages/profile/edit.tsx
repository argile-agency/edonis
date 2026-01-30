import { Head, Link, useForm, router } from '@inertiajs/react'
import { FormEvent, useRef, useState } from 'react'
import { FlashMessages } from '~/components/flash-toaster'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { ArrowLeft, Trash2, Upload, ShieldCheck } from 'lucide-react'

interface User {
  id: number
  fullName: string | null
  firstName: string | null
  lastName: string | null
  email: string
  emailVisibility: string
  avatarUrl: string | null
  avatarDescription: string | null
  bio: string | null
  phone: string | null
  mobilePhone: string | null
  city: string | null
  country: string | null
  address: string | null
  timezone: string
  webUrl: string | null
  identificationNumber: string | null
  organization: string | null
  department: string | null
  studentId: string | null
  twoFactorEnabled: boolean
}

interface Props {
  user: User
}

const TIMEZONES = [
  'Europe/Paris',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Brussels',
  'Europe/Zurich',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Montreal',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Africa/Casablanca',
  'Africa/Tunis',
  'Africa/Dakar',
  'Pacific/Auckland',
  'Australia/Sydney',
]

const COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgique' },
  { code: 'CH', name: 'Suisse' },
  { code: 'CA', name: 'Canada' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MA', name: 'Maroc' },
  { code: 'TN', name: 'Tunisie' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'CM', name: 'Cameroun' },
  { code: 'CD', name: 'Congo (RDC)' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'HT', name: 'Haïti' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'US', name: 'États-Unis' },
  { code: 'ES', name: 'Espagne' },
  { code: 'IT', name: 'Italie' },
  { code: 'PT', name: 'Portugal' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'BR', name: 'Brésil' },
  { code: 'JP', name: 'Japon' },
  { code: 'CN', name: 'Chine' },
  { code: 'AU', name: 'Australie' },
]

function getInitials(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
  }
  if (user.fullName) {
    const parts = user.fullName.trim().split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return parts[0][0].toUpperCase()
  }
  return user.email[0].toUpperCase()
}

export default function ProfileEdit({ user }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Main profile form (text fields only, no file upload)
  const profileForm = useForm({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || '',
    emailVisibility: user.emailVisibility || 'private',
    bio: user.bio || '',
    phone: user.phone || '',
    mobilePhone: user.mobilePhone || '',
    city: user.city || '',
    country: user.country || '',
    address: user.address || '',
    timezone: user.timezone || 'Europe/Paris',
    webUrl: user.webUrl || '',
    identificationNumber: user.identificationNumber || '',
    organization: user.organization || '',
    department: user.department || '',
    avatarDescription: user.avatarDescription || '',
  })

  // Avatar form (separate, file upload only)
  const avatarForm = useForm({
    avatar: null as File | null,
  })

  // Password form (separate)
  const passwordForm = useForm({
    currentPassword: '',
    newPassword: '',
    newPasswordConfirmation: '',
  })

  const handleProfileSubmit = (e: FormEvent) => {
    e.preventDefault()
    profileForm.post('/user/profile')
  }

  const handleAvatarSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!avatarForm.data.avatar) return
    avatarForm.post('/user/profile/avatar', {
      forceFormData: true,
      onSuccess: () => {
        setAvatarPreview(null)
        avatarForm.reset()
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      },
    })
  }

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault()
    passwordForm.post('/user/profile/password', {
      onSuccess: () => {
        passwordForm.reset()
      },
    })
  }

  const handleDeleteAvatar = () => {
    router.delete('/user/profile/avatar')
    setAvatarPreview(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    avatarForm.setData('avatar', file)

    if (file) {
      const url = URL.createObjectURL(file)
      setAvatarPreview(url)
    } else {
      setAvatarPreview(null)
    }
  }

  return (
    <>
      <Head title="Mon profil" />
      <FlashMessages />

      <div className="min-h-screen bg-background py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/dashboard">
              <Button variant="ghost" className="mb-4 gap-2">
                <ArrowLeft className="h-4 w-4" />
                Retour au tableau de bord
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Mon profil</h1>
              {user.twoFactorEnabled && (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  2FA
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              Gérez vos informations personnelles et votre avatar
            </p>
          </div>

          {/* Profile form (text fields only) */}
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            {/* Card 1: General information */}
            <Card>
              <CardHeader>
                <CardTitle>Informations générales</CardTitle>
                <CardDescription>
                  Vos informations d'identité et de contact principal
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input
                      type="text"
                      id="firstName"
                      value={profileForm.data.firstName}
                      onChange={(e) => profileForm.setData('firstName', e.target.value)}
                    />
                    {profileForm.errors.firstName && (
                      <p className="text-sm text-destructive">{profileForm.errors.firstName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input
                      type="text"
                      id="lastName"
                      value={profileForm.data.lastName}
                      onChange={(e) => profileForm.setData('lastName', e.target.value)}
                    />
                    {profileForm.errors.lastName && (
                      <p className="text-sm text-destructive">{profileForm.errors.lastName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Adresse de courriel</Label>
                    <Input
                      type="email"
                      id="email"
                      value={profileForm.data.email}
                      onChange={(e) => profileForm.setData('email', e.target.value)}
                    />
                    {profileForm.errors.email && (
                      <p className="text-sm text-destructive">{profileForm.errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emailVisibility">Visibilité de l'email</Label>
                    <Select
                      value={profileForm.data.emailVisibility}
                      onValueChange={(value) => profileForm.setData('emailVisibility', value)}
                    >
                      <SelectTrigger id="emailVisibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="everyone">Tout le monde</SelectItem>
                        <SelectItem value="participants">Participants uniquement</SelectItem>
                        <SelectItem value="private">Privée (moi uniquement)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Location & Bio */}
            <Card>
              <CardHeader>
                <CardTitle>Localisation et bio</CardTitle>
                <CardDescription>Votre emplacement et votre description</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      type="text"
                      id="city"
                      value={profileForm.data.city}
                      onChange={(e) => profileForm.setData('city', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Pays</Label>
                    <Select
                      value={profileForm.data.country}
                      onValueChange={(value) => profileForm.setData('country', value)}
                    >
                      <SelectTrigger id="country">
                        <SelectValue placeholder="Sélectionnez un pays" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Fuseau horaire</Label>
                    <Select
                      value={profileForm.data.timezone}
                      onValueChange={(value) => profileForm.setData('timezone', value)}
                    >
                      <SelectTrigger id="timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webUrl">Site web</Label>
                    <Input
                      type="url"
                      id="webUrl"
                      value={profileForm.data.webUrl}
                      onChange={(e) => profileForm.setData('webUrl', e.target.value)}
                      placeholder="https://"
                    />
                    {profileForm.errors.webUrl && (
                      <p className="text-sm text-destructive">{profileForm.errors.webUrl}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Description / Bio</Label>
                  <Textarea
                    id="bio"
                    rows={4}
                    value={profileForm.data.bio}
                    onChange={(e) => profileForm.setData('bio', e.target.value)}
                    placeholder="Parlez de vous..."
                  />
                  {profileForm.errors.bio && (
                    <p className="text-sm text-destructive">{profileForm.errors.bio}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Optional fields */}
            <Card>
              <CardHeader>
                <CardTitle>Champs facultatifs</CardTitle>
                <CardDescription>
                  Informations supplémentaires (numéro d'identification, institution, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="identificationNumber">Numéro d'identification</Label>
                    <Input
                      type="text"
                      id="identificationNumber"
                      value={profileForm.data.identificationNumber}
                      onChange={(e) => profileForm.setData('identificationNumber', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organization">Institution</Label>
                    <Input
                      type="text"
                      id="organization"
                      value={profileForm.data.organization}
                      onChange={(e) => profileForm.setData('organization', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Département</Label>
                    <Input
                      type="text"
                      id="department"
                      value={profileForm.data.department}
                      onChange={(e) => profileForm.setData('department', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      type="tel"
                      id="phone"
                      value={profileForm.data.phone}
                      onChange={(e) => profileForm.setData('phone', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mobilePhone">Téléphone mobile</Label>
                    <Input
                      type="tel"
                      id="mobilePhone"
                      value={profileForm.data.mobilePhone}
                      onChange={(e) => profileForm.setData('mobilePhone', e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="address">Adresse</Label>
                    <Textarea
                      id="address"
                      rows={2}
                      value={profileForm.data.address}
                      onChange={(e) => profileForm.setData('address', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profile save button */}
            <div className="flex justify-end gap-3">
              <Link href="/dashboard">
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </Link>
              <Button type="submit" disabled={profileForm.processing}>
                {profileForm.processing ? 'Enregistrement...' : 'Enregistrer le profil'}
              </Button>
            </div>
          </form>

          {/* Avatar form (separate, file upload) */}
          <form onSubmit={handleAvatarSubmit} className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Avatar</CardTitle>
                <CardDescription>Votre photo de profil</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  <Avatar size="2xl">
                    {(avatarPreview || user.avatarUrl) && (
                      <AvatarImage
                        src={avatarPreview || user.avatarUrl!}
                        alt={user.avatarDescription || 'Avatar'}
                      />
                    )}
                    <AvatarFallback>{getInitials(user)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      name="avatar"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleFileChange}
                      className="max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, GIF ou WebP. 2 Mo maximum.
                    </p>
                    {user.avatarUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={handleDeleteAvatar}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Supprimer l'avatar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatarDescription">
                    Description de l'image (texte alternatif)
                  </Label>
                  <Input
                    type="text"
                    id="avatarDescription"
                    value={profileForm.data.avatarDescription}
                    onChange={(e) => profileForm.setData('avatarDescription', e.target.value)}
                    placeholder="Décrivez votre avatar pour l'accessibilité"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cette description est utilisée par les lecteurs d'écran (enregistrée avec le
                    profil)
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={avatarForm.processing || !avatarForm.data.avatar}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {avatarForm.processing ? 'Upload en cours...' : "Enregistrer l'avatar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          {/* Password form (separate) */}
          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Mot de passe</CardTitle>
                <CardDescription>
                  Modifiez votre mot de passe. Vous devez saisir votre mot de passe actuel.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                    <Input
                      type="password"
                      id="currentPassword"
                      value={passwordForm.data.currentPassword}
                      onChange={(e) => passwordForm.setData('currentPassword', e.target.value)}
                    />
                    {passwordForm.errors.currentPassword && (
                      <p className="text-sm text-destructive">
                        {passwordForm.errors.currentPassword}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                    <Input
                      type="password"
                      id="newPassword"
                      value={passwordForm.data.newPassword}
                      onChange={(e) => passwordForm.setData('newPassword', e.target.value)}
                    />
                    {passwordForm.errors.newPassword && (
                      <p className="text-sm text-destructive">{passwordForm.errors.newPassword}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPasswordConfirmation">
                      Confirmation du nouveau mot de passe
                    </Label>
                    <Input
                      type="password"
                      id="newPasswordConfirmation"
                      value={passwordForm.data.newPasswordConfirmation}
                      onChange={(e) =>
                        passwordForm.setData('newPasswordConfirmation', e.target.value)
                      }
                    />
                    {passwordForm.errors.newPasswordConfirmation && (
                      <p className="text-sm text-destructive">
                        {passwordForm.errors.newPasswordConfirmation}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={passwordForm.processing}>
                {passwordForm.processing ? 'Modification...' : 'Modifier le mot de passe'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
