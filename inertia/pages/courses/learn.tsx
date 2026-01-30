import { Head, Link, router } from '@inertiajs/react'
import { useState, useEffect } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Progress } from '~/components/ui/progress'
import { Separator } from '~/components/ui/separator'
import { Badge } from '~/components/ui/badge'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  Clock,
  FileText,
  Film,
  Link as LinkIcon,
  FileUp,
  List,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  BookOpen,
  Play,
} from 'lucide-react'
import AppHeader from '~/components/layout/app-header'

interface Course {
  id: number
  title: string
  code: string
}

interface ContentProgress {
  id: number
  status: 'not_started' | 'in_progress' | 'completed'
  timeSpent: number
  completedAt: string | null
}

interface CourseContent {
  id: number
  title: string
  contentType: 'page' | 'file' | 'video' | 'link' | 'assignment' | 'quiz'
  content: string | null
  fileUrl: string | null
  externalUrl: string | null
  description: string | null
  estimatedTime: number | null
  isPublished: boolean
  completionRequired: boolean
}

interface CourseModule {
  id: number
  title: string
  description: string | null
  isPublished: boolean
  children: CourseModule[]
  contents: CourseContent[]
}

interface Props {
  course: Course
  modules: CourseModule[]
  currentContent: CourseContent | null
  progress: ContentProgress | null
  progressMap: Record<number, ContentProgress>
  auth: {
    user: any
  }
  appSettings: any
  menus: any
}

