import { Head, Link } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Progress } from '~/components/ui/progress'
import {
  ChevronLeft,
  CheckCircle,
  Circle,
  Clock,
  FileText,
  Film,
  Link as LinkIcon,
  FileUp,
  Play,
  BookOpen,
  Target,
} from 'lucide-react'
import AppHeader from '~/components/layout/app-header'

interface Course {
  id: number
  title: string
  code: string
  description: string | null
  estimatedHours: number | null
}

interface ContentProgress {
  id: number
  status: 'not_started' | 'in_progress' | 'completed'
  completedAt: string | null
}

interface CourseContent {
  id: number
  title: string
  contentType: 'page' | 'file' | 'video' | 'link' | 'assignment' | 'quiz'
  description: string | null
  estimatedTime: number | null
  completionRequired: boolean
  dueDate: string | null
}

interface CourseModule {
  id: number
  title: string
  description: string | null
  estimatedTime: number | null
  children: CourseModule[]
  contents: CourseContent[]
}

interface Props {
  course: Course
  modules: CourseModule[]
  progressMap: Record<number, ContentProgress>
  auth: {
    user: any
  }
  appSettings: any
  menus: any
}

export default function CourseOutline({
  course,
  modules,
  progressMap,
  auth,
  appSettings,
  menus,
}: Props) {
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
    const progress = progressMap[contentId]
    if (!progress || progress.status === 'not_started') {
      return <Circle className="h-5 w-5 text-muted-foreground" />
    } else if (progress.status === 'completed') {
      return <CheckCircle className="h-5 w-5 text-green-500" />
    } else {
      return <Play className="h-5 w-5 text-blue-500" />
    }
  }

  const calculateProgress = () => {
    const allContentIds: number[] = []
    modules.forEach((module) => {
      module.contents.forEach((content) => allContentIds.push(content.id))
      module.children.forEach((child) => {
        child.contents.forEach((content) => allContentIds.push(content.id))
      })
    })

    const completedCount = allContentIds.filter(
      (id) => progressMap[id]?.status === 'completed'
    ).length
    const totalCount = allContentIds.length

    return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  }

  const getModuleProgress = (module: CourseModule): number => {
    const contentIds: number[] = []
    module.contents.forEach((content) => contentIds.push(content.id))
    module.children.forEach((child) => {
      child.contents.forEach((content) => contentIds.push(content.id))
    })

    const completedCount = contentIds.filter((id) => progressMap[id]?.status === 'completed').length
    const totalCount = contentIds.length

    return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  }

  const getTotalEstimatedTime = (): number => {
    let total = 0
    modules.forEach((module) => {
      if (module.estimatedTime) total += module.estimatedTime
      module.contents.forEach((content) => {
        if (content.estimatedTime) total += content.estimatedTime
      })
      module.children.forEach((child) => {
        if (child.estimatedTime) total += child.estimatedTime
        child.contents.forEach((content) => {
          if (content.estimatedTime) total += content.estimatedTime
        })
      })
    })
    return total
  }

  const renderContent = (content: CourseContent) => (
    <Link
      key={content.id}
      href={`/courses/${course.id}/learn?content=${content.id}`}
      className="block"
    >
      <div className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg transition-colors border mb-2">
        {getProgressIcon(content.id)}
        {getContentIcon(content.contentType)}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{content.title}</h4>
            {content.completionRequired && (
              <Badge variant="outline" className="text-xs">
                Requis
              </Badge>
            )}
          </div>
          {content.description && (
            <p className="text-sm text-muted-foreground">{content.description}</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {content.estimatedTime && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {content.estimatedTime}min
            </div>
          )}
          {content.dueDate && (
            <div className="text-xs">
              Échéance: {new Date(content.dueDate).toLocaleDateString('fr-FR')}
            </div>
          )}
        </div>
      </div>
    </Link>
  )

  const renderModule = (module: CourseModule, depth: number = 0) => {
    const moduleProgress = getModuleProgress(module)

    return (
      <div key={module.id} className="mb-6" style={{ marginLeft: `${depth * 24}px` }}>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              <h3 className="text-lg font-semibold">{module.title}</h3>
              {module.estimatedTime && (
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {module.estimatedTime}min
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{moduleProgress}%</span>
              <Progress value={moduleProgress} className="w-24" />
            </div>
          </div>
          {module.description && (
            <p className="text-sm text-muted-foreground mb-3">{module.description}</p>
          )}
        </div>

        <div className="space-y-2">
          {module.contents.map((content) => renderContent(content))}
        </div>

        {module.children.map((child) => (
          <div key={child.id} className="mt-4">
            {renderModule(child, depth + 1)}
          </div>
        ))}
      </div>
    )
  }

  const overallProgress = calculateProgress()
  const totalTime = getTotalEstimatedTime()

  return (
    <>
      <Head title={`Plan du cours - ${course.title}`} />

      <AppHeader user={auth.user} appSettings={appSettings} menus={menus} />

      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="mb-8">
          <Link href={`/courses/${course.id}/learn`}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Retour au lecteur
            </Button>
          </Link>

          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
              <p className="text-muted-foreground">{course.code}</p>
            </div>
            <Link href={`/courses/${course.id}/learn`}>
              <Button>
                <Play className="mr-2 h-4 w-4" />
                Commencer
              </Button>
            </Link>
          </div>

          {course.description && (
            <p className="text-muted-foreground mb-6">{course.description}</p>
          )}

          {/* Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Votre progression</CardTitle>
              <CardDescription>Suivez votre avancement dans le cours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progression globale</span>
                    <span className="text-2xl font-bold">{overallProgress}%</span>
                  </div>
                  <Progress value={overallProgress} className="h-3" />
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">{modules.length}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Modules</p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">
                        {modules.reduce(
                          (acc, m) =>
                            acc +
                            m.contents.length +
                            m.children.reduce((c, ch) => c + ch.contents.length, 0),
                          0
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Activités</p>
                  </div>

                  {totalTime > 0 && (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-2xl font-bold">
                          {Math.round(totalTime / 60)}h{totalTime % 60}m
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">Durée estimée</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Course Content Outline */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Contenu du cours</h2>
          {modules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucun contenu disponible</h3>
                <p className="text-muted-foreground">
                  Ce cours ne contient pas encore de contenu
                </p>
              </CardContent>
            </Card>
          ) : (
            <div>{modules.map((module) => renderModule(module))}</div>
          )}
        </div>
      </div>
    </>
  )
}
