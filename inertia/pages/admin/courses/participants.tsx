import { Head, Link, router, useForm } from '@inertiajs/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { UserPlus, Trash2, Search, ArrowLeft, Mail } from 'lucide-react'

interface Enrollment {
  id: number
  userId: number
  courseRole: string
  status: 'active' | 'suspended' | 'completed' | 'dropped'
  progressPercentage: number
  enrolledAt: string
  user: {
    id: number
    fullName: string
    email: string
  }
}

interface Course {
  id: number
  code: string
  title: string
}

interface User {
  id: number
  fullName: string
  email: string
}

interface Props {
  course: Course
  enrollments: Enrollment[]
  availableUsers: User[]
  stats: {
    total: number
    active: number
    completed: number
    suspended: number
  }
}

export default function CourseParticipants({ course, enrollments, availableUsers, stats }: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const addForm = useForm({
    userId: '',
    courseRole: 'student',
  })

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const matchesSearch =
      enrollment.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.user.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || enrollment.status === statusFilter
    const matchesRole = roleFilter === 'all' || enrollment.courseRole === roleFilter

    return matchesSearch && matchesStatus && matchesRole
  })

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault()
    addForm.post(`/admin/courses/${course.id}/participants`, {
      onSuccess: () => {
        setIsAddDialogOpen(false)
        addForm.reset()
      },
    })
  }

  const handleRemoveParticipant = (enrollmentId: number) => {
    router.delete(`/admin/courses/${course.id}/participants/${enrollmentId}`)
  }

  const getStatusBadge = (status: Enrollment['status']) => {
    const badges = {
      active: { label: 'Actif', variant: 'default' as const },
      suspended: { label: 'Suspendu', variant: 'destructive' as const },
      completed: { label: 'Terminé', variant: 'secondary' as const },
      dropped: { label: 'Abandonné', variant: 'outline' as const },
    }
    return <Badge variant={badges[status].variant}>{badges[status].label}</Badge>
  }

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      instructor: 'Instructeur',
      teaching_assistant: 'Assistant',
      non_editing_teacher: 'Enseignant (lecture)',
      student: 'Étudiant',
      observer: 'Observateur',
      guest: 'Invité',
    }
    return roles[role] || role
  }

  return (
    <>
      <Head title={`Participants - ${course.title}`} />

      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/courses"
            className="text-sm text-muted-foreground hover:underline flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la gestion des cours
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <Badge variant="outline" className="mb-2">
                {course.code}
              </Badge>
              <h1 className="text-3xl font-bold">{course.title}</h1>
              <p className="text-muted-foreground">Gestion des participants</p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Ajouter un participant
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddParticipant}>
                  <DialogHeader>
                    <DialogTitle>Ajouter un participant</DialogTitle>
                    <DialogDescription>
                      Inscrivez manuellement un utilisateur à ce cours
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="userId">Utilisateur</Label>
                      <Select
                        value={addForm.data.userId}
                        onValueChange={(value) => addForm.setData('userId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un utilisateur" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {addForm.errors.userId && (
                        <p className="text-sm text-destructive">{addForm.errors.userId}</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="courseRole">Rôle dans le cours</Label>
                      <Select
                        value={addForm.data.courseRole}
                        onValueChange={(value) => addForm.setData('courseRole', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Étudiant</SelectItem>
                          <SelectItem value="teaching_assistant">Assistant d'enseignement</SelectItem>
                          <SelectItem value="observer">Observateur</SelectItem>
                          <SelectItem value="guest">Invité</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" disabled={addForm.processing}>
                      {addForm.processing ? 'Ajout...' : 'Ajouter'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Actifs</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.active}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Terminés</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Suspendus</CardDescription>
              <CardTitle className="text-3xl text-red-600">{stats.suspended}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un participant..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                  <SelectItem value="suspended">Suspendu</SelectItem>
                  <SelectItem value="dropped">Abandonné</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les rôles</SelectItem>
                  <SelectItem value="student">Étudiant</SelectItem>
                  <SelectItem value="teaching_assistant">Assistant</SelectItem>
                  <SelectItem value="observer">Observateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Participants Table */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des participants ({filteredEnrollments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredEnrollments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun participant trouvé</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Progression</TableHead>
                    <TableHead>Date d'inscription</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnrollments.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-medium">
                        {enrollment.user.fullName}
                      </TableCell>
                      <TableCell>
                        <a
                          href={`mailto:${enrollment.user.email}`}
                          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3" />
                          {enrollment.user.email}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getRoleLabel(enrollment.courseRole)}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${enrollment.progressPercentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {enrollment.progressPercentage}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(enrollment.enrolledAt).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Retirer le participant</AlertDialogTitle>
                              <AlertDialogDescription>
                                Êtes-vous sûr de vouloir retirer {enrollment.user.fullName} de ce
                                cours ?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveParticipant(enrollment.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Retirer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
