import { Head, Link, router, useForm } from '@inertiajs/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Textarea } from '~/components/ui/textarea'
import { Label } from '~/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  User,
  Calendar,
  Tag,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react'

interface Course {
  id: number
  code: string
  title: string
  description: string
  instructor: {
    id: number
    fullName: string
    email: string
  }
  courseCategory?: {
    id: number
    name: string
  }
  level: string | null
  estimatedHours: number | null
  tags: string[]
  approvalStatus: 'draft' | 'pending_approval' | 'approved' | 'rejected'
  submittedForApprovalAt: string | null
  approvedAt: string | null
  rejectionReason: string | null
  approvedBy?: {
    id: number
    fullName: string
  }
  createdAt: string
}

interface Props {
  pendingCourses: Course[]
  approvedCourses: Course[]
  rejectedCourses: Course[]
}

export default function ApprovalQueue({ pendingCourses, approvedCourses, rejectedCourses }: Props) {
  const [rejectingCourse, setRejectingCourse] = useState<Course | null>(null)

  const rejectForm = useForm({
    reason: '',
  })

  const handleApprove = (courseId: number) => {
    router.post(`/admin/courses/${courseId}/approve`)
  }

  const handleReject = () => {
    if (!rejectingCourse) return

    rejectForm.post(`/admin/courses/${rejectingCourse.id}/reject`, {
      onSuccess: () => {
        setRejectingCourse(null)
        rejectForm.reset()
      },
    })
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: Course['approvalStatus']) => {
    const badges = {
      draft: { label: 'Brouillon', variant: 'secondary' as const, icon: FileText },
      pending_approval: { label: 'En attente', variant: 'default' as const, icon: Clock },
      approved: { label: 'Approuvé', variant: 'default' as const, icon: CheckCircle },
      rejected: { label: 'Rejeté', variant: 'destructive' as const, icon: XCircle },
    }
    const badge = badges[status]
    const Icon = badge.icon
    return (
      <Badge variant={badge.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {badge.label}
      </Badge>
    )
  }

  return (
    <>
      <Head title="File d'attente d'approbation" />

      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/courses"
            className="text-sm text-muted-foreground hover:underline flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la gestion des cours
          </Link>
          <h1 className="text-3xl font-bold">File d'attente d'approbation des cours</h1>
          <p className="text-muted-foreground">
            Examinez et approuvez les cours soumis par les enseignants
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>En attente</CardDescription>
              <CardTitle className="text-3xl">{pendingCourses.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Approuvés</CardDescription>
              <CardTitle className="text-3xl text-green-600">{approvedCourses.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Rejetés</CardDescription>
              <CardTitle className="text-3xl text-red-600">{rejectedCourses.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="pending">En attente ({pendingCourses.length})</TabsTrigger>
            <TabsTrigger value="approved">Approuvés ({approvedCourses.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejetés ({rejectedCourses.length})</TabsTrigger>
          </TabsList>

          {/* Pending Courses */}
          <TabsContent value="pending">
            {pendingCourses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun cours en attente</h3>
                  <p className="text-muted-foreground text-center">
                    Tous les cours soumis ont été traités.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onApprove={handleApprove}
                    onReject={setRejectingCourse}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                    showActions
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Approved Courses */}
          <TabsContent value="approved">
            {approvedCourses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun cours approuvé</h3>
                  <p className="text-muted-foreground text-center">
                    Les cours approuvés apparaîtront ici.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {approvedCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Rejected Courses */}
          <TabsContent value="rejected">
            {rejectedCourses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun cours rejeté</h3>
                  <p className="text-muted-foreground text-center">
                    Les cours rejetés apparaîtront ici.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {rejectedCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Reject Dialog */}
        <Dialog open={!!rejectingCourse} onOpenChange={(open) => !open && setRejectingCourse(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeter le cours</DialogTitle>
              <DialogDescription>
                Veuillez fournir une raison pour le rejet de "{rejectingCourse?.title}"
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reason">
                  Raison du rejet <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reason"
                  value={rejectForm.data.reason}
                  onChange={(e) => rejectForm.setData('reason', e.target.value)}
                  placeholder="Expliquez pourquoi ce cours est rejeté..."
                  rows={5}
                  required
                />
                {rejectForm.errors.reason && (
                  <p className="text-sm text-destructive">{rejectForm.errors.reason}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectingCourse(null)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={rejectForm.processing || !rejectForm.data.reason}
              >
                {rejectForm.processing ? 'Rejet...' : 'Rejeter le cours'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

interface CourseCardProps {
  course: Course
  formatDate: (date: string | null) => string
  getStatusBadge: (status: Course['approvalStatus']) => JSX.Element
  onApprove?: (courseId: number) => void
  onReject?: (course: Course) => void
  showActions?: boolean
}

function CourseCard({
  course,
  formatDate,
  getStatusBadge,
  onApprove,
  onReject,
  showActions = false,
}: CourseCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{course.code}</Badge>
              {getStatusBadge(course.approvalStatus)}
            </div>
            <CardTitle className="text-xl mb-2">{course.title}</CardTitle>
            {course.courseCategory && (
              <p className="text-sm text-muted-foreground">
                Catégorie: {course.courseCategory.name}
              </p>
            )}
          </div>
          {showActions && onApprove && onReject && (
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approuver
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approuver le cours</AlertDialogTitle>
                    <AlertDialogDescription>
                      Êtes-vous sûr de vouloir approuver "{course.title}" ? Le cours sera publié et
                      accessible aux étudiants.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onApprove(course.id)}>
                      Approuver
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" variant="destructive" onClick={() => onReject(course)}>
                <XCircle className="h-4 w-4 mr-2" />
                Rejeter
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-4">{course.description}</p>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-start gap-2 text-sm">
            <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="font-medium">{course.instructor.fullName}</p>
              <p className="text-muted-foreground">{course.instructor.email}</p>
            </div>
          </div>

          {course.submittedForApprovalAt && (
            <div className="flex items-start gap-2 text-sm">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Soumis le</p>
                <p className="text-muted-foreground">{formatDate(course.submittedForApprovalAt)}</p>
              </div>
            </div>
          )}
        </div>

        {course.approvedAt && course.approvedBy && (
          <div className="flex items-start gap-2 text-sm mb-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <CheckCircle className="h-4 w-4 mt-0.5 text-green-600" />
            <div>
              <p className="font-medium text-green-900 dark:text-green-100">
                Approuvé par {course.approvedBy.fullName}
              </p>
              <p className="text-green-700 dark:text-green-300">{formatDate(course.approvedAt)}</p>
            </div>
          </div>
        )}

        {course.rejectionReason && (
          <div className="flex items-start gap-2 text-sm mb-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
            <AlertCircle className="h-4 w-4 mt-0.5 text-red-600" />
            <div className="flex-1">
              <p className="font-medium text-red-900 dark:text-red-100 mb-1">Raison du rejet:</p>
              <p className="text-red-700 dark:text-red-300">{course.rejectionReason}</p>
            </div>
          </div>
        )}

        {course.tags && course.tags.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <Tag className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="flex flex-wrap gap-2">
              {course.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
          {course.level && <span>Niveau: {course.level}</span>}
          {course.estimatedHours && <span>{course.estimatedHours}h estimées</span>}
        </div>
      </CardContent>
    </Card>
  )
}
