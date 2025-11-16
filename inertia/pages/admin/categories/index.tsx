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
import { Edit, Eye, EyeOff, FolderPlus, Trash2, ChevronRight, Plus, ArrowLeft } from 'lucide-react'

interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  parentId: number | null
  depth: number
  path: string | null
  sortOrder: number
  isVisible: boolean
  icon: string | null
  color: string | null
  coursesCount?: number
  childrenCount?: number
  children?: Category[]
}

interface Props {
  categories: Category[]
}

export default function CategoriesIndex({ categories }: Props) {
  const handleDelete = (id: number) => {
    router.delete(`/admin/categories/${id}`)
  }

  const rootCategories = categories.filter((c) => c.parentId === null)

  const renderCategoryTree = (category: Category, level: number = 0) => {
    const children = categories.filter((c) => c.parentId === category.id)
    const indentClass = level > 0 ? `ml-${level * 8}` : ''

    return (
      <div key={category.id} className={level > 0 ? 'mt-2' : 'mb-4'}>
        <Card className={indentClass}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {category.icon && (
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg"
                    style={{
                      backgroundColor: category.color || '#e5e7eb',
                      color: category.color ? '#ffffff' : '#000000',
                    }}
                  >
                    <span className="text-xl">{category.icon}</span>
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                    {!category.isVisible && (
                      <Badge variant="outline" className="text-xs">
                        <EyeOff className="h-3 w-3 mr-1" />
                        Masquée
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      Niveau {category.depth}
                    </Badge>
                  </div>
                  {category.description && (
                    <CardDescription className="mt-1">{category.description}</CardDescription>
                  )}
                  <div className="flex gap-3 mt-2 text-sm text-muted-foreground">
                    {category.coursesCount !== undefined && (
                      <span>{category.coursesCount} cours</span>
                    )}
                    {children.length > 0 && <span>{children.length} sous-catégories</span>}
                    <span className="font-mono text-xs">{category.slug}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Link href={`/admin/categories/${category.id}/add-child`}>
                  <Button size="sm" variant="outline" title="Ajouter une sous-catégorie">
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href={`/admin/categories/${category.id}/edit`}>
                  <Button size="sm" variant="outline">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={children.length > 0}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer la catégorie</AlertDialogTitle>
                      <AlertDialogDescription>
                        Êtes-vous sûr de vouloir supprimer "{category.name}" ? Cette action est
                        irréversible.
                        {category.coursesCount! > 0 && (
                          <span className="block mt-2 text-destructive font-semibold">
                            Attention: {category.coursesCount} cours sont dans cette catégorie.
                          </span>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(category.id)}
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
        </Card>

        {/* Render children */}
        {children.length > 0 && (
          <div className="ml-8 mt-2 space-y-2">
            {children
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((child) => renderCategoryTree(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Head title="Gestion des catégories" />

      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Back Button */}
        <Link
          href="/admin/courses"
          className="text-sm text-muted-foreground hover:underline flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la gestion des cours
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Catégories de cours</h1>
            <p className="text-muted-foreground">Organisez vos cours en catégories hiérarchiques</p>
          </div>
          <Link href="/admin/categories/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle catégorie
            </Button>
          </Link>
        </div>

        {/* Categories List */}
        {rootCategories.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderPlus className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune catégorie</h3>
              <p className="text-muted-foreground text-center mb-4">
                Créez votre première catégorie pour organiser vos cours.
              </p>
              <Link href="/admin/categories/create">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une catégorie
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rootCategories
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((category) => renderCategoryTree(category))}
          </div>
        )}

        {/* Info Card */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">À propos des catégories</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Les catégories permettent d'organiser vos cours de manière hiérarchique.</p>
            <p>
              • Vous pouvez créer des sous-catégories en cliquant sur l'icône{' '}
              <FolderPlus className="inline h-4 w-4" /> à côté d'une catégorie.
            </p>
            <p>• Une catégorie ne peut être supprimée que si elle n'a pas de sous-catégories.</p>
            <p>• L'ordre d'affichage est déterminé par le champ "Ordre de tri".</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
