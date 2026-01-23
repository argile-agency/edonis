import { Head, Link, useForm } from '@inertiajs/react'
import { FormEvent } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Switch } from '~/components/ui/switch'
import { Badge } from '~/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { ArrowLeft, Save, Settings as SettingsIcon, Users, Calendar } from 'lucide-react'

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
  level: string | null
  language: string
  estimatedHours: number | null
  tags: string[]
  categoryId: number | null
}

interface Category {
  id: number
  name: string
}

interface Props {
  course: Course
  categories: Category[]
}

export default function CourseSettings({ course, categories }: Props) {
  const form = useForm({
    code: course.code,
    title: course.title,
    description: course.description || '',
    objectives: course.objectives || '',
    status: course.status,
    visibility: course.visibility,
    maxStudents: course.maxStudents || '',
    allowEnrollment: course.allowEnrollment,
    isFeatured: course.isFeatured,
    startDate: course.startDate || '',
    endDate: course.endDate || '',
    level: course.level || '',
    language: course.language,
    estimatedHours: course.estimatedHours || '',
    tags: course.tags.join(', '),
    categoryId: course.categoryId || '',
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    form.put(`/admin/courses/${course.id}/settings`)
  }

  return (
    <>
      <Head title={`Paramètres - ${course.title}`} />

      <div className="container mx-auto py-8 px-4 max-w-5xl">
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
              <p className="text-muted-foreground">Paramètres du cours</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="general">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="general">
                <SettingsIcon className="h-4 w-4 mr-2" />
                Général
              </TabsTrigger>
              <TabsTrigger value="enrollment">
                <Users className="h-4 w-4 mr-2" />
                Inscription
              </TabsTrigger>
              <TabsTrigger value="schedule">
                <Calendar className="h-4 w-4 mr-2" />
                Planning
              </TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>Informations générales</CardTitle>
                  <CardDescription>Informations de base sur le cours</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="code">Code du cours *</Label>
                      <Input
                        id="code"
                        value={form.data.code}
                        onChange={(e) => form.setData('code', e.target.value)}
                        required
                      />
                      {form.errors.code && (
                        <p className="text-sm text-destructive">{form.errors.code}</p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="title">Titre du cours *</Label>
                      <Input
                        id="title"
                        value={form.data.title}
                        onChange={(e) => form.setData('title', e.target.value)}
                        required
                      />
                      {form.errors.title && (
                        <p className="text-sm text-destructive">{form.errors.title}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={form.data.description}
                      onChange={(e) => form.setData('description', e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="objectives">Objectifs pédagogiques</Label>
                    <Textarea
                      id="objectives"
                      value={form.data.objectives}
                      onChange={(e) => form.setData('objectives', e.target.value)}
                      rows={4}
                      placeholder="- Objectif 1&#10;- Objectif 2&#10;- Objectif 3"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="categoryId">Catégorie</Label>
                      <Select
                        value={form.data.categoryId.toString()}
                        onValueChange={(value) => form.setData('categoryId', Number(value) || '')}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="level">Niveau</Label>
                      <Select
                        value={form.data.level}
                        onValueChange={(value) => form.setData('level', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un niveau" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Beginner">Débutant</SelectItem>
                          <SelectItem value="Intermediate">Intermédiaire</SelectItem>
                          <SelectItem value="Advanced">Avancé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="language">Langue</Label>
                      <Select
                        value={form.data.language}
                        onValueChange={(value) => form.setData('language', value)}
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

                    <div className="grid gap-2">
                      <Label htmlFor="estimatedHours">Heures estimées</Label>
                      <Input
                        id="estimatedHours"
                        type="number"
                        value={form.data.estimatedHours}
                        onChange={(e) => form.setData('estimatedHours', e.target.value)}
                        placeholder="40"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="tags">Tags (séparés par des virgules)</Label>
                    <Input
                      id="tags"
                      value={form.data.tags}
                      onChange={(e) => form.setData('tags', e.target.value)}
                      placeholder="programmation, python, débutant"
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="status">Statut</Label>
                      <Select
                        value={form.data.status}
                        onValueChange={(value: any) => form.setData('status', value)}
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

                    <div className="grid gap-2">
                      <Label htmlFor="visibility">Visibilité</Label>
                      <Select
                        value={form.data.visibility}
                        onValueChange={(value: any) => form.setData('visibility', value)}
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

                    <div className="flex items-center space-x-2 pt-8">
                      <Switch
                        id="isFeatured"
                        checked={form.data.isFeatured}
                        onCheckedChange={(checked) => form.setData('isFeatured', checked)}
                      />
                      <Label htmlFor="isFeatured">Cours en vedette</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Enrollment Settings */}
            <TabsContent value="enrollment">
              <Card>
                <CardHeader>
                  <CardTitle>Paramètres d'inscription</CardTitle>
                  <CardDescription>Gérer les inscriptions au cours</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allowEnrollment"
                      checked={form.data.allowEnrollment}
                      onCheckedChange={(checked) => form.setData('allowEnrollment', checked)}
                    />
                    <Label htmlFor="allowEnrollment">Autoriser les inscriptions</Label>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="maxStudents">Nombre maximum d'étudiants</Label>
                    <Input
                      id="maxStudents"
                      type="number"
                      value={form.data.maxStudents}
                      onChange={(e) => form.setData('maxStudents', e.target.value)}
                      placeholder="Illimité si vide"
                    />
                    <p className="text-sm text-muted-foreground">
                      Laissez vide pour ne pas limiter le nombre d'inscriptions
                    </p>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Méthodes d'inscription</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Pour configurer les méthodes d'inscription (auto-inscription, clé,
                      approbation), utilisez la page dédiée.
                    </p>
                    <Link href={`/courses/${course.id}/enrollment-methods`}>
                      <Button variant="outline" size="sm">
                        Gérer les méthodes d'inscription
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Schedule Settings */}
            <TabsContent value="schedule">
              <Card>
                <CardHeader>
                  <CardTitle>Planning du cours</CardTitle>
                  <CardDescription>Dates de début et de fin du cours</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="startDate">Date de début</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={form.data.startDate}
                        onChange={(e) => form.setData('startDate', e.target.value)}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="endDate">Date de fin</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={form.data.endDate}
                        onChange={(e) => form.setData('endDate', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Groupes et horaires</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Pour organiser les étudiants en groupes et gérer les horaires détaillés,
                      utilisez la page de gestion des groupes.
                    </p>
                    <Link href={`/courses/${course.id}/groups`}>
                      <Button variant="outline" size="sm">
                        Gérer les groupes
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 mt-6">
            <Link href="/admin/courses">
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </Link>
            <Button type="submit" disabled={form.processing}>
              <Save className="h-4 w-4 mr-2" />
              {form.processing ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
