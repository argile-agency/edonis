import { Head, Link, router } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
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
  ChevronLeft,
  Edit,
  Trash2,
  Archive,
  CheckCircle,
  Users,
  Calendar,
  Clock,
  BookOpen,
} from 'lucide-react'

interface Instructor {
  id: number
  fullName: string
  email: string
}

interface CoursePermission {
  id: number
  userId: number
  permissionLevel: 'view' | 'edit' | 'manage'
  roleInCourse: string | null
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
  description: string | null
  objectives: string | null
  status: 'draft' | 'published' | 'archived'
  visibility: 'public' | 'private' | 'unlisted'
  maxStudents: number | null
  allowEnrollment: boolean
  isFeatured: boolean
  startDate: string | null
  endDate: string | null
  category: string | null
  level: string | null
  language: string
  estimatedHours: number | null
  tags: string[] | null
  enrolledCount: number
  completedCount: number
  averageRating: number | null
  createdAt: string
  instructor: Instructor
  permissions: CoursePermission[]
  canEnroll: boolean
}

interface Props {
  course: Course
  permissions: {
    canEdit: boolean
    canManage: boolean
  }
}

export default function ShowCourse({ course, permissions }: Props) {
  const handleDelete = () => {
    router.delete(`/courses/${course.id}`, {
      onSuccess: () => {
        router.visit('/courses')
      },
    })
  }

  const handlePublish = () => {
    router.post(`/courses/${course.id}/publish`)
  }

  const handleArchive = () => {
    router.post(`/courses/${course.id}/archive`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-500'
      case 'draft':
        return 'bg-yellow-500'
      case 'archived':
        return 'bg-gray-500'
      default:
        return 'bg-blue-500'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Non définie'
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <>
      <Head title={course.title} />

      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <Link href="/courses">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Retour aux cours
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={getStatusColor(course.status)}>{course.status}</Badge>
                      <span className="text-sm text-muted-foreground">{course.code}</span>
                    </div>
                    <CardTitle className="text-3xl mb-2">{course.title}</CardTitle>
                    <CardDescription className="text-base">
                      Par {course.instructor.fullName}
                    </CardDescription>
                  </div>

                  {permissions.canEdit && (
                    <div className="flex gap-2">
                      <Link href={`/courses/${course.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="mr-2 h-4 w-4" />
                          Modifier
                        </Button>
                      </Link>

                      {permissions.canManage && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Êtes-vous sûr?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Le cours et toutes ses données seront
                                supprimés.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDelete}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {course.description && (
                    <div>
                      <h3 className="font-semibold mb-2">Description</h3>
                      <p className="text-muted-foreground whitespace-pre-line">
                        {course.description}
                      </p>
                    </div>
                  )}

                  {course.objectives && (
                    <div>
                      <h3 className="font-semibold mb-2">Objectifs d'apprentissage</h3>
                      <p className="text-muted-foreground whitespace-pre-line">
                        {course.objectives}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Course Information */}
            <Card>
              <CardHeader>
                <CardTitle>Informations du cours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Étudiants inscrits</p>
                      <p className="text-2xl font-bold">{course.enrolledCount}</p>
                      {course.maxStudents && (
                        <p className="text-xs text-muted-foreground">
                          sur {course.maxStudents} maximum
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Complétés</p>
                      <p className="text-2xl font-bold">{course.completedCount}</p>
                    </div>
                  </div>

                  {course.estimatedHours && (
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Durée estimée</p>
                        <p className="text-2xl font-bold">{course.estimatedHours}h</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Période</p>
                      <p className="text-sm">{formatDate(course.startDate)}</p>
                      <p className="text-xs text-muted-foreground">
                        au {formatDate(course.endDate)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Permissions */}
            {permissions.canManage && course.permissions && course.permissions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Permissions du cours</CardTitle>
                  <CardDescription>Autres instructeurs et assistants</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {course.permissions.map((perm) => (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{perm.user.fullName}</p>
                          <p className="text-sm text-muted-foreground">{perm.user.email}</p>
                          {perm.roleInCourse && (
                            <Badge variant="outline" className="mt-1">
                              {perm.roleInCourse}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge>{perm.permissionLevel}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.delete(`/courses/${course.id}/permissions/${perm.id}`)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            {permissions.canManage && (
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {course.status === 'draft' && (
                    <Button onClick={handlePublish} className="w-full">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Publier le cours
                    </Button>
                  )}

                  {course.status === 'published' && (
                    <Button onClick={handleArchive} variant="outline" className="w-full">
                      <Archive className="mr-2 h-4 w-4" />
                      Archiver le cours
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Details */}
            <Card>
              <CardHeader>
                <CardTitle>Détails</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Visibilité</p>
                  <p className="font-medium capitalize">{course.visibility}</p>
                </div>

                {course.category && (
                  <div>
                    <p className="text-sm text-muted-foreground">Catégorie</p>
                    <Badge variant="outline">{course.category}</Badge>
                  </div>
                )}

                {course.level && (
                  <div>
                    <p className="text-sm text-muted-foreground">Niveau</p>
                    <Badge variant="outline">{course.level}</Badge>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Langue</p>
                  <p className="font-medium uppercase">{course.language}</p>
                </div>

                {course.tags && course.tags.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {course.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
