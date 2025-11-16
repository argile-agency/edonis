import { Head, useForm } from '@inertiajs/react'
import { FormEvent, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Badge } from '~/components/ui/badge'
import { Alert, AlertDescription } from '~/components/ui/alert'
import {
  Calendar,
  Clock,
  Key,
  Lock,
  UserPlus,
  Users,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react'

interface EnrollmentMethod {
  id: number
  methodType: 'manual' | 'self' | 'key' | 'approval' | 'bulk' | 'cohort'
  name: string
  isEnabled: boolean
  maxEnrollments: number | null
  currentEnrollments: number
  enrollmentStartDate: string | null
  enrollmentEndDate: string | null
  enrollmentKey: string | null
  requiresApproval: boolean
  approvalMessage: string | null
  welcomeMessage: string | null
  autoAssignGroupId: number | null
  autoAssignGroup?: {
    id: number
    name: string
    currentMembers: number
    maxMembers: number | null
  }
}

interface Course {
  id: number
  code: string
  title: string
  description: string
  instructor: {
    id: number
    fullName: string
  }
  startDate: string | null
  endDate: string | null
  maxStudents: number | null
  enrolledCount: number
  level: string | null
  estimatedHours: number | null
  tags: string[]
  courseCategory?: {
    name: string
    path: string
  }
}

interface Props {
  course: Course
  enrollmentMethods: EnrollmentMethod[]
  isEnrolled: boolean
  userEnrollment?: {
    id: number
    status: string
    courseRole: string
  }
}

export default function EnrollmentShow({ course, enrollmentMethods, isEnrolled, userEnrollment }: Props) {
  const [selectedMethod, setSelectedMethod] = useState<EnrollmentMethod | null>(null)

  const keyForm = useForm({
    enrollmentKey: '',
    enrollmentMethodId: 0,
  })

  const requestForm = useForm({
    message: '',
    enrollmentMethodId: 0,
  })

  const selfForm = useForm({
    enrollmentMethodId: 0,
  })

  const handleKeyEnrollment = (e: FormEvent, method: EnrollmentMethod) => {
    e.preventDefault()
    keyForm.setData('enrollmentMethodId', method.id)
    keyForm.post(`/courses/${course.id}/enroll/key`)
  }

  const handleSelfEnrollment = (method: EnrollmentMethod) => {
    selfForm.setData('enrollmentMethodId', method.id)
    selfForm.post(`/courses/${course.id}/enroll/self`)
  }

  const handleRequestEnrollment = (e: FormEvent, method: EnrollmentMethod) => {
    e.preventDefault()
    requestForm.setData('enrollmentMethodId', method.id)
    requestForm.post(`/courses/${course.id}/enroll/request`)
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
        return <UserPlus className="h-5 w-5" />
    }
  }

  const getMethodBadge = (type: string) => {
    const badges = {
      self: { label: 'Auto-inscription', variant: 'default' as const },
      key: { label: 'Avec Clé', variant: 'secondary' as const },
      approval: { label: 'Approbation', variant: 'outline' as const },
      manual: { label: 'Manuel', variant: 'destructive' as const },
    }
    const badge = badges[type as keyof typeof badges] || badges.self
    return <Badge variant={badge.variant}>{badge.label}</Badge>
  }

  const isMethodAvailable = (method: EnrollmentMethod) => {
    if (!method.isEnabled) return false
    if (method.maxEnrollments && method.currentEnrollments >= method.maxEnrollments) return false

    const now = new Date()
    if (method.enrollmentStartDate && new Date(method.enrollmentStartDate) > now) return false
    if (method.enrollmentEndDate && new Date(method.enrollmentEndDate) < now) return false

    return true
  }

  const formatDate = (date: string | null) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <>
      <Head title={`Inscription - ${course.title}`} />

      <div className="container mx-auto py-8 px-4 max-w-5xl">
        {/* Course Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <Badge variant="outline" className="mb-2">
                {course.code}
              </Badge>
              <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
              {course.courseCategory && (
                <p className="text-muted-foreground">
                  Catégorie: {course.courseCategory.name}
                </p>
              )}
            </div>
          </div>

          <p className="text-lg text-muted-foreground mb-4">{course.description}</p>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>
                {course.enrolledCount} étudiant{course.enrolledCount > 1 ? 's' : ''}
                {course.maxStudents && ` / ${course.maxStudents}`}
              </span>
            </div>
            {course.estimatedHours && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{course.estimatedHours}h de cours</span>
              </div>
            )}
            {course.startDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Début: {formatDate(course.startDate)}</span>
              </div>
            )}
          </div>

          {course.tags && course.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {course.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Enrollment Status */}
        {isEnrolled && userEnrollment && (
          <Alert className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Vous êtes déjà inscrit à ce cours en tant que{' '}
              <strong>{userEnrollment.courseRole}</strong>. Statut:{' '}
              <strong>{userEnrollment.status}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Enrollment Methods */}
        {!isEnrolled && enrollmentMethods.length === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Aucune méthode d'inscription n'est actuellement disponible pour ce cours.
            </AlertDescription>
          </Alert>
        )}

        {!isEnrolled && enrollmentMethods.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Méthodes d'inscription disponibles</h2>

            {enrollmentMethods.map((method) => {
              const available = isMethodAvailable(method)

              return (
                <Card key={method.id} className={!available ? 'opacity-60' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getMethodIcon(method.methodType)}
                        <div>
                          <CardTitle>{method.name}</CardTitle>
                          <CardDescription>
                            {method.enrollmentStartDate && method.enrollmentEndDate && (
                              <span>
                                Du {formatDate(method.enrollmentStartDate)} au{' '}
                                {formatDate(method.enrollmentEndDate)}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      {getMethodBadge(method.methodType)}
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Availability Status */}
                    {!available && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {!method.isEnabled && 'Cette méthode est actuellement désactivée.'}
                          {method.maxEnrollments &&
                            method.currentEnrollments >= method.maxEnrollments &&
                            'Le nombre maximum d\'inscriptions a été atteint.'}
                          {method.enrollmentStartDate &&
                            new Date(method.enrollmentStartDate) > new Date() &&
                            `Les inscriptions ouvrent le ${formatDate(method.enrollmentStartDate)}.`}
                          {method.enrollmentEndDate &&
                            new Date(method.enrollmentEndDate) < new Date() &&
                            `Les inscriptions ont fermé le ${formatDate(method.enrollmentEndDate)}.`}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Enrollment Progress */}
                    {method.maxEnrollments && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span>Places disponibles</span>
                          <span>
                            {method.currentEnrollments} / {method.maxEnrollments}
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{
                              width: `${(method.currentEnrollments / method.maxEnrollments) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Auto-assign Group Info */}
                    {method.autoAssignGroup && (
                      <Alert className="mb-4">
                        <Users className="h-4 w-4" />
                        <AlertDescription>
                          Vous serez automatiquement ajouté au groupe{' '}
                          <strong>{method.autoAssignGroup.name}</strong>
                          {method.autoAssignGroup.maxMembers && (
                            <span>
                              {' '}
                              ({method.autoAssignGroup.currentMembers} /{' '}
                              {method.autoAssignGroup.maxMembers} membres)
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Self-enrollment */}
                    {method.methodType === 'self' && available && (
                      <div>
                        {method.welcomeMessage && (
                          <p className="text-sm text-muted-foreground mb-4">{method.welcomeMessage}</p>
                        )}
                        <Button
                          onClick={() => handleSelfEnrollment(method)}
                          disabled={selfForm.processing}
                          className="w-full"
                        >
                          {selfForm.processing ? 'Inscription en cours...' : "S'inscrire maintenant"}
                        </Button>
                      </div>
                    )}

                    {/* Key-based enrollment */}
                    {method.methodType === 'key' && available && (
                      <form onSubmit={(e) => handleKeyEnrollment(e, method)}>
                        {method.welcomeMessage && (
                          <p className="text-sm text-muted-foreground mb-4">{method.welcomeMessage}</p>
                        )}
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor={`key-${method.id}`}>Clé d'inscription</Label>
                            <Input
                              id={`key-${method.id}`}
                              type="text"
                              placeholder="Entrez la clé d'inscription"
                              value={keyForm.data.enrollmentKey}
                              onChange={(e) => keyForm.setData('enrollmentKey', e.target.value)}
                              required
                            />
                            {keyForm.errors.enrollmentKey && (
                              <p className="text-sm text-destructive mt-1">
                                {keyForm.errors.enrollmentKey}
                              </p>
                            )}
                          </div>
                          <Button type="submit" disabled={keyForm.processing} className="w-full">
                            {keyForm.processing ? 'Vérification...' : "S'inscrire avec la clé"}
                          </Button>
                        </div>
                      </form>
                    )}

                    {/* Approval-based enrollment */}
                    {method.methodType === 'approval' && available && (
                      <form onSubmit={(e) => handleRequestEnrollment(e, method)}>
                        {method.approvalMessage && (
                          <Alert className="mb-4">
                            <Info className="h-4 w-4" />
                            <AlertDescription>{method.approvalMessage}</AlertDescription>
                          </Alert>
                        )}
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor={`message-${method.id}`}>
                              Message de motivation (optionnel)
                            </Label>
                            <Textarea
                              id={`message-${method.id}`}
                              placeholder="Expliquez pourquoi vous souhaitez rejoindre ce cours..."
                              value={requestForm.data.message}
                              onChange={(e) => requestForm.setData('message', e.target.value)}
                              rows={4}
                            />
                          </div>
                          <Button
                            type="submit"
                            disabled={requestForm.processing}
                            className="w-full"
                          >
                            {requestForm.processing
                              ? 'Envoi en cours...'
                              : "Demander l'inscription"}
                          </Button>
                        </div>
                      </form>
                    )}

                    {/* Manual enrollment info */}
                    {method.methodType === 'manual' && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Cette méthode d'inscription nécessite qu'un enseignant vous ajoute manuellement
                          au cours. Veuillez contacter l'instructeur du cours.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8">
          <Button variant="outline" onClick={() => window.history.back()}>
            Retour
          </Button>
        </div>
      </div>
    </>
  )
}
