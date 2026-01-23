import { Head, Link, router, useForm } from '@inertiajs/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Badge } from '~/components/ui/badge'
import { Switch } from '~/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog'
import { Calendar, Edit, Key, Lock, Plus, Settings, Trash2, UserPlus, Users } from 'lucide-react'

interface EnrollmentMethod {
  id: number
  methodType: 'manual' | 'self' | 'key' | 'approval' | 'bulk' | 'cohort'
  name: string
  isEnabled: boolean
  sortOrder: number
  maxEnrollments: number | null
  currentEnrollments: number
  defaultRole: string
  enrollmentStartDate: string | null
  enrollmentEndDate: string | null
  enrollmentDurationDays: number | null
  enrollmentKey: string | null
  keyCaseSensitive: boolean
  requiresApproval: boolean
  approvalMessage: string | null
  welcomeMessage: string | null
  autoAssignGroupId: number | null
  sendWelcomeEmail: boolean
  notifyInstructor: boolean
  createdAt: string
}

interface Course {
  id: number
  code: string
  title: string
}

interface Group {
  id: number
  name: string
  currentMembers: number
  maxMembers: number | null
}

interface Props {
  course: Course
  enrollmentMethods: EnrollmentMethod[]
  groups: Group[]
}

export default function EnrollmentMethodsManage({ course, enrollmentMethods, groups }: Props) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<EnrollmentMethod | null>(null)

  const form = useForm({
    methodType: 'self' as 'manual' | 'self' | 'key' | 'approval' | 'bulk' | 'cohort',
    name: '',
    isEnabled: true,
    sortOrder: enrollmentMethods.length + 1,
    maxEnrollments: null as number | null,
    defaultRole: 'student',
    enrollmentStartDate: '',
    enrollmentEndDate: '',
    enrollmentDurationDays: null as number | null,
    enrollmentKey: '',
    keyCaseSensitive: false,
    requiresApproval: false,
    approvalMessage: '',
    welcomeMessage: '',
    autoAssignGroupId: null as number | null,
    sendWelcomeEmail: true,
    notifyInstructor: false,
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    form.post(`/courses/${course.id}/enrollment-methods`, {
      onSuccess: () => {
        setIsCreateDialogOpen(false)
        form.reset()
      },
    })
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMethod) return

    form.put(`/courses/${course.id}/enrollment-methods/${editingMethod.id}`, {
      onSuccess: () => {
        setEditingMethod(null)
        form.reset()
      },
    })
  }

  const handleDelete = (methodId: number) => {
    router.delete(`/courses/${course.id}/enrollment-methods/${methodId}`)
  }

  const openEditDialog = (method: EnrollmentMethod) => {
    setEditingMethod(method)
    form.setData({
      methodType: method.methodType,
      name: method.name,
      isEnabled: method.isEnabled,
      sortOrder: method.sortOrder,
      maxEnrollments: method.maxEnrollments,
      defaultRole: method.defaultRole,
      enrollmentStartDate: method.enrollmentStartDate || '',
      enrollmentEndDate: method.enrollmentEndDate || '',
      enrollmentDurationDays: method.enrollmentDurationDays,
      enrollmentKey: method.enrollmentKey || '',
      keyCaseSensitive: method.keyCaseSensitive,
      requiresApproval: method.requiresApproval,
      approvalMessage: method.approvalMessage || '',
      welcomeMessage: method.welcomeMessage || '',
      autoAssignGroupId: method.autoAssignGroupId,
      sendWelcomeEmail: method.sendWelcomeEmail,
      notifyInstructor: method.notifyInstructor,
    })
  }

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'self':
        return <UserPlus className="h-5 w-5" />
      case 'key':
        return <Key className="h-5 w-5" />
      case 'approval':
        return <Lock className="h-5 w-5" />
      case 'manual':
        return <Users className="h-5 w-5" />
      default:
        return <Settings className="h-5 w-5" />
    }
  }

  const getMethodTypeName = (type: string) => {
    const names = {
      self: 'Auto-inscription',
      key: 'Avec Clé',
      approval: 'Approbation Requise',
      manual: 'Manuel',
      bulk: 'Inscription en Masse',
      cohort: 'Par Cohorte',
    }
    return names[type as keyof typeof names] || type
  }

  return (
    <>
      <Head title={`Gestion des inscriptions - ${course.title}`} />

      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href={`/courses/${course.id}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              ← Retour au cours
            </Link>
            <h1 className="text-3xl font-bold mt-2">Méthodes d'inscription</h1>
            <p className="text-muted-foreground">
              {course.code} - {course.title}
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle méthode
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Créer une méthode d'inscription</DialogTitle>
                  <DialogDescription>
                    Configurez une nouvelle façon pour les étudiants de s'inscrire à ce cours
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {/* Method Type */}
                  <div className="grid gap-2">
                    <Label htmlFor="methodType">Type de méthode</Label>
                    <Select
                      value={form.data.methodType}
                      onValueChange={(value) => form.setData('methodType', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self">Auto-inscription</SelectItem>
                        <SelectItem value="key">Avec clé d'inscription</SelectItem>
                        <SelectItem value="approval">Approbation requise</SelectItem>
                        <SelectItem value="manual">Manuel (par l'enseignant)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Name */}
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nom de la méthode</Label>
                    <Input
                      id="name"
                      value={form.data.name}
                      onChange={(e) => form.setData('name', e.target.value)}
                      placeholder="Ex: Inscription ouverte pour étudiants"
                      required
                    />
                  </div>

                  {/* Default Role */}
                  <div className="grid gap-2">
                    <Label htmlFor="defaultRole">Rôle par défaut</Label>
                    <Select
                      value={form.data.defaultRole}
                      onValueChange={(value) => form.setData('defaultRole', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Étudiant</SelectItem>
                        <SelectItem value="teaching_assistant">Assistant d'enseignement</SelectItem>
                        <SelectItem value="observer">Observateur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Max Enrollments */}
                  <div className="grid gap-2">
                    <Label htmlFor="maxEnrollments">
                      Nombre maximum d'inscriptions (optionnel)
                    </Label>
                    <Input
                      id="maxEnrollments"
                      type="number"
                      value={form.data.maxEnrollments || ''}
                      onChange={(e) =>
                        form.setData(
                          'maxEnrollments',
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      placeholder="Illimité si vide"
                    />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="enrollmentStartDate">Date de début (optionnel)</Label>
                      <Input
                        id="enrollmentStartDate"
                        type="datetime-local"
                        value={form.data.enrollmentStartDate}
                        onChange={(e) => form.setData('enrollmentStartDate', e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="enrollmentEndDate">Date de fin (optionnel)</Label>
                      <Input
                        id="enrollmentEndDate"
                        type="datetime-local"
                        value={form.data.enrollmentEndDate}
                        onChange={(e) => form.setData('enrollmentEndDate', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Enrollment Key (for key-based) */}
                  {form.data.methodType === 'key' && (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="enrollmentKey">Clé d'inscription</Label>
                        <Input
                          id="enrollmentKey"
                          value={form.data.enrollmentKey}
                          onChange={(e) => form.setData('enrollmentKey', e.target.value)}
                          placeholder="Ex: CS101-2024"
                          required={form.data.methodType === 'key'}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="keyCaseSensitive"
                          checked={form.data.keyCaseSensitive}
                          onCheckedChange={(checked) => form.setData('keyCaseSensitive', checked)}
                        />
                        <Label htmlFor="keyCaseSensitive">Clé sensible à la casse</Label>
                      </div>
                    </>
                  )}

                  {/* Approval Message (for approval-based) */}
                  {form.data.methodType === 'approval' && (
                    <div className="grid gap-2">
                      <Label htmlFor="approvalMessage">Message d'approbation</Label>
                      <Textarea
                        id="approvalMessage"
                        value={form.data.approvalMessage}
                        onChange={(e) => form.setData('approvalMessage', e.target.value)}
                        placeholder="Message affiché aux étudiants demandant l'approbation..."
                        rows={3}
                      />
                    </div>
                  )}

                  {/* Welcome Message */}
                  <div className="grid gap-2">
                    <Label htmlFor="welcomeMessage">Message de bienvenue (optionnel)</Label>
                    <Textarea
                      id="welcomeMessage"
                      value={form.data.welcomeMessage}
                      onChange={(e) => form.setData('welcomeMessage', e.target.value)}
                      placeholder="Message affiché après inscription réussie..."
                      rows={3}
                    />
                  </div>

                  {/* Auto-assign Group */}
                  {groups.length > 0 && (
                    <div className="grid gap-2">
                      <Label htmlFor="autoAssignGroupId">Groupe automatique (optionnel)</Label>
                      <Select
                        value={form.data.autoAssignGroupId?.toString() || 'none'}
                        onValueChange={(value) =>
                          form.setData('autoAssignGroupId', value === 'none' ? null : Number(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Aucun groupe automatique" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id.toString()}>
                              {group.name} ({group.currentMembers}
                              {group.maxMembers && `/${group.maxMembers}`})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Settings */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isEnabled"
                        checked={form.data.isEnabled}
                        onCheckedChange={(checked) => form.setData('isEnabled', checked)}
                      />
                      <Label htmlFor="isEnabled">Méthode activée</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="sendWelcomeEmail"
                        checked={form.data.sendWelcomeEmail}
                        onCheckedChange={(checked) => form.setData('sendWelcomeEmail', checked)}
                      />
                      <Label htmlFor="sendWelcomeEmail">Envoyer email de bienvenue</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="notifyInstructor"
                        checked={form.data.notifyInstructor}
                        onCheckedChange={(checked) => form.setData('notifyInstructor', checked)}
                      />
                      <Label htmlFor="notifyInstructor">Notifier l'enseignant</Label>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={form.processing}>
                    {form.processing ? 'Création...' : 'Créer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Enrollment Methods List */}
        {enrollmentMethods.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune méthode d'inscription</h3>
              <p className="text-muted-foreground text-center mb-4">
                Commencez par créer une méthode pour permettre aux étudiants de s'inscrire à ce
                cours.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer la première méthode
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {enrollmentMethods
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((method) => (
                <Card key={method.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{getMethodIcon(method.methodType)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle>{method.name}</CardTitle>
                            {!method.isEnabled && <Badge variant="secondary">Désactivée</Badge>}
                          </div>
                          <CardDescription>{getMethodTypeName(method.methodType)}</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(method)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                              <AlertDialogDescription>
                                Êtes-vous sûr de vouloir supprimer cette méthode d'inscription ?
                                Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(method.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Inscriptions</p>
                        <p className="font-medium">
                          {method.currentEnrollments}
                          {method.maxEnrollments && ` / ${method.maxEnrollments}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Rôle par défaut</p>
                        <p className="font-medium">{method.defaultRole}</p>
                      </div>
                      {method.enrollmentStartDate && (
                        <div>
                          <p className="text-muted-foreground">Début</p>
                          <p className="font-medium">
                            {new Date(method.enrollmentStartDate).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      )}
                      {method.enrollmentEndDate && (
                        <div>
                          <p className="text-muted-foreground">Fin</p>
                          <p className="font-medium">
                            {new Date(method.enrollmentEndDate).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      )}
                    </div>

                    {method.methodType === 'key' && method.enrollmentKey && (
                      <div className="mt-4 p-3 bg-secondary rounded-md">
                        <p className="text-sm text-muted-foreground mb-1">Clé d'inscription:</p>
                        <code className="text-sm font-mono">{method.enrollmentKey}</code>
                      </div>
                    )}

                    {method.welcomeMessage && (
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground mb-1">Message de bienvenue:</p>
                        <p className="text-sm">{method.welcomeMessage}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingMethod} onOpenChange={(open) => !open && setEditingMethod(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>Modifier la méthode d'inscription</DialogTitle>
                <DialogDescription>
                  Mettez à jour les paramètres de cette méthode d'inscription
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Same form fields as create dialog */}
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Nom de la méthode</Label>
                  <Input
                    id="edit-name"
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-maxEnrollments">
                    Nombre maximum d'inscriptions (optionnel)
                  </Label>
                  <Input
                    id="edit-maxEnrollments"
                    type="number"
                    value={form.data.maxEnrollments || ''}
                    onChange={(e) =>
                      form.setData('maxEnrollments', e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-enrollmentStartDate">Date de début</Label>
                    <Input
                      id="edit-enrollmentStartDate"
                      type="datetime-local"
                      value={form.data.enrollmentStartDate}
                      onChange={(e) => form.setData('enrollmentStartDate', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-enrollmentEndDate">Date de fin</Label>
                    <Input
                      id="edit-enrollmentEndDate"
                      type="datetime-local"
                      value={form.data.enrollmentEndDate}
                      onChange={(e) => form.setData('enrollmentEndDate', e.target.value)}
                    />
                  </div>
                </div>

                {form.data.methodType === 'key' && (
                  <div className="grid gap-2">
                    <Label htmlFor="edit-enrollmentKey">Clé d'inscription</Label>
                    <Input
                      id="edit-enrollmentKey"
                      value={form.data.enrollmentKey}
                      onChange={(e) => form.setData('enrollmentKey', e.target.value)}
                    />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="edit-welcomeMessage">Message de bienvenue</Label>
                  <Textarea
                    id="edit-welcomeMessage"
                    value={form.data.welcomeMessage}
                    onChange={(e) => form.setData('welcomeMessage', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="edit-isEnabled"
                      checked={form.data.isEnabled}
                      onCheckedChange={(checked) => form.setData('isEnabled', checked)}
                    />
                    <Label htmlFor="edit-isEnabled">Méthode activée</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="edit-sendWelcomeEmail"
                      checked={form.data.sendWelcomeEmail}
                      onCheckedChange={(checked) => form.setData('sendWelcomeEmail', checked)}
                    />
                    <Label htmlFor="edit-sendWelcomeEmail">Envoyer email de bienvenue</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="edit-notifyInstructor"
                      checked={form.data.notifyInstructor}
                      onCheckedChange={(checked) => form.setData('notifyInstructor', checked)}
                    />
                    <Label htmlFor="edit-notifyInstructor">Notifier l'enseignant</Label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingMethod(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={form.processing}>
                  {form.processing ? 'Mise à jour...' : 'Mettre à jour'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
