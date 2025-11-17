import { Head, Link, router, useForm } from '@inertiajs/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import {
  Plus,
  FileText,
  Film,
  Link as LinkIcon,
  FileUp,
  Edit,
  Trash2,
  GripVertical,
  Eye,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import AppHeader from '~/components/layout/app-header'

interface Course {
  id: number
  title: string
  code: string
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
  children: CourseModule[]
  contents: CourseContent[]
}

interface Props {
  course: Course
  modules: CourseModule[]
  auth: {
    user: any
  }
  appSettings: any
  menus: any
}

export default function CourseBuilder({ course, modules, auth, appSettings, menus }: Props) {
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
      <div key={module.id} style={{ marginLeft: `${depth * 24}px` }}>
        <Card className="mb-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />

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
                <h4 className="font-semibold">{module.title}</h4>
                {module.description && (
                  <p className="text-sm text-muted-foreground">{module.description}</p>
                )}
              </div>

              {!module.isPublished && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  Brouillon
                </span>
              )}

              <Button variant="ghost" size="sm" onClick={() => handleCreateContent(module.id)}>
                <Plus className="h-4 w-4 mr-1" />
                Contenu
              </Button>

              <Button variant="ghost" size="sm" onClick={() => handleCreateModule(module.id)}>
                <Plus className="h-4 w-4 mr-1" />
                Sous-section
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
          <>
            {module.contents?.map((content) => (
              <div key={content.id} style={{ marginLeft: '48px' }} className="mb-2">
                <Card>
                  <CardContent className="p-3 flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    {getContentIcon(content.contentType)}
                    <span className="flex-1">{content.title}</span>

                    {!content.isPublished && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Brouillon
                      </span>
                    )}

                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>

                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}

            {module.children?.map((child) => renderModule(child, depth + 1))}
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <Head title={`Éditeur - ${course.title}`} />

      <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href={`/courses/${course.id}`}>
                <Button variant="ghost" size="sm">
                  ← Retour au cours
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold">{course.title}</h1>
            <p className="text-muted-foreground mt-2">Éditeur de contenu</p>
          </div>

          <div className="flex gap-2">
            <Link href={`/courses/${course.id}/learn`}>
              <Button variant="outline">
                <Eye className="mr-2 h-4 w-4" />
                Aperçu
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
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
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
      </div>

      {/* Create Module Dialog */}
      <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau module</DialogTitle>
            <DialogDescription>
              Créez un nouveau module pour organiser votre contenu de cours
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
                {moduleForm.errors.title && (
                  <p className="text-sm text-red-500">{moduleForm.errors.title}</p>
                )}
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
              <Button type="button" variant="outline" onClick={() => setIsModuleDialogOpen(false)}>
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
              <Button type="button" variant="outline" onClick={() => setIsContentDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={contentForm.processing}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
