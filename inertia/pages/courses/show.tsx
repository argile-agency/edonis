import { Head, Link, router, useForm } from '@inertiajs/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import {
  ChevronLeft,
  Edit,
  CheckCircle,
  Users,
  Calendar,
  Clock,
  BookOpen,
  Play,
  Plus,
  FileText,
  Film,
  Link as LinkIcon,
  FileUp,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Settings,
  Info,
  Send,
} from 'lucide-react'
import AppHeader from '~/components/layout/app-header'

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

interface CourseContent {
  id: number
  title: string
  contentType: 'page' | 'file' | 'video' | 'link' | 'assignment' | 'quiz'
  order: number
  isPublished: boolean
}

interface CourseModule {
  id: number
  title: string
  description: string | null
  order: number
  isPublished: boolean
  children?: CourseModule[]
  contents?: CourseContent[]
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
  modules?: CourseModule[]
  permissions: {
    canEdit: boolean
    canManage: boolean
  }
  isEnrolled: boolean
  auth: {
    user: any
  }
  appSettings: any
  menus: any
}

export default function ShowCourse({
  course,
  modules = [],
  permissions,
  isEnrolled,
  auth,
  appSettings,
  menus,
}: Props) {
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false)
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false)
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set())

  const moduleForm = useForm({
    courseId: course.id,
    parentId: null as number | null,
    title: '',
    description: '',
    isPublished: true,
  })

  const contentForm = useForm({
    moduleId: 0,
    contentType: 'page' as 'page' | 'file' | 'video' | 'link' | 'assignment' | 'quiz',
    title: '',
    description: '',
    content: '',
    externalUrl: '',
    isPublished: true,
  })

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

  const formatDate = (date: string | null) => {
    if (!date) return 'Non défini'
    return new Date(date).toLocaleDateString('fr-FR')
  }

  const handleCreateModule = (parentId: number | null = null) => {
    moduleForm.setData({ ...moduleForm.data, courseId: course.id, parentId })
    setIsModuleDialogOpen(true)
  }

  const handleCreateContent = (moduleId: number) => {
    setSelectedModuleId(moduleId)
    contentForm.setData({ ...contentForm.data, moduleId })
    setIsContentDialogOpen(true)
  }

  const submitModule = (e: React.FormEvent) => {
    e.preventDefault()
    moduleForm.post(`/courses/${course.id}/modules`, {
      onSuccess: () => {
        setIsModuleDialogOpen(false)
        moduleForm.reset()
      },
    })
  }

  const submitContent = (e: React.FormEvent) => {
    e.preventDefault()
    contentForm.post(`/modules/${selectedModuleId}/contents`, {
      onSuccess: () => {
        setIsContentDialogOpen(false)
        contentForm.reset()
      },
    })
  }

  const toggleModule = (moduleId: number) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId)
    } else {
      newExpanded.add(moduleId)
    }
    setExpandedModules(newExpanded)
  }

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'page':
        return <FileText className="h-4 w-4" />
      case 'video':
        return <Film className="h-4 w-4" />
      case 'link':
        return <LinkIcon className="h-4 w-4" />
      case 'file':
        return <FileUp className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const renderModule = (module: CourseModule, depth: number = 0) => {
    const isExpanded = expandedModules.has(module.id)
    const hasChildren = (module.children?.length || 0) > 0 || (module.contents?.length || 0) > 0

    return (
      <div key={module.id} style={{ marginLeft: `${depth * 16}px` }} className="mb-2">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />

              {hasChildren && (
                <button onClick={() => toggleModule(module.id)} className="p-1">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}

              <div className="flex-1">
                <span className="font-medium text-sm">{module.title}</span>
              </div>

              {!module.isPublished && (
                <Badge variant="outline" className="text-xs">
                  Brouillon
                </Badge>
              )}

              <Button variant="ghost" size="sm" onClick={() => handleCreateContent(module.id)}>
                <Plus className="h-3 w-3 mr-1" />
                Contenu
              </Button>

              <Button variant="ghost" size="sm" onClick={() => handleCreateModule(module.id)}>
                <Plus className="h-3 w-3 mr-1" />
                Section
              </Button>

              <Button variant="ghost" size="icon">
                <Edit className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {isExpanded && (
          <div className="mt-2 space-y-2">
            {module.contents?.map((content) => (
              <div key={content.id} style={{ marginLeft: '32px' }}>
                <Card>
                  <CardContent className="p-2 flex items-center gap-2">
                    <GripVertical className="h-3 w-3 text-muted-foreground cursor-move" />
                    {getContentIcon(content.contentType)}
                    <span className="flex-1 text-sm">{content.title}</span>

                    {!content.isPublished && (
                      <Badge variant="outline" className="text-xs">
                        Brouillon
                      </Badge>
                    )}

                    <Button variant="ghost" size="icon">
                      <Edit className="h-3 w-3" />
                    </Button>

                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}

            {module.children?.map((child) => renderModule(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Head title={course.title} />

      <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <Link href="/courses">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Retour aux cours
            </Button>
          </Link>
        </div>

        <div className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Badge className={getStatusColor(course.status)}>{course.status}</Badge>
                <span className="text-sm text-muted-foreground">{course.code}</span>
              </div>
              <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
              <p className="text-muted-foreground">Par {course.instructor.fullName}</p>
            </div>

            <div className="flex gap-2">
              {isEnrolled && !permissions.canEdit && (
                <Link href={`/courses/${course.id}/learn`}>
                  <Button variant="default">
                    <Play className="mr-2 h-4 w-4" />
                    Commencer
                  </Button>
                </Link>
              )}

              {permissions.canEdit && course.status === 'draft' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="default">
                      <Send className="mr-2 h-4 w-4" />
                      Publier
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Publier ce cours ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Le cours sera publié et deviendra accessible aux étudiants selon les
                        paramètres de visibilité. Assurez-vous que le contenu est prêt avant de
                        publier.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          router.put(`/courses/${course.id}`, {
                            status: 'published',
                          })
                        }
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Publier le cours
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {permissions.canEdit && (
                <Link href={`/courses/${course.id}/edit`}>
                  <Button variant="outline">
                    <Settings className="mr-2 h-4 w-4" />
                    Paramètres
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList>
            <TabsTrigger value="info">
              <Info className="mr-2 h-4 w-4" />
              Informations
            </TabsTrigger>
            {permissions.canEdit && (
              <TabsTrigger value="content">
                <FileText className="mr-2 h-4 w-4" />
                Contenu
              </TabsTrigger>
            )}
            <TabsTrigger value="participants">
              <Users className="mr-2 h-4 w-4" />
              Participants ({course.enrolledCount})
            </TabsTrigger>
          </TabsList>

          {/* Tab: Informations */}
          <TabsContent value="info" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {course.description ? (
                      <p className="text-muted-foreground whitespace-pre-line">
                        {course.description}
                      </p>
                    ) : (
                      <p className="text-muted-foreground italic">Aucune description</p>
                    )}
                  </CardContent>
                </Card>

                {course.objectives && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Objectifs d'apprentissage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-line">
                        {course.objectives}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Informations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Étudiants inscrits</p>
                        <p className="text-2xl font-bold">{course.enrolledCount}</p>
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
                  </CardContent>
                </Card>

                {permissions.canManage && course.permissions && course.permissions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Permissions</CardTitle>
                      <CardDescription>Autres instructeurs</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {course.permissions.map((perm) => (
                          <div key={perm.id} className="flex items-center justify-between text-sm">
                            <div>
                              <p className="font-medium">{perm.user.fullName}</p>
                              <p className="text-xs text-muted-foreground">{perm.roleInCourse}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {perm.permissionLevel}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab: Contenu */}
          {permissions.canEdit && (
            <TabsContent value="content" className="mt-6">
              <div className="mb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Contenu du cours</h2>
                  <p className="text-sm text-muted-foreground">Organisez vos modules et contenus</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/courses/${course.id}/learn`}>
                    <Button variant="outline" size="sm">
                      <Play className="mr-2 h-4 w-4" />
                      Aperçu étudiant
                    </Button>
                  </Link>
                  <Button onClick={() => handleCreateModule()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nouveau module
                  </Button>
                </div>
              </div>

              {modules.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Aucun contenu</h3>
                    <p className="text-muted-foreground mb-4">
                      Commencez par créer un module pour organiser votre contenu
                    </p>
                    <Button onClick={() => handleCreateModule()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Créer le premier module
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">{modules.map((module) => renderModule(module))}</div>
              )}
            </TabsContent>
          )}

          {/* Tab: Participants */}
          <TabsContent value="participants" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Participants du cours</CardTitle>
                <CardDescription>
                  {course.enrolledCount} étudiant{course.enrolledCount > 1 ? 's' : ''} inscrit
                  {course.enrolledCount > 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  La liste des participants sera affichée ici
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Module Dialog */}
        <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau module</DialogTitle>
              <DialogDescription>
                Créez un nouveau module pour organiser votre contenu
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={submitModule}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titre *</Label>
                  <Input
                    id="title"
                    value={moduleForm.data.title}
                    onChange={(e) => moduleForm.setData('title', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={moduleForm.data.description}
                    onChange={(e) => moduleForm.setData('description', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isPublished"
                    checked={moduleForm.data.isPublished}
                    onCheckedChange={(checked) => moduleForm.setData('isPublished', checked)}
                  />
                  <Label htmlFor="isPublished">Publier immédiatement</Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModuleDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={moduleForm.processing}>
                  Créer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Content Dialog */}
        <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nouveau contenu</DialogTitle>
              <DialogDescription>Ajoutez du contenu à votre module</DialogDescription>
            </DialogHeader>

            <form onSubmit={submitContent}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="contentType">Type de contenu *</Label>
                  <Select
                    value={contentForm.data.contentType}
                    onValueChange={(value: any) => contentForm.setData('contentType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="page">Page de texte</SelectItem>
                      <SelectItem value="video">Vidéo</SelectItem>
                      <SelectItem value="file">Fichier</SelectItem>
                      <SelectItem value="link">Lien externe</SelectItem>
                      <SelectItem value="assignment">Devoir</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contentTitle">Titre *</Label>
                  <Input
                    id="contentTitle"
                    value={contentForm.data.title}
                    onChange={(e) => contentForm.setData('title', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contentDescription">Description</Label>
                  <Textarea
                    id="contentDescription"
                    value={contentForm.data.description}
                    onChange={(e) => contentForm.setData('description', e.target.value)}
                    rows={2}
                  />
                </div>

                {contentForm.data.contentType === 'page' && (
                  <div className="space-y-2">
                    <Label htmlFor="content">Contenu</Label>
                    <Textarea
                      id="content"
                      value={contentForm.data.content}
                      onChange={(e) => contentForm.setData('content', e.target.value)}
                      rows={6}
                      placeholder="Contenu HTML ou texte..."
                    />
                  </div>
                )}

                {(contentForm.data.contentType === 'video' ||
                  contentForm.data.contentType === 'link') && (
                  <div className="space-y-2">
                    <Label htmlFor="externalUrl">URL *</Label>
                    <Input
                      id="externalUrl"
                      type="url"
                      value={contentForm.data.externalUrl}
                      onChange={(e) => contentForm.setData('externalUrl', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="contentIsPublished"
                    checked={contentForm.data.isPublished}
                    onCheckedChange={(checked) => contentForm.setData('isPublished', checked)}
                  />
                  <Label htmlFor="contentIsPublished">Publier immédiatement</Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsContentDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={contentForm.processing}>
                  Créer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