export default function LearnCourse({
  course,
  modules,
  currentContent,
  progress,
  progressMap,
  auth,
  appSettings,
  menus,
}: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set())
  const [startTime, setStartTime] = useState<number>(Date.now())

  useEffect(() => {
    // Expand module containing current content
    if (currentContent) {
      modules.forEach((module) => {
        if (module.contents.some((c) => c.id === currentContent.id)) {
          setExpandedModules((prev) => new Set(prev).add(module.id))
        }
        module.children.forEach((child) => {
          if (child.contents.some((c) => c.id === currentContent.id)) {
            setExpandedModules((prev) => new Set(prev).add(module.id).add(child.id))
          }
        })
      })
    }
  }, [currentContent, modules])

  useEffect(() => {
    // Track time spent on content
    const interval = setInterval(() => {
      if (currentContent && progress?.status !== 'completed') {
        const timeSpent = Math.floor((Date.now() - startTime) / 1000)
        if (timeSpent > 0 && timeSpent % 30 === 0) {
          // Send progress update every 30 seconds
          router.post(
            `/contents/${currentContent.id}/progress`,
            { timeSpent: 30 },
            { preserveState: true, preserveScroll: true }
          )
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [currentContent, progress, startTime])

  const toggleModule = (moduleId: number) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId)
    } else {
      newExpanded.add(moduleId)
    }
    setExpandedModules(newExpanded)
  }

  const handleContentClick = (contentId: number) => {
    router.visit(`/courses/${course.id}/learn?content=${contentId}`, {
      preserveState: false,
    })
  }

  const handleMarkComplete = () => {
    if (currentContent) {
      router.post(`/contents/${currentContent.id}/complete`, {}, { preserveState: false })
    }
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

  const getProgressIcon = (contentId: number) => {
    const contentProgress = progressMap[contentId]
    if (!contentProgress || contentProgress.status === 'not_started') {
      return <Circle className="h-4 w-4 text-muted-foreground" />
    } else if (contentProgress.status === 'completed') {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    } else {
      return <Play className="h-4 w-4 text-blue-500" />
    }
  }

  const getAllContents = (): CourseContent[] => {
    const allContents: CourseContent[] = []
    modules.forEach((module) => {
      module.contents.forEach((content) => allContents.push(content))
      module.children.forEach((child) => {
        child.contents.forEach((content) => allContents.push(content))
      })
    })
    return allContents
  }

  const getNextContent = (): CourseContent | null => {
    if (!currentContent) return null
    const allContents = getAllContents()
    const currentIndex = allContents.findIndex((c) => c.id === currentContent.id)
    return currentIndex < allContents.length - 1 ? allContents[currentIndex + 1] : null
  }

  const getPreviousContent = (): CourseContent | null => {
    if (!currentContent) return null
    const allContents = getAllContents()
    const currentIndex = allContents.findIndex((c) => c.id === currentContent.id)
    return currentIndex > 0 ? allContents[currentIndex - 1] : null
  }

  const renderModule = (module: CourseModule, depth: number = 0) => {
    const isExpanded = expandedModules.has(module.id)
    const hasChildren = module.children.length > 0 || module.contents.length > 0

    return (
      <div key={module.id}>
        <button
          onClick={() => toggleModule(module.id)}
          className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded-md text-left"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {hasChildren && (
            <span className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </span>
          )}
          <BookOpen className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 font-medium text-sm">{module.title}</span>
        </button>

        {isExpanded && (
          <>
            {module.contents.map((content) => (
              <button
                key={content.id}
                onClick={() => handleContentClick(content.id)}
                className={`w-full flex items-center gap-2 p-2 hover:bg-accent rounded-md text-left ${
                  currentContent?.id === content.id ? 'bg-accent' : ''
                }`}
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              >
                {getProgressIcon(content.id)}
                {getContentIcon(content.contentType)}
                <span className="flex-1 text-sm">{content.title}</span>
                {content.estimatedTime && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {content.estimatedTime}min
                  </span>
                )}
              </button>
            ))}

            {module.children.map((child) => renderModule(child, depth + 1))}
          </>
        )}
      </div>
    )
  }

  const nextContent = getNextContent()
  const previousContent = getPreviousContent()

  return (
    <>
      <Head title={currentContent ? currentContent.title : course.title} />

      <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar */}
        {isSidebarOpen && (
          <div className="w-80 border-r flex flex-col bg-background">
            <div className="p-4 border-b">
              <Link href={`/courses/${course.id}`}>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Retour au cours
                </Button>
              </Link>
              <h2 className="font-bold mt-3 mb-1">{course.title}</h2>
              <p className="text-sm text-muted-foreground">{course.code}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {modules.map((module) => renderModule(module))}
            </div>

            <div className="p-4 border-t">
              <Link href={`/courses/${course.id}/outline`}>
                <Button variant="outline" size="sm" className="w-full">
                  <List className="mr-2 h-4 w-4" />
                  Plan du cours
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content Header */}
          {currentContent && (
            <div className="border-b p-4 bg-background">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getContentIcon(currentContent.contentType)}
                    <h1 className="text-xl font-bold">{currentContent.title}</h1>
                  </div>
                  {currentContent.description && (
                    <p className="text-sm text-muted-foreground">{currentContent.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {progress?.status !== 'completed' && (
                    <Button onClick={handleMarkComplete} variant="outline" size="sm">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Marquer comme terminé
                    </Button>
                  )}
                  {progress?.status === 'completed' && (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Terminé
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto">
            {!currentContent ? (
              <div className="flex items-center justify-center h-full">
                <Card className="max-w-md">
                  <CardContent className="pt-6 text-center">
                    <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Commencez votre apprentissage</h3>
                    <p className="text-muted-foreground mb-4">
                      Sélectionnez un contenu dans le menu à gauche pour commencer
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="p-8 max-w-4xl mx-auto">
                {currentContent.contentType === 'page' && currentContent.content && (
                  <div
                    className="prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: currentContent.content }}
                  />
                )}

                {currentContent.contentType === 'video' && currentContent.externalUrl && (
                  <div className="aspect-video">
                    {currentContent.externalUrl.includes('youtube.com') ||
                    currentContent.externalUrl.includes('youtu.be') ? (
                      <iframe
                        src={currentContent.externalUrl.replace('watch?v=', 'embed/')}
                        title={currentContent.title}
                        className="w-full h-full rounded-lg"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={currentContent.externalUrl}
                        controls
                        className="w-full h-full rounded-lg"
                      >
                        <track kind="captions" />
                      </video>
                    )}
                  </div>
                )}

                {currentContent.contentType === 'file' && currentContent.fileUrl && (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <FileUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="mb-4">Fichier à télécharger</p>
                      <a href={currentContent.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button>Télécharger le fichier</Button>
                      </a>
                    </CardContent>
                  </Card>
                )}

                {currentContent.contentType === 'link' && currentContent.externalUrl && (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <LinkIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="mb-4">Lien externe</p>
                      <a
                        href={currentContent.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button>Ouvrir le lien</Button>
                      </a>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Navigation Footer */}
          {currentContent && (
            <div className="border-t p-4 bg-background">
              <div className="flex items-center justify-between max-w-4xl mx-auto">
                {previousContent ? (
                  <Button variant="outline" onClick={() => handleContentClick(previousContent.id)}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Précédent
                  </Button>
                ) : (
                  <div />
                )}

                {nextContent ? (
                  <Button onClick={() => handleContentClick(nextContent.id)}>
                    Suivant
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="default" asChild>
                    <Link href={`/courses/${course.id}`}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Terminer le cours
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
