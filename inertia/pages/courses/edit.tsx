import { Head, useForm, Link, router } from '@inertiajs/react'
import { FormEvent } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
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
import { ChevronLeft, Archive, Trash2, AlertTriangle, ArchiveRestore } from 'lucide-react'

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
  startDate: string | null
  endDate: string | null
  category: string | null
  level: string | null
  language: string
  estimatedHours: number | null
  tags: string[] | null
}

interface Props {
  course: Course
}

export default function EditCourse({ course }: Props) {
  const { data, setData, put, processing, errors } = useForm({
    code: course.code || '',
    title: course.title || '',
    description: course.description || '',
    objectives: course.objectives || '',
    status: course.status || 'draft',
    visibility: course.visibility || 'private',
    maxStudents: course.maxStudents?.toString() || '',
    allowEnrollment: course.allowEnrollment,
    startDate: course.startDate || '',
    endDate: course.endDate || '',
    category: course.category || '',
    level: course.level || '',
    language: course.language || 'fr',
    estimatedHours: course.estimatedHours?.toString() || '',
    tags: course.tags?.join(', ') || '',
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    // Transform data before sending
    const payload: any = {
      ...data,
      maxStudents: data.maxStudents ? Number(data.maxStudents) : undefined,
      estimatedHours: data.estimatedHours ? Number(data.estimatedHours) : undefined,
      tags: data.tags
        ? data.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : undefined,
    }

    put(`/courses/${course.id}`, payload)
  }

  return (
    <>
      <Head title={`Modifier ${course.title}`} />

      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-6">
          <Link href={`/courses/${course.id}`}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Retour au cours
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Modifier le cours</CardTitle>
            <CardDescription>Mettez à jour les informations de votre cours</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informations de base</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Code du cours *</Label>
                    <Input
                      id="code"
                      value={data.code}
                      onChange={(e) => setData('code', e.target.value)}
                      placeholder="ex: CS101"
                      required
                    />
                    {errors.code && <p className="text-sm text-red-500">{errors.code}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Langue</Label>
                    <Select
                      value={data.language}
                      onValueChange={(value) => setData('language', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="en">Anglais</SelectItem>
                        <SelectItem value="es">Espagnol</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Titre du cours *</Label>
                  <Input
                    id="title"
                    value={data.title}
                    onChange={(e) => setData('title', e.target.value)}
                    placeholder="ex: Introduction à la programmation"
                    required
                  />
                  {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                    placeholder="Décrivez le contenu et les objectifs du cours..."
                    rows={4}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500">{errors.description}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="objectives">Objectifs d'apprentissage</Label>
                  <Textarea
                    id="objectives"
                    value={data.objectives}
                    onChange={(e) => setData('objectives', e.target.value)}
                    placeholder="Listez les compétences que les étudiants acquerront..."
                    rows={4}
                  />
                  {errors.objectives && <p className="text-sm text-red-500">{errors.objectives}</p>}
                </div>
              </div>

              {/* Course Settings */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold">Paramètres du cours</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Statut</Label>
                    <Select
                      value={data.status}
                      onValueChange={(value: any) => setData('status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Brouillon</SelectItem>
                        <SelectItem value="published">Publié</SelectItem>
                        <SelectItem value="archived">Archivé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="visibility">Visibilité</Label>
                    <Select
                      value={data.visibility}
                      onValueChange={(value: any) => setData('visibility', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Privé</SelectItem>
                        <SelectItem value="unlisted">Non répertorié</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie</Label>
                    <Select
                      value={data.category}
                      onValueChange={(value) => setData('category', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Computer Science">Informatique</SelectItem>
                        <SelectItem value="Mathematics">Mathématiques</SelectItem>
                        <SelectItem value="Science">Sciences</SelectItem>
                        <SelectItem value="Language">Langues</SelectItem>
                        <SelectItem value="Business">Commerce</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="level">Niveau</Label>
                    <Select value={data.level} onValueChange={(value) => setData('level', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un niveau" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Beginner">Débutant</SelectItem>
                        <SelectItem value="Intermediate">Intermédiaire</SelectItem>
                        <SelectItem value="Advanced">Avancé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxStudents">Nombre maximum d'étudiants</Label>
                    <Input
                      id="maxStudents"
                      type="number"
                      value={data.maxStudents}
                      onChange={(e) => setData('maxStudents', e.target.value)}
                      placeholder="Illimité si vide"
                      min="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estimatedHours">Heures estimées</Label>
                    <Input
                      id="estimatedHours"
                      type="number"
                      value={data.estimatedHours}
                      onChange={(e) => setData('estimatedHours', e.target.value)}
                      placeholder="ex: 40"
                      min="1"
                    />
                  </div>
                </div>
              </div>

              {/* Scheduling */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold">Planning</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Date de début</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={data.startDate}
                      onChange={(e) => setData('startDate', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">Date de fin</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={data.endDate}
                      onChange={(e) => setData('endDate', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold">Tags</h3>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (séparés par des virgules)</Label>
                  <Input
                    id="tags"
                    value={data.tags}
                    onChange={(e) => setData('tags', e.target.value)}
                    placeholder="ex: programmation, python, débutant"
                  />
                  <p className="text-sm text-muted-foreground">
                    Les tags aident les étudiants à trouver votre cours
                  </p>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-4 pt-6">
                <Link href={`/courses/${course.id}`}>
                  <Button type="button" variant="outline">
                    Annuler
                  </Button>
                </Link>
                <Button type="submit" disabled={processing}>
                  {processing ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="mt-6 border-red-200 dark:border-red-900">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-600">Zone de danger</CardTitle>
            </div>
            <CardDescription>
              Actions irréversibles qui affectent de manière permanente ce cours
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Archive/Unarchive Course */}
            {course.status !== 'archived' ? (
              <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-900 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">Archiver le cours</h4>
                  <p className="text-sm text-muted-foreground">
                    Le cours ne sera plus accessible aux étudiants. Vous pourrez le restaurer plus
                    tard.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Archiver
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Archiver ce cours ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Le cours sera marqué comme archivé et ne sera plus visible par les
                        étudiants. Les données seront conservées et vous pourrez le restaurer à tout
                        moment.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => router.post(`/courses/${course.id}/archive`)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Archiver le cours
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 border border-green-200 dark:border-green-900 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">Restaurer le cours</h4>
                  <p className="text-sm text-muted-foreground">
                    Désarchive le cours et le republie. Il sera à nouveau accessible aux étudiants.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-green-300 text-green-600 hover:bg-green-50"
                    >
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Restaurer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Restaurer ce cours ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Le cours sera désarchivé et republié. Il redeviendra visible et accessible
                        aux étudiants.
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
                        Restaurer le cours
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Delete Course */}
            <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-900 rounded-lg">
              <div className="flex-1">
                <h4 className="font-medium">Supprimer le cours</h4>
                <p className="text-sm text-muted-foreground">
                  Supprime définitivement le cours et toutes ses données. Cette action est
                  irréversible.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action ne peut pas être annulée. Cela supprimera définitivement le cours
                      <strong> "{course.title}" </strong>
                      et toutes ses données associées : contenu, modules, inscriptions et
                      progressions des étudiants.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        router.delete(`/courses/${course.id}`, {
                          onSuccess: () => router.visit('/courses'),
                        })
                      }
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Oui, supprimer définitivement
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
